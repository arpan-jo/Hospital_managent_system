/**
 * Reading an uploaded prescription or lab report, as the portal runs it: the
 * file goes to the AI (pepobot, `POST /v1/documents/extract`), which answers
 * with what it read; the patient checks and corrects it; and only then is it
 * saved — `POST /hms/patient/documents/{id}/prescription` or `…/lab-report`.
 * Nothing reaches the patient's records before that confirmation.
 */
import { AI_ASSIST_URL, API_URL } from '@env';
import axios from 'axios';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { attachAiLogging } from '../network/aiLogging';
import { ENDPOINTS } from '../network/endpoints';
import { UploadFile } from './FileRepository';

const readClient = axios.create({
  baseURL: AI_ASSIST_URL || '',
  headers: { Accept: 'application/json' },
});

attachAiLogging(readClient);

/** Reading a page takes the AI a while; the portal's proxy waits up to 120 s. */
const READ_TIMEOUT_MS = 120_000;

/** Below this the portal marks a line for the patient to check. */
export const LOW_CONFIDENCE = 0.6;

/** The durations the portal's review offers. */
export const DURATION_UNITS = ['Days', 'Weeks', 'Months', 'Years'];

/** How a lab result sits against its range, as the review sets it. */
export const LAB_RESULT_STATUSES = ['normal', 'high', 'low', 'unknown'] as const;

export type LabReportType = 'Pathology' | 'Radiology';

/** The two document categories the AI reads. */
export type ReadCategory = 'Prescription' | 'Lab Report';

export const READ_CATEGORIES: string[] = ['Prescription', 'Lab Report'];

// ── What the AI reads ────────────────────────────────────────────────────────

/** One medicine — the field names the Clinical Workstation saves, kept as they are. */
export interface ExtractedRxItem {
  type: string | null;
  generic: string | null;
  brand: string;
  route: string | null;
  dose: string | null;
  durationValue: string | null;
  durationUnit: string | null;
  isContinue: boolean;
  isMixed: boolean;
  note: string | null;
  multiDose: { dose: string | null; durationValue: string | null; durationUnit: string | null; note: string | null }[] | null;
  /** 0 to 1; the portal sets it to 1 once the patient edits the line. */
  confidence?: number;
}

export interface ExtractedPrescription {
  requestId: string;
  /** success | partial | not_prescription | unreadable | error */
  status: string;
  header: {
    doctorName: string | null;
    departmentName: string | null;
    hospitalName: string | null;
    /** 'YYYY-MM-DD' when the AI could read it. */
    prescriptionDate: string | null;
    patientName: string | null;
  };
  rx: ExtractedRxItem[];
  /** Complaints, diagnosis, tests, advice, follow-up — shown, and saved as read. */
  sections: Record<string, unknown> | null;
}

export interface ExtractedLabRow {
  serial: number;
  groupName: string | null;
  attribute: string;
  resultValue: string | null;
  unit: string | null;
  normalRange: string | null;
  resultStatus: string;
  methodName: string | null;
  confidence?: number;
}

export interface ExtractedLabTest {
  testName: string;
  department: string | null;
  sampleType: string | null;
  manualContent: string | null;
  interpretation: string | null;
  comments: string | null;
  confidence?: number;
  rows: ExtractedLabRow[];
}

export interface ExtractedLabReport {
  requestId: string;
  /** success | partial | not_lab_report | unreadable | error */
  status: string;
  header: {
    labName: string | null;
    reportId: string | null;
    referredBy: string | null;
    sampleCollectedAt: string | null;
    reportedAt: string | null;
    verifiedBy: string | null;
    patientName: string | null;
  };
  tests: ExtractedLabTest[];
}

// ── What is saved ────────────────────────────────────────────────────────────

export interface ConfirmPrescriptionInput {
  registrationId: number;
  doctorName: string | null;
  departmentName: string | null;
  hospitalName: string | null;
  /** 'YYYY-MM-DD'. */
  prescriptionDate: string | null;
  items: ExtractedRxItem[];
  sections: Record<string, unknown> | null;
}

export interface ConfirmLabReportInput {
  registrationId: number;
  reportType: LabReportType;
  labName: string | null;
  reportId: string | null;
  referredBy: string | null;
  sampleCollectedAt: string | null;
  reportedAt: string | null;
  verifiedBy: string | null;
  tests: ExtractedLabTest[];
}

// ── Mapping ──────────────────────────────────────────────────────────────────

