import apiRequest from '../network/apiRequest';
import {
  DocumentReadRepository,
  datePart,
  guessLabReportType,
  isNotThatKind,
  isReadableLabReport,
  isReadablePrescription,
  labReportProblem,
  prescriptionProblem,
  toExtractedLabReport,
  toExtractedPrescription,
} from './DocumentReadRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));

const mockPost = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({
      post: (...args: any[]) => mockPost(...args),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    }),
  },
}));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('toExtractedPrescription', () => {
  it('keeps the fields the save expects, nulls for what was not read', () => {
    const read = toExtractedPrescription({
      requestId: 'doc-5',
      status: 'Success',
      header: { doctorName: ' Dr. Karim ', prescriptionDate: '2026-11-01', patientName: '' },
      rx: [
        { brand: ' Napa 500 ', dose: '1+0+1', durationValue: '5', durationUnit: 'Days', confidence: 0.4 },
        { brand: null, multiDose: [{ dose: '1+0+0' }] },
        null,
      ],
      sections: { diagnosis: [{ name: 'Fever' }] },
    });
    expect(read.status).toBe('success');
    expect(read.header).toEqual({
      doctorName: 'Dr. Karim',
      departmentName: null,
      hospitalName: null,
      prescriptionDate: '2026-11-01',
      patientName: null,
    });
    expect(read.rx[0]).toMatchObject({ brand: 'Napa 500', dose: '1+0+1', isContinue: false, confidence: 0.4 });
    expect(read.rx[1]).toMatchObject({ brand: '', multiDose: [{ dose: '1+0+0', durationValue: null }] });
    expect(read.rx[2]).toMatchObject({ brand: '', dose: null });
    expect(read.sections).toEqual({ diagnosis: [{ name: 'Fever' }] });
  });

  it('survives an answer with nothing in it', () => {
    const read = toExtractedPrescription(null);
    expect(read).toMatchObject({ status: '', rx: [], sections: null });
  });
});

describe('toExtractedLabReport', () => {
  it('reads the tests and their rows, numbering a row without a serial', () => {
    const read = toExtractedLabReport({
      status: 'partial',
      header: { labName: 'Popular', reportedAt: '2026-10-28T09:30' },
      tests: [{ testName: 'CBC', rows: [{ attribute: 'Hb', resultValue: '13', resultStatus: 'NORMAL' }, { attribute: 'WBC' }] }],
    });
    expect(read.header.labName).toBe('Popular');
    expect(read.tests[0].rows).toEqual([
      expect.objectContaining({ serial: 1, attribute: 'Hb', resultStatus: 'normal' }),
      expect.objectContaining({ serial: 2, attribute: 'WBC', resultStatus: 'unknown', resultValue: null }),
    ]);
  });
});

