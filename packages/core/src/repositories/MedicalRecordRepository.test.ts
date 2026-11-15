import axios from 'axios';
import apiRequest from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { MedicalRecordRepository, parsePacsViewerLink } from './MedicalRecordRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('./FileRepository', () => ({ __esModule: true, default: { upload: jest.fn() } }));

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

describe('MedicalRecordRepository.getLabTests', () => {
  beforeEach(() => request.mockReset());

  it("keeps when the hospital expects a pending test's report", async () => {
    request.mockResolvedValueOnce([
      { billRowId: 1, status: 'collected', isReportReady: false, expectedDeliveryAt: '2026-11-09T17:00:00' },
      { billRowId: 2, status: 'final', isReportReady: true, expectedDeliveryAt: null },
      { billRowId: 3, status: 'pending' },
    ]);

    const tests = await MedicalRecordRepository.getLabTests('pathology');

    expect(tests.map(test => test.expectedDeliveryAt)).toEqual(['2026-11-09T17:00:00', '', '']);
    expect(tests.map(test => test.isReportReady)).toEqual([false, true, false]);
  });

  it('reads a report held back by money due on its bill', async () => {
    request.mockResolvedValueOnce([
      { billRowId: 1, status: 'final', isReportReady: true, billDueAmount: 500, isLockedByDue: true },
      // The amount alone says it too, should the flag be missing.
      { billRowId: 2, status: 'final', isReportReady: true, billDueAmount: 120.5 },
      { billRowId: 3, status: 'final', isReportReady: true, billDueAmount: 0, isLockedByDue: false },
      // An older backend sends neither — nothing is locked.
      { billRowId: 4, status: 'final', isReportReady: true },
      { billRowId: 5, status: 'final', isReportReady: true, billDueAmount: -40 },
    ]);

    const tests = await MedicalRecordRepository.getLabTests('radiology');

    expect(tests.map(test => test.isLockedByDue)).toEqual([true, true, false, false, false]);
    expect(tests.map(test => test.billDueAmount)).toEqual([500, 120.5, 0, 0, 0]);
  });
});

describe('MedicalRecordRepository.getPrescriptionPrintData', () => {
  beforeEach(() => request.mockReset());

  /** The shape the live API answered for one prescription (trimmed). */
  const printData = {
    prescription: { id: 2315, accountId: 20401, branchId: 40709, doctorName: 'Khairul Bashar' },
    isPatientUpload: false,
    patient: { patientName: 'Al Amin', mobile: '01711000000', age: '29', gender: 'Male', address: '', patientId: 'REG-2026-0107' },
    hospital: { logoUrl: null, name: 'Another Organisation', address: 'Elsewhere', officeName: 'HQ' },
    layout: {
      header: { enabled: true, contents: ['<p>Dr. Someone Else</p><p>MBBS</p>'] },
      footer: { enabled: true, contents: ['<p style="text-align: center;"><b>আপনার সুস্থতা ও নিরাপদ চিকিৎসার বিশ্বস্ত ঠিকানা।</b></p>', '', ''] },
      notice: { enabled: true, text: 'Another doctor\'s hours' },
    },
    leftSections: [{ key: 'physicalExamination', label: 'Physical Examination' }, { key: 'diagnosis', label: 'Diagnosis' }],
    rightSections: [{ key: 'rx', label: 'Rx' }, { key: 'followUp', label: 'Follow-up' }, { key: 'advice', label: 'Advice' }],
    sectionData: { rx: [] },
    signatoryHtml: '',
    signatureImageId: '',
  };

  it("asks under the patient's own registration's account and branch", async () => {
    request.mockResolvedValueOnce({ accountId: 20401, branchId: 40709 }).mockResolvedValueOnce(printData);

    const data = await MedicalRecordRepository.getPrescriptionPrintData(2315, 2367);

    expect(request.mock.calls?.[0]?.[0]).toMatchObject({ url: `${ENDPOINTS.patientRegistration}/2367`, method: 'GET' });
    expect(request.mock.calls?.[1]?.[0]).toMatchObject({
      url: ENDPOINTS.prescriptionPrintData,
      method: 'GET',
      params: { accountId: 20401, branchId: 40709, prescriptionId: 2315 },
    });
    expect(data).toEqual({
      isPatientUpload: false,
      patient: { name: 'Al Amin', mobile: '01711000000', age: '29', gender: 'Male', address: '', patientId: 'REG-2026-0107' },
      leftSectionKeys: ['physicalExamination', 'diagnosis'],
      rightSectionKeys: ['rx', 'followUp', 'advice'],
      footerLines: ['আপনার সুস্থতা ও নিরাপদ চিকিৎসার বিশ্বস্ত ঠিকানা।'],
      signatoryLines: [],
    });
  });

  it('falls back to the static live Mediplex pair when the registration cannot be read', async () => {
    request.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(printData);

    await MedicalRecordRepository.getPrescriptionPrintData(2315, 2367);

    expect(request.mock.calls?.[1]?.[0]).toMatchObject({
      params: { accountId: 20402, branchId: 40710, prescriptionId: 2315 },
    });
  });

  it('does not read a registration it was not given, and copes with an empty answer', async () => {
    request.mockResolvedValueOnce({});

    const data = await MedicalRecordRepository.getPrescriptionPrintData(2315, null);

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls?.[0]?.[0]).toMatchObject({ params: { accountId: 20402, branchId: 40710 } });
    expect(data).toEqual({
      isPatientUpload: false,
      patient: { name: '', mobile: '', age: '', gender: '', address: '', patientId: '' },
      leftSectionKeys: [],
      rightSectionKeys: [],
      footerLines: [],
      signatoryLines: [],
    });
  });

  it('fails on an answer that is not the print data', async () => {
    request.mockResolvedValueOnce({ accountId: 20401, branchId: 40709 }).mockResolvedValueOnce([]);
    await expect(MedicalRecordRepository.getPrescriptionPrintData(2315, 2367)).rejects.toThrow();
  });
});
