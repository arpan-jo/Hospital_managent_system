/**
 * The DICOM side of the radiology viewer: what a frame's stored pixels mean (read from the
 * series' DICOM JSON), and the stored values themselves, packed so the GPU can window them.
 *
 * The PACS sends a frame uncompressed (Explicit VR Little Endian, transcoded on request), as
 * the one part of a multipart/related answer. Each stored value — up to 16 bits — is packed
 * into an RGBA texel: high byte in R, low byte in G. The viewer's shader unpacks it, applies
 * the sign, Rescale Slope/Intercept (Hounsfield units for CT) and the window, per pixel, so
 * dragging the window redraws at once at any image size.
 */

/** What a frame's pixels need to be read and drawn. */
export interface DicomFrameInfo {
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  /** Stored values are two's complement. */
  isSigned: boolean;
  samplesPerPixel: number;
  photometric: string;
  rescaleSlope: number;
  rescaleIntercept: number;
  /** The window the modality chose; null when it named none. */
  windowCenter: number | null;
  windowWidth: number | null;
  /** Millimetres per pixel — [row spacing, column spacing]; null when unknown. */
  pixelSpacing: [number, number] | null;
}

/** One stored frame, packed for the shader — and kept to read a pixel's value back. */
export interface PackedFrame {
  /** RGBA, one texel per pixel: R = high byte, G = low byte of the stored value. */
  rgba: Uint8Array;
  /** Lowest and highest value in the frame, after Rescale Slope/Intercept. */
  min: number;
  max: number;
}

export interface WindowLevel {
  center: number;
  width: number;
}

/** CT windows radiologists reach for, in Hounsfield units. */
export const CT_WINDOW_PRESETS: { key: string; center: number; width: number }[] = [
  { key: 'softTissue', center: 40, width: 400 },
  { key: 'lung', center: -600, width: 1500 },
  { key: 'bone', center: 400, width: 1800 },
  { key: 'brain', center: 40, width: 80 },
];

