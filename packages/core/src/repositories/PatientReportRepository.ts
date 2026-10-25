/**
 * The patient's own documents — the Reports page's "My Uploads": files the
 * patient uploaded themselves, read and filed through `/hms/patient/documents`.
 * The same endpoint backs the documents a prescription card lists, which file
 * under a family member's `patientCode`.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import FileRepository, { UploadFile } from './FileRepository';

/**
 * The six the web's upload forms offer, in its order. The column behind them
 * (`tblPatientDocument.strCategory`) is free text with no whitelist, so a
 * category that arrives from elsewhere is kept as sent.
 */
export const DOCUMENT_CATEGORIES = [
  'Lab Report',
  'X-Ray / Scan',
  'Prescription',
  'Medical Certificate',
  'Discharge Summary',
  'Other',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** The ceiling the upload endpoint enforces per file, checked before sending as on the web. */
export const REPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Images and PDF. The web also takes SVG, but the app cannot draw one, so it
 * is not offered here; an SVG uploaded on the web can still be downloaded.
 */
export const REPORT_ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

/** One row of `GET /hms/patient/documents` — `PatientDocumentDto`. */
export interface PatientDocument {
  /** `documentId` — what the delete call keys off. */
  id: string;
  /** '' for the account's own documents; a family member's code otherwise. */
  patientCode: string;
  title: string;
  /** The name it was picked under, e.g. "cbc.pdf". */
  fileName: string;
  category: string;
  /** "PDF", "JPG"… — '' when the name has none. */
  extension: string;
  sizeBytes: number;
  /** As the server formats it, e.g. "14 Oct 2026". */
  uploadedAt: string;
  /** Blob name — run it through `getFileUrl` before opening or downloading. */
  url: string;
  notes: string;
}

const toText = (value: any): string => String(value ?? '').trim();

const toDocument = (raw: any, index: number): PatientDocument => {
  const fileName = toText(raw?.fileName) || toText(raw?.title);
  const extension =
    toText(raw?.extension).replace(/^\./, '') || (/\.([a-z0-9]+)$/i.exec(fileName)?.[1] ?? '');
  return {
    id: toText(raw?.documentId) || String(index),
    patientCode: toText(raw?.patientCode),
    title: toText(raw?.title) || fileName,
    fileName,
    category: toText(raw?.category) || 'Other',
    extension: extension.toUpperCase(),
    sizeBytes: Number(raw?.fileSize ?? 0) || 0,
    uploadedAt: toText(raw?.uploadedAt),
    url: toText(raw?.fileUrl),
    notes: toText(raw?.notes),
  };
};

/** `POST /hms/patient/documents` body — `CreatePatientDocumentDto`. */
export interface CreateReportPayload {
  category: string;
  title: string;
  /** Blob name returned by the upload call — not a URL. */
  fileUrl: string;
  fileName: string;
  fileSize: number;
  notes?: string;
  /**
   * Blank files the document under the account itself; the server lists those
   * by `patientCode IS NULL`, so blank goes up as `null`, never `''`.
   */
  patientCode?: string;
}

export const PatientReportRepository = {
  /**
   * `GET /hms/patient/documents` — sent without a `patientCode`, the server
   * answers the account's own documents only, newest first, as the web lists them.
   */
  getDocuments: async (): Promise<PatientDocument[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.patientDocuments,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    if (!Array.isArray(response)) throw new Error('Unexpected documents response');
    return response?.map(toDocument) ?? [];
  },

  /** The file crosses first and answers with a blob name, which `createReport` files. */
  uploadFile: async (file: UploadFile): Promise<string> => FileRepository.upload(file),

  /** `POST /hms/patient/documents`. */
  createReport: async (payload: CreateReportPayload): Promise<void> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.patientDocuments,
      method: 'POST',
      baseUrl: API_URL,
      data: {
        patientCode: payload?.patientCode?.trim() || null,
        category: payload?.category || 'Other',
        title: payload?.title?.trim() ?? '',
        fileUrl: payload?.fileUrl ?? '',
        fileName: payload?.fileName ?? '',
        fileSize: Number(payload?.fileSize ?? 0) || 0,
        notes: payload?.notes?.trim() || null,
      },
    };
    await apiRequest<any>(api_params);
  },

  /** `DELETE /hms/patient/documents/{documentId}`. */
  deleteReport: async (documentId: string): Promise<void> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.patientDocuments}/${encodeURIComponent(documentId ?? '')}`,
      method: 'DELETE',
      baseUrl: API_URL,
    };
    await apiRequest<any>(api_params);
  },
};

export default PatientReportRepository;
