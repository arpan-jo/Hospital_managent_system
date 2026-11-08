/**
 * Lab reports the patient uploaded themselves, that the AI read and they then
 * confirmed — `GET /hms/patient/documents/lab-reports`, one row per test. The
 * portal lists them above the hospital's own tests on the Pathology and
 * Radiology pages, marked "Uploaded", and lets the patient remove one.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { LabTestType, RecordPatient, toRecordPatient } from './MedicalRecordRepository';

/** How a result sits against its range; anything else reads as 'unknown'. */
export type UploadedLabResultStatus = 'normal' | 'high' | 'low' | 'unknown';

/** One parameter line of the test, as read off the sheet. */
export interface UploadedLabRow {
  serial: number;
  /** The heading it sits under on the sheet — '' when it has none. */
  groupName: string;
  attribute: string;
  resultValue: string;
  unit: string;
  normalRange: string;
  resultStatus: UploadedLabResultStatus;
  methodName: string;
}

export interface UploadedLabReport extends RecordPatient {
  uploadedLabReportId: number;
  documentId: number;
  /** The original file, as the server stores it — `getFileUrl` makes it a link. */
  fileUrl: string;
  fileName: string;
  extension: string;
  /** Which page lists it; an older backend that sends none means Pathology. */
  reportType: LabTestType;
  testName: string;
  department: string;
  sampleType: string;
  labName: string;
  reportId: string;
  referredBy: string;
  /** Bangladesh wall-clock, no zone; '' when the sheet gave none. */
  sampleCollectedAt: string;
  reportedAt: string;
  verifiedBy: string;
  interpretation: string;
  comments: string;
  /** A free-text report — a radiology test's findings. */
  manualContent: string;
  createdAt: string;
  rows: UploadedLabRow[];
}

const toText = (value: any): string => String(value ?? '').trim();
const toNumber = (value: any): number => Number(value ?? 0) || 0;

const RESULT_STATUSES: UploadedLabResultStatus[] = ['normal', 'high', 'low', 'unknown'];

const toResultStatus = (value: any): UploadedLabResultStatus => {
  const status = toText(value).toLowerCase() as UploadedLabResultStatus;
  return RESULT_STATUSES.includes(status) ? status : 'unknown';
};

const toRow = (raw: any): UploadedLabRow => ({
  serial: toNumber(raw?.serial),
  groupName: toText(raw?.groupName),
  attribute: toText(raw?.attribute),
  resultValue: toText(raw?.resultValue),
  unit: toText(raw?.unit),
  // A range can run over lines ("M: 13-17\nF: 12-15"); only the ends are trimmed.
  normalRange: String(raw?.normalRange ?? '').trim(),
  resultStatus: toResultStatus(raw?.resultStatus),
  methodName: toText(raw?.methodName),
});

export const toUploadedLabReport = (raw: any): UploadedLabReport => ({
  ...toRecordPatient(raw),
  uploadedLabReportId: toNumber(raw?.uploadedLabReportId),
  documentId: toNumber(raw?.documentId),
  fileUrl: toText(raw?.fileUrl),
  fileName: toText(raw?.fileName),
  extension: toText(raw?.extension),
  reportType: toText(raw?.reportType).toLowerCase() === 'radiology' ? 'radiology' : 'pathology',
  testName: toText(raw?.testName),
  department: toText(raw?.department),
  sampleType: toText(raw?.sampleType),
  labName: toText(raw?.labName),
  reportId: toText(raw?.reportId),
  referredBy: toText(raw?.referredBy),
  sampleCollectedAt: toText(raw?.sampleCollectedAt),
  reportedAt: toText(raw?.reportedAt),
  verifiedBy: toText(raw?.verifiedBy),
  interpretation: String(raw?.interpretation ?? '').trim(),
  comments: String(raw?.comments ?? '').trim(),
  manualContent: String(raw?.manualContent ?? '').trim(),
  createdAt: toText(raw?.createdAt),
  rows: (Array.isArray(raw?.rows) ? raw.rows : []).map(toRow),
});

export const UploadedLabReportRepository = {
  /** Every confirmed upload on the account. A non-list answer is a failure. */
  getUploadedLabReports: async (): Promise<UploadedLabReport[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.patientUploadedLabReports,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);
    if (!Array.isArray(response)) throw new Error('Unexpected uploaded lab reports response');
    return response.map(toUploadedLabReport).filter(report => report.uploadedLabReportId > 0);
  },

  /**
   * `DELETE …/lab-reports/{id}` — takes the test off the patient's records.
   * The file itself stays in My Uploads. 204 when removed, 404 when it is not theirs.
   */
  removeUploadedLabReport: async (uploadedLabReportId: number): Promise<void> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.patientUploadedLabReports}/${Number(uploadedLabReportId ?? 0) || 0}`,
      method: 'DELETE',
      baseUrl: API_URL,
    };
    await apiRequest<any>(api_params);
  },
};

export default UploadedLabReportRepository;