/** Text as read, or null for nothing — the AI's own "not there". */
const toNullable = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};
const toText = (value: any): string => String(value ?? '').trim();
const toArray = (value: any): any[] => (Array.isArray(value) ? value : []);
const toConfidence = (value: any): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const toRxItem = (raw: any): ExtractedRxItem => {
  const multiDose = Array.isArray(raw?.multiDose)
    ? raw.multiDose.map((dose: any) => ({
        dose: toNullable(dose?.dose),
        durationValue: toNullable(dose?.durationValue),
        durationUnit: toNullable(dose?.durationUnit),
        note: toNullable(dose?.note),
      }))
    : null;
  const confidence = toConfidence(raw?.confidence);
  return {
    type: toNullable(raw?.type),
    generic: toNullable(raw?.generic),
    brand: toText(raw?.brand),
    route: toNullable(raw?.route),
    dose: toNullable(raw?.dose),
    durationValue: toNullable(raw?.durationValue),
    durationUnit: toNullable(raw?.durationUnit),
    isContinue: Boolean(raw?.isContinue),
    isMixed: Boolean(raw?.isMixed),
    note: toNullable(raw?.note),
    multiDose,
    ...(confidence !== undefined ? { confidence } : {}),
  };
};

export const toExtractedPrescription = (raw: any): ExtractedPrescription => ({
  requestId: toText(raw?.requestId),
  status: toText(raw?.status).toLowerCase(),
  header: {
    doctorName: toNullable(raw?.header?.doctorName),
    departmentName: toNullable(raw?.header?.departmentName),
    hospitalName: toNullable(raw?.header?.hospitalName),
    prescriptionDate: toNullable(raw?.header?.prescriptionDate),
    patientName: toNullable(raw?.header?.patientName),
  },
  rx: toArray(raw?.rx).map(toRxItem),
  sections: raw?.sections && typeof raw.sections === 'object' && !Array.isArray(raw.sections) ? raw.sections : null,
});

const toLabRow = (raw: any, index: number): ExtractedLabRow => {
  const confidence = toConfidence(raw?.confidence);
  return {
    serial: Number(raw?.serial ?? 0) || index + 1,
    groupName: toNullable(raw?.groupName),
    attribute: toText(raw?.attribute),
    resultValue: toNullable(raw?.resultValue),
    unit: toNullable(raw?.unit),
    // A range can run over lines; only its ends are trimmed.
    normalRange: toNullable(raw?.normalRange),
    resultStatus: toText(raw?.resultStatus).toLowerCase() || 'unknown',
    methodName: toNullable(raw?.methodName),
    ...(confidence !== undefined ? { confidence } : {}),
  };
};

const toLabTest = (raw: any): ExtractedLabTest => {
  const confidence = toConfidence(raw?.confidence);
  return {
    testName: toText(raw?.testName),
    department: toNullable(raw?.department),
    sampleType: toNullable(raw?.sampleType),
    manualContent: toNullable(raw?.manualContent),
    interpretation: toNullable(raw?.interpretation),
    comments: toNullable(raw?.comments),
    ...(confidence !== undefined ? { confidence } : {}),
    rows: toArray(raw?.rows).map(toLabRow),
  };
};

export const toExtractedLabReport = (raw: any): ExtractedLabReport => ({
  requestId: toText(raw?.requestId),
  status: toText(raw?.status).toLowerCase(),
  header: {
    labName: toNullable(raw?.header?.labName),
    reportId: toNullable(raw?.header?.reportId),
    referredBy: toNullable(raw?.header?.referredBy),
    sampleCollectedAt: toNullable(raw?.header?.sampleCollectedAt),
    reportedAt: toNullable(raw?.header?.reportedAt),
    verifiedBy: toNullable(raw?.header?.verifiedBy),
    patientName: toNullable(raw?.header?.patientName),
  },
  tests: toArray(raw?.tests).map(toLabTest),
});

// ── The portal's rules ───────────────────────────────────────────────────────

const READ_OK = ['success', 'partial'];

/** Worth a review: read in full or in part, with medicines or anything else on the sheet. */
export const isReadablePrescription = (read: ExtractedPrescription | null | undefined): boolean =>
  READ_OK.includes(read?.status ?? '') &&
  ((read?.rx?.length ?? 0) > 0 || Object.keys(read?.sections ?? {}).length > 0);

/** Worth a review: read in full or in part, with at least one test. */
export const isReadableLabReport = (read: ExtractedLabReport | null | undefined): boolean =>
  READ_OK.includes(read?.status ?? '') && (read?.tests?.length ?? 0) > 0;

/** The AI said the file is something else altogether — "not_prescription", "not_lab_report". */
export const isNotThatKind = (status: string | null | undefined): boolean => String(status ?? '').startsWith('not_');

