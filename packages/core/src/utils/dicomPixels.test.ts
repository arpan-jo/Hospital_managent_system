import {
  canWindow,
  defaultWindow,
  distanceMm,
  multipartBody,
  packFrame,
  readFrameInfo,
  valueAt,
} from './dicomPixels';

const tag = (...value: any[]) => ({ Value: value });

/** A 2×1 CT frame: signed 16-bit, HU = stored − 1024. */
const ctInfo = readFrameInfo({
  '00280010': tag(1),
  '00280011': tag(2),
  '00280100': tag(16),
  '00280101': tag(16),
  '00280103': tag(1),
  '00280002': tag(1),
  '00280004': tag('MONOCHROME2'),
  '00281053': tag('1'),
  '00281052': tag('-1024'),
  '00281050': tag('40', '600'),
  '00281051': tag('400', '2500'),
  '00280030': tag('0.5', '0.25'),
});

describe('readFrameInfo', () => {
  it('reads what drawing needs, taking the first of several windows', () => {
    expect(ctInfo).toEqual(
      expect.objectContaining({
        rows: 1,
        columns: 2,
        isSigned: true,
        rescaleIntercept: -1024,
        windowCenter: 40,
        windowWidth: 400,
        pixelSpacing: [0.5, 0.25],
      }),
    );
    expect(canWindow(ctInfo)).toBe(true);
  });

  it('falls back to the detector spacing, and leaves colour to the rendered JPEG', () => {
    const xray = readFrameInfo({ '00181164': tag('0.1\\0.1'), '00281050': tag('2048\\1000') });
    expect(xray.pixelSpacing).toEqual([0.1, 0.1]);
    expect(xray.windowCenter).toBe(2048);
    expect(canWindow(readFrameInfo({ '00280010': tag(2), '00280011': tag(2), '00280002': tag(3), '00280004': tag('RGB') }))).toBe(false);
  });
});

describe('multipartBody', () => {
  it('skips the part headers', () => {
    const answer = new Uint8Array([...Array.from('--b\r\nContent-Type: x\r\n\r\n', char => char.charCodeAt(0)), 7, 8, 9]);
    expect(Array.from(multipartBody(answer).subarray(0, 3))).toEqual([7, 8, 9]);
  });

  it('fails on an answer with no body', () => {
    expect(() => multipartBody(new Uint8Array([1, 2, 3]))).toThrow();
  });
});

describe('packFrame', () => {
  it('packs signed little-endian values and reads them back as HU', () => {
    // Stored 1000 → −24 HU; stored −1000 (0xFC18) → −2024 HU.
    const frame = packFrame(new Uint8Array([0xe8, 0x03, 0x18, 0xfc]), ctInfo);

    expect(Array.from(frame.rgba.subarray(0, 4))).toEqual([0x03, 0xe8, 0, 255]);
    expect(valueAt(frame, ctInfo, 0, 0)).toBe(-24);
    expect(valueAt(frame, ctInfo, 1.7, 0.2)).toBe(-2024);
    expect(valueAt(frame, ctInfo, 2, 0)).toBeNull();
    expect([frame.min, frame.max]).toEqual([-2024, -24]);
  });

  it('masks to Bits Stored and reads 8-bit frames', () => {
    const twelveBit = { ...ctInfo, bitsStored: 12, isSigned: false, rescaleIntercept: 0 };
    // 0xF123 with 12 bits stored is 0x123: the top nibble is not part of the value.
    expect(valueAt(packFrame(new Uint8Array([0x23, 0xf1, 0, 0]), twelveBit), twelveBit, 0, 0)).toBe(0x123);

    const eightBit = { ...ctInfo, bitsAllocated: 8, bitsStored: 8, isSigned: false, rescaleIntercept: 0 };
    expect(valueAt(packFrame(new Uint8Array([200, 5]), eightBit), eightBit, 0, 0)).toBe(200);
  });

  it('refuses a frame shorter than its size', () => {
    expect(() => packFrame(new Uint8Array([1, 2]), ctInfo)).toThrow();
  });
});

describe('windows and distances', () => {
  it("uses the modality's window, else the frame's range", () => {
    expect(defaultWindow(ctInfo, { min: 0, max: 10 })).toEqual({ center: 40, width: 400 });
    expect(defaultWindow({ ...ctInfo, windowCenter: null }, { min: -1000, max: 3000 })).toEqual({
      center: 1000,
      width: 4000,
    });
  });

  it('measures in millimetres with row and column spacing apart', () => {
    // 4 columns × 0.25 mm and 3 rows × 0.5 mm → 1 and 1.5 mm.
    expect(distanceMm(ctInfo, { x: 0, y: 0 }, { x: 4, y: 3 })).toBeCloseTo(Math.hypot(1, 1.5));
    expect(distanceMm({ ...ctInfo, pixelSpacing: null }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });
});
