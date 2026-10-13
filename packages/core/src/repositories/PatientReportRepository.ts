import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { getFileUrl } from '../utils/fileUrl';
import { toISODateFromApi } from '../utils/format';
import FileRepository, { UploadFile } from './FileRepository';

/**
 * The trailing `| string` this used to carry made the type effectively `string`,
 * so a `Record<ReportCategory, …>` lookup type-checked while returning
 * `undefined` at runtime — that is what crashed the report card. Keep it closed
 * and put every payload through `toReportCategory`.
 */
export type ReportCategory =
  | 'Prescription'
  | 'Laboratory'
  | 'Radiology and Imaging'
  | 'Other';

/**
 * `category` is free text on the API (`strCategory nvarchar(100)`, default
 * 'Other', no enum in swagger and no check constraint), and the clients that
 * wrote the older rows disagree on the wording — "Lab Report" and "X-Ray /
 * Scan" where the web now writes "Laboratory" and "Radiology and Imaging".
 * Matching on keywords keeps every row readable, and anything unrecognised
 * lands on 'Other' so the lookups built on this type always hit.
 */
export const toReportCategory = (value: any): ReportCategory => {
  const text = String(value ?? '').toLowerCase();

  if (text.includes('prescription')) return 'Prescription';
  if (text.includes('lab')) return 'Laboratory';
  if (/x-?ray|scan|radiolog|imaging|mri|ultraso|\bct\b/.test(text)) {
    return 'Radiology and Imaging';
  }
  return 'Other';
};

/** Every category a card or a filter chip can show. */
export const REPORT_CATEGORIES: ReportCategory[] = [
  'Prescription',
  'Laboratory',
  'Radiology and Imaging',
  'Other',
];

/**
 * What the upload form offers, in the web's order and wording — the three the
 * web writes to `strCategory`. 'Other' is deliberately absent: it is where
 * unrecognised legacy rows land, not something a patient files a new document
 * under.
 */
export const UPLOAD_REPORT_CATEGORIES: ReportCategory[] = [
  'Prescription',
  'Laboratory',
  'Radiology and Imaging',
];

/**
 * The ceiling the API enforces, mirrored only so the upload form can state it.
 * The client does not pre-check a file against it.
 */
export const REPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

export const REPORT_ALLOWED_EXTENSIONS = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
];

export interface PatientDocument {
  id: string;
  consultationId?: number | null;
  patientCode?: string;
  title: string;
  /** Filename including extension, e.g. "OIP.jpg". */
  fileName: string;
  category: ReportCategory;
  sizeBytes: number;
  /** 'YYYY-MM-DD' — '' when the payload carried no readable date. */
  uploadedAt: string;
  /** Ready to open or download; '' when the row stored no file. */
  url: string;
  notes?: string;
}

/** Defensive mapping — never trust the payload shape once this hits a real API. */
const toReport = (raw: any, index: number): PatientDocument => ({
  id: String(raw?.documentId ?? raw?.id ?? index),
  consultationId: raw?.consultationId != null ? Number(raw.consultationId) : null,
  patientCode: raw?.patientCode ?? '',
  title: raw?.title ?? raw?.fileName ?? 'Document',
  fileName: raw?.fileName ?? raw?.title ?? 'document',
  category: toReportCategory(raw?.category),
  sizeBytes: Number(raw?.fileSize ?? raw?.sizeBytes ?? 0),
  uploadedAt: toISODateFromApi(raw?.uploadedAt),
  url: getFileUrl(raw?.fileUrl ?? raw?.url ?? ''),
  notes: raw?.notes || undefined,
});

/** `POST /api/patient/documents` body (`CreatePatientDocumentDto`). */
export interface CreateReportPayload {
  category: string;
  title: string;
  /** Blob name returned by the upload call — not a URL. */
  fileUrl: string;
  fileName: string;
  fileSize: number;
  notes: string;
  /**
   * Documents are filed against a patient, not a visit. Left blank — which is
   * what the Reports screen sends, matching the web — the API files the
   * document against the signed-in account. Blank goes up as `null`: the
   * API stores the value as sent, and lists the account's own documents by
   * `patientCode IS NULL`, so one filed under `''` would never show again.
   */
  patientCode?: string;
  consultationId?: number | null;
}

export const PatientReportRepository = {
  /**
   * `GET /api/patient/documents`. Left without a `patientCode` the endpoint
   * answers the account's own documents, which is the whole Reports list.
   */
  getReports: async (patientCode?: string): Promise<PatientDocument[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.patientDocuments,
      method: 'GET',
      params: patientCode ? { patientCode } : undefined,
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return Array.isArray(response) ? response.map(toReport) : [];
  },

  /**
   * The file crosses to the server first and answers with a blob name; that
   * name is what `createReport` stores as `fileUrl`.
   */
  uploadFile: async (file: UploadFile): Promise<string> =>
    FileRepository.upload(file),

  /**
   * `POST /api/patient/documents`. The API echoes the stored row back, so the
   * created document is returned for the list to prepend — `null` when the
   * response carried nothing, which tells the caller to refetch instead.
   */
  createReport: async (
    payload: CreateReportPayload,
  ): Promise<PatientDocument | null> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.patientDocuments,
      method: 'POST',
      baseUrl: API_URL,
      data: {
        consultationId: payload?.consultationId ?? null,
        patientCode: payload?.patientCode?.trim() || null,
        category: payload?.category ?? 'Other',
        title: payload?.title ?? '',
        fileUrl: payload?.fileUrl ?? '',
        fileName: payload?.fileName ?? '',
        fileSize: Number(payload?.fileSize ?? 0),
        notes: payload?.notes ?? '',
      },
    };
    const response = await apiRequest<any>(api_params);

    return response?.documentId != null ? toReport(response, 0) : null;
  },

  /** `DELETE /api/patient/documents/{documentId}`. */
  deleteReport: async (documentId: string): Promise<void> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.patientDocuments}/${documentId}`,
      method: 'DELETE',
      baseUrl: API_URL,
    };
    await apiRequest<any>(api_params);
  },
};

export default PatientReportRepository;