describe('the portal rules', () => {
  it('reviews a prescription read with medicines or other parts, not one it could not read', () => {
    expect(isReadablePrescription(toExtractedPrescription({ status: 'success', rx: [{ brand: 'Napa' }] }))).toBe(true);
    expect(isReadablePrescription(toExtractedPrescription({ status: 'partial', sections: { advice: [] } }))).toBe(true);
    expect(isReadablePrescription(toExtractedPrescription({ status: 'success' }))).toBe(false);
    expect(isReadablePrescription(toExtractedPrescription({ status: 'unreadable', rx: [{ brand: 'Napa' }] }))).toBe(false);
    expect(isReadablePrescription(null)).toBe(false);
  });

  it('reviews a lab report only with a test on it', () => {
    expect(isReadableLabReport(toExtractedLabReport({ status: 'success', tests: [{ testName: 'CBC' }] }))).toBe(true);
    expect(isReadableLabReport(toExtractedLabReport({ status: 'success', tests: [] }))).toBe(false);
  });

  it('tells "this is something else" apart', () => {
    expect(isNotThatKind('not_prescription')).toBe(true);
    expect(isNotThatKind('unreadable')).toBe(false);
  });

  it('guesses Radiology for imaging and Pathology otherwise', () => {
    expect(guessLabReportType([{ testName: 'X-Ray Chest PA' } as any])).toBe('Radiology');
    expect(guessLabReportType([{ testName: 'USG of whole abdomen' } as any])).toBe('Radiology');
    expect(guessLabReportType([{ testName: 'CBC', department: 'Haematology' } as any])).toBe('Pathology');
    expect(guessLabReportType(null)).toBe('Pathology');
  });

  it('takes the date part of a date-time', () => {
    expect(datePart('2026-10-28T09:30')).toBe('2026-10-28');
    expect(datePart('28 Oct')).toBe('');
    expect(datePart(null)).toBe('');
  });

  it("names what stops a prescription's save", () => {
    const ok = {
      registrationId: 7,
      doctorName: null,
      departmentName: null,
      hospitalName: null,
      prescriptionDate: '2026-11-01',
      items: [],
      sections: null,
    };
    expect(prescriptionProblem(ok)).toBeNull();
    expect(prescriptionProblem({ ...ok, registrationId: 0 })).toBe('forWhom');
    expect(prescriptionProblem({ ...ok, prescriptionDate: '01/11/2026' })).toBe('date');
    expect(prescriptionProblem({ ...ok, doctorName: 'x'.repeat(201) })).toBe('doctorTooLong');
    expect(prescriptionProblem({ ...ok, items: [{ brand: ' ' } as any] })).toBe('medicineName');
  });

  it("names what stops a lab report's save", () => {
    const ok = {
      registrationId: 7,
      reportType: 'Pathology' as const,
      labName: null,
      reportId: null,
      referredBy: null,
      sampleCollectedAt: null,
      reportedAt: null,
      verifiedBy: null,
      tests: [{ testName: 'CBC', rows: [] } as any],
    };
    expect(labReportProblem(ok)).toBeNull();
    expect(labReportProblem({ ...ok, tests: [] })).toBe('noTests');
    expect(labReportProblem({ ...ok, tests: [{ testName: '', rows: [] } as any] })).toBe('testName');
    expect(labReportProblem({ ...ok, registrationId: 0 })).toBe('forWhom');
  });
});

describe('DocumentReadRepository', () => {
  beforeEach(() => {
    request.mockReset();
    mockPost.mockReset();
  });

  it('sends the file to the reader with the portal’s fields', async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'success', rx: [{ brand: 'Napa' }] } });

    const read = await DocumentReadRepository.readPrescription(
      { uri: 'file:///rx.jpg', name: 'rx.jpg', type: 'image/jpeg' },
      42,
    );

    expect(mockPost).toHaveBeenCalledWith('/v1/documents/extract', expect.any(FormData), expect.objectContaining({ timeout: 120000 }));
    // Node's FormData in the test runner — React Native's type has no `get`.
    const form = mockPost.mock.calls[0][1] as any;
    expect(form.has('file')).toBe(true);
    expect(form.get('requestId')).toBe('doc-42');
    expect(form.get('category')).toBe('Prescription');
    expect(form.get('languageHint')).toBe('en,bn');
    expect(read.rx[0].brand).toBe('Napa');
  });

  it('saves a reviewed lab report against the document', async () => {
    request.mockResolvedValueOnce({ testCount: 1 });
    const input = {
      registrationId: 7,
      reportType: 'Radiology' as const,
      labName: 'Popular',
      reportId: null,
      referredBy: null,
      sampleCollectedAt: null,
      reportedAt: '2026-10-28',
      verifiedBy: null,
      tests: [],
    };

    await DocumentReadRepository.confirmLabReport(42, input);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/hms/patient/documents/42/lab-report', method: 'POST', data: input }),
    );
  });

  it('saves a reviewed prescription against the document', async () => {
    request.mockResolvedValueOnce({ prescriptionId: 9 });
    await DocumentReadRepository.confirmPrescription(42, {
      registrationId: 7,
      doctorName: null,
      departmentName: null,
      hospitalName: null,
      prescriptionDate: null,
      items: [],
      sections: null,
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/hms/patient/documents/42/prescription', method: 'POST' }),
    );
  });
});