const toNumber = (value: any, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** All of a DICOM JSON attribute's values: `{ "00281050": { "vr": "DS", "Value": ["40", "400"] } }`. */
const values = (raw: any, tag: string): any[] => (Array.isArray(raw?.[tag]?.Value) ? raw[tag].Value : []);

/** A multi-valued string attribute may also arrive as one backslash-joined value. */
const firstNumber = (raw: any, tag: string): number | null => {
  const first = String(values(raw, tag)[0] ?? '').split('\\')[0]?.trim() ?? '';
  return first === '' || !Number.isFinite(Number(first)) ? null : Number(first);
};

const spacingOf = (raw: any, tag: string): [number, number] | null => {
  const parts = values(raw, tag)
    .flatMap(value => String(value ?? '').split('\\'))
    .map(value => Number(value));
  return parts.length >= 2 && parts[0] > 0 && parts[1] > 0 ? [parts[0], parts[1]] : null;
};

/** One instance's DICOM JSON (from `/series/{uid}/metadata`) read for drawing. */
export const readFrameInfo = (raw: any): DicomFrameInfo => {
  const bitsAllocated = toNumber(values(raw, '00280100')[0], 16);
  return {
    rows: toNumber(values(raw, '00280010')[0]),
    columns: toNumber(values(raw, '00280011')[0]),
    bitsAllocated,
    bitsStored: toNumber(values(raw, '00280101')[0], bitsAllocated),
    isSigned: toNumber(values(raw, '00280103')[0]) === 1,
    samplesPerPixel: toNumber(values(raw, '00280002')[0], 1),
    photometric: String(values(raw, '00280004')[0] ?? 'MONOCHROME2').trim().toUpperCase(),
    rescaleSlope: firstNumber(raw, '00281053') || 1,
    rescaleIntercept: firstNumber(raw, '00281052') ?? 0,
    windowCenter: firstNumber(raw, '00281050'),
    windowWidth: firstNumber(raw, '00281051'),
    // Pixel Spacing is at the patient; a projection X-ray may only carry the detector's.
    pixelSpacing: spacingOf(raw, '00280030') ?? spacingOf(raw, '00181164'),
  };
};

/**
 * The shader windows one grey channel of up to 16 bits. Anything else — colour (ultrasound
 * Doppler, photos), 32-bit — is drawn from the JPEG the PACS renders instead.
 */
export const canWindow = (info: DicomFrameInfo): boolean =>
  info.samplesPerPixel === 1 &&
  info.photometric.startsWith('MONOCHROME') &&
  (info.bitsAllocated === 8 || info.bitsAllocated === 16) &&
  info.bitsStored > 0 &&
  info.bitsStored <= info.bitsAllocated &&
  info.rows > 0 &&
  info.columns > 0;

const CRLF_CRLF = [13, 10, 13, 10];

/**
 * The body of the first part of a multipart/related answer: everything after the part's
 * headers. The pixels run to `rows × columns × bytes` from there; the closing boundary
 * after them is never read, so it need not be found.
 */
export const multipartBody = (answer: Uint8Array): Uint8Array => {
  for (let i = 0; i + 3 < answer.length; i++) {
    if (CRLF_CRLF.every((byte, offset) => answer[i + offset] === byte)) return answer.subarray(i + 4);
  }
  throw new Error('No multipart body');
};

/** A stored value as the modality meant it: two's complement applied, then Slope/Intercept. */
export const modalityValue = (stored: number, info: DicomFrameInfo): number => {
  const range = 2 ** info.bitsStored;
  const signed = info.isSigned && stored >= range / 2 ? stored - range : stored;
  return signed * info.rescaleSlope + info.rescaleIntercept;
};

/** Packs a frame's stored values (little endian) into RGBA texels, masked to Bits Stored. */
export const packFrame = (pixels: Uint8Array, info: DicomFrameInfo): PackedFrame => {
  const count = info.rows * info.columns;
  const bytesPer = info.bitsAllocated / 8;
  if (pixels.length < count * bytesPer) throw new Error('Frame is shorter than its size');

  const mask = 2 ** info.bitsStored - 1;
  const rgba = new Uint8Array(count * 4);
  let minStored = Infinity;
  let maxStored = -Infinity;
  for (let i = 0; i < count; i++) {
    const raw = bytesPer === 2 ? pixels[i * 2] | (pixels[i * 2 + 1] << 8) : pixels[i];
    const stored = raw & mask;
    rgba[i * 4] = stored >> 8;
    rgba[i * 4 + 1] = stored & 0xff;
    rgba[i * 4 + 3] = 255;
    // Range in signed terms, so a negative value is not read as a huge one.
    const signed = info.isSigned && stored > mask >> 1 ? stored - mask - 1 : stored;
    if (signed < minStored) minStored = signed;
    if (signed > maxStored) maxStored = signed;
  }

  const ends = [minStored, maxStored].map(value => value * info.rescaleSlope + info.rescaleIntercept);
  return { rgba, min: Math.min(...ends), max: Math.max(...ends) };
};

/** The value at one pixel, read back from the packed texels; null outside the frame. */
export const valueAt = (frame: PackedFrame, info: DicomFrameInfo, x: number, y: number): number | null => {
  const column = Math.floor(x);
  const row = Math.floor(y);
  if (column < 0 || row < 0 || column >= info.columns || row >= info.rows) return null;
  const index = (row * info.columns + column) * 4;
  return modalityValue((frame.rgba[index] << 8) | frame.rgba[index + 1], info);
};

/** The window the modality chose, else one spanning the whole frame. */
export const defaultWindow = (info: DicomFrameInfo, frame: Pick<PackedFrame, 'min' | 'max'>): WindowLevel =>
  info.windowCenter !== null && info.windowWidth !== null && info.windowWidth > 0
    ? { center: info.windowCenter, width: info.windowWidth }
    : autoWindow(frame);

/** A window over the frame's full range. */
export const autoWindow = (frame: Pick<PackedFrame, 'min' | 'max'>): WindowLevel => ({
  center: (frame.min + frame.max) / 2,
  width: Math.max(frame.max - frame.min, 1),
});

/** Distance between two pixel positions, in millimetres; null without Pixel Spacing. */
export const distanceMm = (
  info: DicomFrameInfo,
  from: { x: number; y: number },
  to: { x: number; y: number },
): number | null => {
  if (!info.pixelSpacing) return null;
  const [rowSpacing, columnSpacing] = info.pixelSpacing;
  return Math.hypot((to.x - from.x) * columnSpacing, (to.y - from.y) * rowSpacing);
};

/**
 * The shader: unpack the stored value, apply sign and Slope/Intercept, then the DICOM linear
 * window (PS3.3 C.11.2.1.2). MONOCHROME1 is drawn inverted, as its definition says.
 */
export const WINDOW_SHADER = `
uniform shader image;
uniform float center;
uniform float width;
uniform float slope;
uniform float intercept;
uniform float bitsStored;
uniform float isSigned;
uniform float invert;

half4 main(float2 xy) {
  half4 texel = image.eval(xy);
  float stored = floor(texel.r * 255.0 + 0.5) * 256.0 + floor(texel.g * 255.0 + 0.5);
  float range = exp2(bitsStored);
  if (isSigned > 0.5 && stored >= range * 0.5) {
    stored -= range;
  }
  float value = stored * slope + intercept;
  float grey = clamp((value - (center - 0.5)) / max(width - 1.0, 1.0) + 0.5, 0.0, 1.0);
  if (invert > 0.5) {
    grey = 1.0 - grey;
  }
  return half4(half3(grey), 1.0);
}
`;
