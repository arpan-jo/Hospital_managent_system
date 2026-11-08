import apiRequest from '../network/apiRequest';
import { UploadedLabReportRepository } from './UploadedLabReportRepository';

jest.mock('../network/apiRequest', () => ({ __esModule: true, default: jest.fn() }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('UploadedLabReportRepository.getUploadedLabReports', () => {
  beforeEach(() => request.mockReset());

  it('reads each confirmed test with its results', async () => {
    request.mockResolvedValueOnce([
      {
        uploadedLabReportId: 31,
        documentId: 210,
        fileUrl: 'patient-docs/cbc.pdf',
        fileName: 'cbc.pdf',
        extension: '.pdf',
        patientRegistrationId: 2367,
        patientCode: 'P-2367',
        patientName: 'Al Amin',
        reportType: 'Pathology',
        testName: 'Complete Blood Count',
        department: 'Haematology',
        sampleType: 'Blood',
        labName: 'Popular Diagnostic',
        reportId: 'LAB-77',
        referredBy: 'Dr. Nabid Alam',
        sampleCollectedAt: '2026-11-01T09:00:00',
        reportedAt: '2026-11-01T17:00:00',
        verifiedBy: null,
        interpretation: null,
        comments: '  Repeat in 3 months. ',
        manualContent: null,
        createdAt: '2026-11-02T10:00:00',
        rows: [
          {
            serial: 1,
            groupName: 'RBC',
            attribute: 'Haemoglobin',
            resultValue: '11.2',
            unit: 'g/dL',
            normalRange: 'M: 13-17\nF: 12-15',
            resultStatus: 'LOW',
            methodName: null,
            confidence: 0.92,
          },
          { serial: 2, attribute: 'WBC', resultValue: '7.1', resultStatus: 'weird' },
        ],
      },
    ]);

    const [report] = await UploadedLabReportRepository.getUploadedLabReports();

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/hms/patient/documents/lab-reports', method: 'GET' }),
    );
    expect(report).toMatchObject({
      uploadedLabReportId: 31,
      reportType: 'pathology',
      testName: 'Complete Blood Count',
      labName: 'Popular Diagnostic',
      verifiedBy: '',
      comments: 'Repeat in 3 months.',
      patientCode: 'P-2367',
    });
    expect(report.rows).toEqual([
      {
        serial: 1,
        groupName: 'RBC',
        attribute: 'Haemoglobin',
        resultValue: '11.2',
        unit: 'g/dL',
        normalRange: 'M: 13-17\nF: 12-15',
        resultStatus: 'low',
        methodName: '',
      },
      {
        serial: 2,
        groupName: '',
        attribute: 'WBC',
        resultValue: '7.1',
        unit: '',
        normalRange: '',
        resultStatus: 'unknown',
        methodName: '',
      },
    ]);
  });

  it('files one without a type under Pathology, and keeps Radiology apart', async () => {
    request.mockResolvedValueOnce([
      { uploadedLabReportId: 1, testName: 'CBC' },
      { uploadedLabReportId: 2, testName: 'USG', reportType: 'Radiology', rows: null },
    ]);

    const reports = await UploadedLabReportRepository.getUploadedLabReports();

    expect(reports.map(report => report.reportType)).toEqual(['pathology', 'radiology']);
    expect(reports[1].rows).toEqual([]);
  });

  it('drops rows without an id and fails on a non-list answer', async () => {
    request.mockResolvedValueOnce([{ uploadedLabReportId: 0 }, null, { uploadedLabReportId: 4 }]);
    await expect(UploadedLabReportRepository.getUploadedLabReports()).resolves.toHaveLength(1);

    request.mockResolvedValueOnce({});
    await expect(UploadedLabReportRepository.getUploadedLabReports()).rejects.toThrow(
      'Unexpected uploaded lab reports response',
    );
  });
});

describe('UploadedLabReportRepository.removeUploadedLabReport', () => {
  beforeEach(() => request.mockReset());

  it('deletes by the uploaded report id', async () => {
    request.mockResolvedValueOnce(undefined);

    await UploadedLabReportRepository.removeUploadedLabReport(31);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/hms/patient/documents/lab-reports/31', method: 'DELETE' }),
    );
  });
});