const RADIOLOGY_HINT =
  /radiolog|imaging|x[\s-]?ray|ultra\s?so|\busg\b|sonogra|\bct\b|\bmri\b|echo\s?cardio|\becho\b|mammo|doppler|\bscan\b/i;

/** Radiology when any test looks like imaging, else Pathology — the patient can change it. */
export const guessLabReportType = (tests: ExtractedLabTest[] | null | undefined): LabReportType =>
  (tests ?? []).some(test =>
    RADIOLOGY_HINT.test(`${test?.testName ?? ''} ${test?.department ?? ''} ${test?.sampleType ?? ''}`),
  )
    ? 'Radiology'
    : 'Pathology';

/** "2026-10-28T09:30" or "2026-10-28" → "2026-10-28"; '' for anything else. */
export const datePart = (value: string | null | undefined): string =>
  value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';

/**
 * Why a prescription cannot be saved yet, as a key for the screen — null when
 * it can. The portal's own checks: whose it is, sizes, the date's shape, and a
 * name on every medicine (blank rows are dropped before this, not refused).
 */
export const prescriptionProblem = (input: ConfirmPrescriptionInput | null | undefined): string | null => {
  if (!((input?.registrationId ?? 0) > 0)) return 'forWhom';
  if ((input?.doctorName ?? '').length > 200) return 'doctorTooLong';
  if ((input?.hospitalName ?? '').length > 300) return 'hospitalTooLong';
  if (input?.prescriptionDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.prescriptionDate)) return 'date';
  if ((input?.items ?? []).some(item => !(item?.brand ?? '').trim())) return 'medicineName';
  return null;
};

/** Why a lab report cannot be saved yet — null when it can. Whose, which kind, and a named test or more. */
export const labReportProblem = (input: ConfirmLabReportInput | null | undefined): string | null => {
  if (!((input?.registrationId ?? 0) > 0)) return 'forWhom';
  if (input?.reportType !== 'Pathology' && input?.reportType !== 'Radiology') return 'reportType';
  if (!(input?.tests?.length ?? 0)) return 'noTests';
  if ((input?.tests ?? []).some(test => !(test?.testName ?? '').trim())) return 'testName';
  return null;
};

// ── Calls ────────────────────────────────────────────────────────────────────

const extract = async (
  file: UploadFile | null | undefined,
  documentId: number,
  category: ReadCategory,
): Promise<any> => {
  if (!AI_ASSIST_URL) throw new Error('The document reader is not configured');
  if (!file?.uri) throw new Error('There is no file to read');
  const form = new FormData();
  form.append('file', {
    uri: file?.uri ?? '',
    name: file?.name ?? 'file',
    type: file?.type ?? 'application/octet-stream',
  } as any);
  form.append('requestId', `doc-${Number(documentId ?? 0) || 0}`);
  form.append('category', category);
  form.append('languageHint', 'en,bn');
  // React Native sets the multipart type and its boundary itself (axios leaves it to it).
  const response = await readClient.post(ENDPOINTS.aiDocumentExtract, form, { timeout: READ_TIMEOUT_MS });
  return response?.data;
};

export const DocumentReadRepository = {
  /** The AI's read of an uploaded prescription — the same file that was just saved. */
  readPrescription: async (file: UploadFile | null | undefined, documentId: number): Promise<ExtractedPrescription> =>
    toExtractedPrescription(await extract(file, documentId, 'Prescription')),

  /** The AI's read of an uploaded lab report. */
  readLabReport: async (file: UploadFile | null | undefined, documentId: number): Promise<ExtractedLabReport> =>
    toExtractedLabReport(await extract(file, documentId, 'Lab Report')),

  /** `POST …/documents/{id}/prescription` — saves the reviewed prescription to the profile. */
  confirmPrescription: async (documentId: number, input: ConfirmPrescriptionInput): Promise<void> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.patientDocuments}/${Number(documentId ?? 0) || 0}/prescription`,
      method: 'POST',
      baseUrl: API_URL,
      data: input,
    };
    await apiRequest<any>(api_params);
  },

  /** `POST …/documents/{id}/lab-report` — saves the reviewed report under Pathology or Radiology. */
  confirmLabReport: async (documentId: number, input: ConfirmLabReportInput): Promise<void> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.patientDocuments}/${Number(documentId ?? 0) || 0}/lab-report`,
      method: 'POST',
      baseUrl: API_URL,
      data: input,
    };
    await apiRequest<any>(api_params);
  },
};

export default DocumentReadRepository;
