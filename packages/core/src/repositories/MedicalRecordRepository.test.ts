import axios from 'axios';
import apiRequest from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { MedicalRecordRepository, parsePacsViewerLink } from './MedicalRecordRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('MedicalRecordRepository.getRadiologyImages', () => {
  beforeEach(() => request.mockReset());

  it('asks for one test by its bill row and reads the viewer link', async () => {
    const viewerUrl = 'http://pacs.example/ohif/viewer?StudyInstanceUIDs=1.2.3&token=abc';
    request.mockResolvedValueOnce({ found: true, viewerUrl, message: null });

    await expect(MedicalRecordRepository.getRadiologyImages(1234)).resolves.toEqual({
      found: true,
      viewerUrl,
      message: '',
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: ENDPOINTS.portalRadiologyImages,
        method: 'GET',
        params: { billRowId: 1234 },
      }),
    );
  });

  it("keeps the server's reason when the PACS has no images", async () => {
    request.mockResolvedValueOnce({
      found: false,
      viewerUrl: null,
      message: 'No images found in PACS for this accession no.',
    });

    await expect(MedicalRecordRepository.getRadiologyImages(1234)).resolves.toEqual({
      found: false,
      viewerUrl: '',
      message: 'No images found in PACS for this accession no.',
    });
  });

  it('reads an answer without its fields as not found', async () => {
    request.mockResolvedValueOnce({});

    await expect(MedicalRecordRepository.getRadiologyImages(1234)).resolves.toEqual({
      found: false,
      viewerUrl: '',
      message: '',
    });
  });

  it('fails on an answer that is not a record', async () => {
    request.mockResolvedValueOnce(null);
    await expect(MedicalRecordRepository.getRadiologyImages(1234)).rejects.toThrow();

    request.mockResolvedValueOnce([]);
    await expect(MedicalRecordRepository.getRadiologyImages(1234)).rejects.toThrow();
  });
});

describe('parsePacsViewerLink', () => {
  it("reads the backend's viewer link", () => {
    expect(
      parsePacsViewerLink('http://10.0.0.1:8042/ohif/viewer?StudyInstanceUIDs=1.2.3,4.5&token=a.b-c_d'),
    ).toEqual({ origin: 'http://10.0.0.1:8042', studyUids: ['1.2.3', '4.5'], token: 'a.b-c_d' });
  });

  it('refuses a link with no token, no study, or a study that is not a UID', () => {
    expect(parsePacsViewerLink('http://pacs/ohif/viewer?StudyInstanceUIDs=1.2.3')).toBeNull();
    expect(parsePacsViewerLink('http://pacs/ohif/viewer?token=abc')).toBeNull();
    expect(parsePacsViewerLink('http://pacs/ohif/viewer?StudyInstanceUIDs=1.2/../x&token=abc')).toBeNull();
    expect(parsePacsViewerLink('javascript:alert(1)?StudyInstanceUIDs=1.2&token=abc')).toBeNull();
    expect(parsePacsViewerLink(null)).toBeNull();
  });
});

describe('MedicalRecordRepository.getRadiologyStudy', () => {
  const get = axios.get as jest.Mock;
  const tag = (value: any) => ({ Value: [value] });
  const study = 'http://pacs/dicom-web/studies/1.2';

  beforeEach(() => get.mockReset());

  it('lists picture series in order, each frame in scan order, with what drawing needs', async () => {
    get.mockImplementation(async (url: string) => {
      if (url === `${study}/series`) {
        return {
          data: [
            { '0020000E': tag('9.2'), '00080060': tag('CT'), '00200011': tag(2) },
            { '0020000E': tag('9.1'), '00080060': tag('CT'), '00200011': tag(1), '0008103E': tag('Scout') },
            { '0020000E': tag('9.3'), '00080060': tag('SR'), '00200011': tag(3) },
          ],
        };
      }
      if (url.startsWith(`${study}/series/9.1/`)) return { data: '' };
      const image = { '00280010': tag(512), '00280011': tag(512), '00100010': tag({ Alphabetic: 'Rofik' }) };
      return {
        data: [
          { ...image, '00080018': tag('7.2'), '00200013': tag(2) },
          { ...image, '00080018': tag('7.1'), '00200013': tag(1), '00280008': tag(2) },
          // No Rows: not a picture.
          { '00080018': tag('7.3'), '00200013': tag(3) },
        ],
      };
    });

    const result = await MedicalRecordRepository.getRadiologyStudy(
      'http://pacs/ohif/viewer?StudyInstanceUIDs=1.2&token=tok',
    );

    // The scout has no images and the SR is not a picture — only series 9.2 is left.
    expect(result.series.map(item => item.uid)).toEqual(['9.2']);
    const [series] = result.series;
    expect(series.frames.map(frame => frame.pixelUrl)).toEqual([
      `${study}/series/9.2/instances/7.1/frames/1`,
      `${study}/series/9.2/instances/7.1/frames/2`,
      `${study}/series/9.2/instances/7.2/frames/1`,
    ]);
    expect(series.frames[0].renderedUrl).toBe(`${study}/series/9.2/instances/7.1/frames/1/rendered`);
    expect(series.frames[0].info.rows).toBe(512);
    expect(series.tags).toContainEqual({ keyword: 'PatientName', value: 'Rofik' });
    expect(result.token).toBe('tok');
    expect(get).toHaveBeenCalledWith(
      `${study}/series/9.2/metadata`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
  });

  it('reads a frame as the body of its multipart answer, asking for uncompressed pixels', async () => {
    const answer = new Uint8Array([...Array.from('--b\r\nContent-Type: application/octet-stream\r\n\r\n', char => char.charCodeAt(0)), 1, 2]);
    get.mockResolvedValueOnce({ data: answer.buffer });

    const pixels = await MedicalRecordRepository.getRadiologyFramePixels(`${study}/series/9.2/instances/7.1/frames/1`, 'tok');

    expect(Array.from(pixels.subarray(0, 2))).toEqual([1, 2]);
    expect(get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        responseType: 'arraybuffer',
        headers: expect.objectContaining({ Accept: expect.stringContaining('transfer-syntax=1.2.840.10008.1.2.1') }),
      }),
    );
  });

  it('fails on a link it cannot read, without calling the PACS', async () => {
    await expect(MedicalRecordRepository.getRadiologyStudy('http://pacs/ohif/viewer')).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });
});
