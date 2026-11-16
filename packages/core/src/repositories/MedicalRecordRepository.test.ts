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
    prescription: {
      id: 2315,
      accountId: 20401,
      branchId: 40709,
      prescriptionCode: 'PRS-20261017-000000001',
      patientCode: 'REG-2026-0107',
      patientName: 'Al Amin',
      dateOfBirth: '1997-03-12',
      departmentName: 'Gynaecology & Obstetrics',
      doctorName: 'Khairul Bashar',
      createdAt: '2026-10-17T11:27:10.59',
      sourceHospitalName: null,
      sourceDate: null,
    },
    isPatientUpload: false,
    patient: { patientName: 'Al Amin', mobile: '01711000000', age: '29', gender: 'Male', address: '', patientId: 'REG-2026-0107' },
    hospital: { logoUrl: null, name: 'Marie Stopes Bangladesh', address: 'HQ', officeName: 'MSB HQ' },
    layout: {
      hospitalInfo: {
        enabled: true,
        content: '<p><b><strong>Akij Mediplex Limited</strong></b></p><p><span>House No, 02, Road 05 Pallabi Rd, Dhaka 1216</span></p>',
      },
      header: {
        enabled: true,
        contents: ['<p>Dr. Tanjim Akter Tanha</p><p>MBBS, FCPS</p>', '<p>ডা. তানজিম আক্তার তানহা</p>', ''],
      },
      footer: { enabled: true, contents: ['<p style="text-align: center;"><b>আপনার সুস্থতা ও নিরাপদ চিকিৎসার বিশ্বস্ত ঠিকানা।</b></p>', '', ''] },
      notice: { enabled: true, text: 'রোগী দেখার সময়: সকাল ১০টা থেকে সন্ধ্যা ৭টা পর্যন্ত' },
    },
    leftSections: [{ key: 'physicalExamination', label: 'Physical Examination' }, { key: 'diagnosis', label: 'Diagnosis' }],
    rightSections: [{ key: 'rx', label: 'Rx' }, { key: 'followUp', label: 'Follow-up' }, { key: 'advice', label: 'Advice' }],
    sectionData: {
      rx: [
        { type: 'Tablet', generic: 'Amiodarone Hydrochloride', brand: 'Pacet [100 mg]', route: 'Oral', dose: '০+০+১', durationValue: '2', durationUnit: 'Days', isContinue: false, isMixed: false, note: 'খাবারের আগে' },
      ],
      physicalExamination: { __vitals: { 'Pulse (R)': '33' }, __groups: [{ id: '__vitals', name: 'Vitals' }] },
    },
    signatoryHtml: '',
    signatureImageId: '',
  };

  it('asks under the static live Mediplex account and branch, and reads the whole sheet from the one answer', async () => {
    request.mockResolvedValueOnce(printData);

    const data = await MedicalRecordRepository.getPrescriptionPrintData(2315);

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls?.[0]?.[0]).toMatchObject({
      url: ENDPOINTS.prescriptionPrintData,
      method: 'GET',
      params: { accountId: 20402, branchId: 40710, prescriptionId: 2315 },
    });
    expect(request.mock.calls?.[0]?.[0]?.params).not.toHaveProperty('officeId');

    expect(data?.prescription).toMatchObject({
      id: 2315,
      code: 'PRS-20261017-000000001',
      prescribedAt: '2026-10-17T11:27:10.59',
      departmentName: 'Gynaecology & Obstetrics',
      doctorName: 'Khairul Bashar',
      patientName: 'Al Amin',
      patientCode: 'REG-2026-0107',
      isUploaded: false,
      sourceHospitalName: '',
      medicineCount: 1,
    });
    expect(data?.prescription?.medicines?.map(medicine => medicine?.brand)).toEqual(['Pacet [100 mg]']);
    expect(data?.prescription?.sections).toEqual([
      {
        key: 'physicalExamination',
        label: 'Physical Examination',
        groups: [{ groupName: 'Vitals', lines: [{ text: 'Pulse (R): 33', note: '', isUrgent: false }] }],
      },
    ]);

    expect(data).toMatchObject({
      isPatientUpload: false,
      patient: {
        name: 'Al Amin',
        mobile: '01711000000',
        age: '29',
        dateOfBirth: '1997-03-12',
        gender: 'Male',
        address: '',
        patientId: 'REG-2026-0107',
      },
      leftSectionKeys: ['physicalExamination', 'diagnosis'],
      rightSectionKeys: ['rx', 'followUp', 'advice'],
      hospitalLines: ['Akij Mediplex Limited', 'House No, 02, Road 05 Pallabi Rd, Dhaka 1216'],
      headerColumns: [['Dr. Tanjim Akter Tanha', 'MBBS, FCPS'], ['ডা. তানজিম আক্তার তানহা']],
      notice: 'রোগী দেখার সময়: সকাল ১০টা থেকে সন্ধ্যা ৭টা পর্যন্ত',
      footerLines: ['আপনার সুস্থতা ও নিরাপদ চিকিৎসার বিশ্বস্ত ঠিকানা।'],
      signatoryLines: [],
      signatureImage: '',
    });
  });

  it('reads the sections out of the JSON copy when the parsed ones are missing', async () => {
    request.mockResolvedValueOnce({
      ...printData,
      sectionData: null,
      prescription: { ...printData.prescription, sectionDataJson: JSON.stringify(printData.sectionData) },
    });

    const data = await MedicalRecordRepository.getPrescriptionPrintData(2315);

    expect(data?.prescription?.medicines?.length).toBe(1);
    expect(data?.prescription?.sections?.[0]?.key).toBe('physicalExamination');
  });

  it('leaves out a band the layout switches off', async () => {
    request.mockResolvedValueOnce({
      ...printData,
      layout: {
        hospitalInfo: { ...printData.layout.hospitalInfo, enabled: false },
        header: { ...printData.layout.header, enabled: false },
        footer: { ...printData.layout.footer, enabled: false },
        notice: { ...printData.layout.notice, enabled: false },
      },
    });

    await expect(MedicalRecordRepository.getPrescriptionPrintData(2315)).resolves.toMatchObject({
      hospitalLines: [],
      headerColumns: [],
      notice: '',
      footerLines: [],
    });
  });

  it('copes with an empty answer', async () => {
    request.mockResolvedValueOnce({});

    const data = await MedicalRecordRepository.getPrescriptionPrintData(2315);

    expect(data).toMatchObject({
      isPatientUpload: false,
      patient: { name: '', mobile: '', age: '', dateOfBirth: '', gender: '', address: '', patientId: '' },
      leftSectionKeys: [],
      rightSectionKeys: [],
      hospitalLines: [],
      headerColumns: [],
      notice: '',
      footerLines: [],
      signatoryLines: [],
      signatureImage: '',
    });
    expect(data?.prescription).toMatchObject({ id: 0, code: '', medicines: [], sections: [], medicineCount: 0 });
  });

  it('fails on an answer that is not the print data, and passes a 404 on', async () => {
    request.mockResolvedValueOnce([]);
    await expect(MedicalRecordRepository.getPrescriptionPrintData(2315)).rejects.toThrow();

    request.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(MedicalRecordRepository.getPrescriptionPrintData(2315)).rejects.toThrow('Not Found');
  });

  it('reads an answer of the wrong shape as missing, never as "[object Object]", and does not throw', async () => {
    request.mockResolvedValueOnce({
      prescription: { id: 'x', prescriptionCode: { a: 1 }, createdAt: 123, doctorName: ['Dr'], sectionDataJson: '{not json' },
      isPatientUpload: 'yes',
      patient: null,
      layout: {
        header: { enabled: true, contents: [null, 5, { x: 1 }, '<p>Dr. X</p>'] },
        footer: 'not a band',
        notice: { text: ['a'] },
        hospitalInfo: { content: 42 },
      },
      leftSections: 'nope',
      rightSections: [null, { key: 3 }, { key: { a: 1 } }],
      sectionData: 7,
      signatoryHtml: {},
      signatureImageId: { id: 'x' },
      signatureImageDataUri: ['data:image/png;base64,AAAA'],
      signatureImageUrl: 42,
    });

    const data = await MedicalRecordRepository.getPrescriptionPrintData(2315);

    expect(JSON.stringify(data)).not.toContain('[object Object]');
    expect(data?.prescription).toMatchObject({
      id: 0,
      code: '',
      prescribedAt: '123',
      doctorName: '',
      isUploaded: false,
      medicines: [],
      sections: [],
    });
    expect(data).toMatchObject({
      isPatientUpload: false,
      patient: { name: '', mobile: '', age: '', dateOfBirth: '', gender: '', address: '', patientId: '' },
      leftSectionKeys: [],
      rightSectionKeys: ['3'],
      headerColumns: [['5'], ['Dr. X']],
      hospitalLines: ['42'],
      notice: '',
      footerLines: [],
      signatoryLines: [],
      signatureImage: '',
    });
  });

  it("draws the signature picture once the server sends it — a data URI or url, never today's bare id", async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const read = async (extra: Record<string, unknown>) => {
      request.mockResolvedValueOnce({ ...printData, ...extra });
      return (await MedicalRecordRepository.getPrescriptionPrintData(2315))?.signatureImage;
    };

    // Today: an SME document id, which no patient route opens.
    expect(await read({ signatureImageId: '8f1c2e7a-0b3d-4c5e-9f60-1a2b3c4d5e6f' })).toBe('');
    expect(await read({ signatureImageId: null })).toBe('');
    // A new field, or the id field carrying the picture itself.
    expect(await read({ signatureImageDataUri: png })).toBe(png);
    expect(await read({ signatureImageId: png })).toBe(png);
    expect(await read({ signatureImageUrl: 'https://mgm.ibos.io/hms/files/sign.png' })).toBe(
      'https://mgm.ibos.io/hms/files/sign.png',
    );
    // The first good one wins, even with a bare id beside it.
    expect(await read({ signatureImageDataUri: png, signatureImageId: 'abc123' })).toBe(png);
    // Anything that is not a drawable picture is none.
    expect(await read({ signatureImageDataUri: 'data:image/svg+xml;base64,PHN2Zz4=' })).toBe('');
    expect(await read({ signatureImageDataUri: 'data:text/html;base64,PGI+' })).toBe('');
    // Built from parts so the linter does not read the test data as a script url.
    expect(await read({ signatureImageUrl: ['javascript', 'alert(1)'].join(':') })).toBe('');
    expect(await read({ signatureImageUrl: 'ftp://x/sign.png' })).toBe('');
  });
});
