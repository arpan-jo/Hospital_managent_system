/**
 * The patient's prescriptions, as the portal's My Prescriptions page has them:
 * the list from `GetMyPrescriptions`, each one opened as the PDF the server
 * draws (`GetPrescriptionPdf`), and the documents a card lists — those hang off
 * the patient (`patientCode`), not off the prescription.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import FileRepository, { UploadFile } from './FileRepository';
import PatientReportRepository from './PatientReportRepository';

/** Where the prescription was written. */
export type PrescriptionVisitType = 'opd' | 'emergency' | 'ipd';

/**
 * One row of `GET /hms/portal/medical-records/GetMyPrescriptions` — the
 * account's prescriptions, the patient's own and their family members', newest
 * first.
 */
export interface PortalPrescription {
  id: number;
  /** "RX-…"; '' when the record has none. */
  code: string;
  /** ISO time in UTC — show it as the patient's own day. */
  prescribedAt: string;
  departmentName: string;
  doctorName: string;
  visitType: PrescriptionVisitType;
  medicineCount: number;
  patientRegistrationId: number;
  patientName: string;
  patientCode: string;
}

/**
 * The six the web's upload form offers, in its order. The column behind them
 * (`tblPatientDocument.strCategory`) is free text, so a category that arrives
 * from elsewhere is kept as sent — only the picker is limited to these.
 */
export const ATTACHMENT_CATEGORIES = [
  'Lab Report',
  'X-Ray / Scan',
  'Prescription',
  'Medical Certificate',
  'Discharge Summary',
  'Other',
] as const;

export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

/**
 * One row of `GET /hms/patient/documents` — a file the patient attached.
 *
 * A document belongs to a **patient**, not to a visit: `patientCode` is the only
 * key the web narrows by, so every prescription card of the same patient lists
 * the same documents. The endpoint does take a `consultationId` filter, and this
 * flow deliberately never sends it — the same endpoint, unfiltered, backs the
 * Reports screen.
 */
export interface PrescriptionAttachment {
  /** `documentId` — what the delete call keys off. */
  id: string;
  patientCode: string;
  /** What the uploader named it. */
  title: string;
  /** `fileName`, e.g. "OIP.jpg"; the row reads its icon off the extension. */
  name: string;
  category: string;
  /** `fileSize` in bytes — 0 when the backend recorded none. */
  sizeBytes: number;
  /** Display date exactly as the payload sends it, e.g. "06 Aug 2026". */
  uploadedAt: string;
  /** Blob name — run it through `getFileUrl` before opening or downloading. */
  url: string;
  notes: string;
}

/** `POST /hms/patient/documents` body (`CreatePatientDocumentDto`). */
export interface CreateAttachmentPayload {
  /** Documents are filed against the patient — see `PrescriptionAttachment`. */
  patientCode: string;
  category: string;
  title: string;
  /** Blob name returned by the upload call. */
  fileUrl: string;
  fileName: string;
  fileSize: number;
  notes: string;
}

const toText = (value: any): string => String(value ?? '').trim();

const toVisitType = (raw: any): PrescriptionVisitType => {
  const value = toText(raw)?.toLowerCase();
  return value === 'emergency' || value === 'ipd' ? value : 'opd';
};

/** Defensive mapping — every field on the payload can come back null. */
const toPortalPrescription = (raw: any): PortalPrescription => ({
  id: Number(raw?.prescriptionId ?? 0) || 0,
  code: toText(raw?.prescriptionCode),
  prescribedAt: toText(raw?.prescribedAt),
  departmentName: toText(raw?.departmentName),
  doctorName: toText(raw?.doctorName),
  visitType: toVisitType(raw?.visitType),
  medicineCount: Number(raw?.medicineCount ?? 0) || 0,
  patientRegistrationId: Number(raw?.patientRegistrationId ?? 0) || 0,
  patientName: toText(raw?.patientName),
  patientCode: toText(raw?.patientCode),
});

const toAttachment = (raw: any, index: number): PrescriptionAttachment => ({
  id: toText(raw?.documentId) || String(index),
  patientCode: toText(raw?.patientCode),
  title: toText(raw?.title) || toText(raw?.fileName),
  // The extension has to survive: the row picks its icon from the file name.
  name: toText(raw?.fileName) || toText(raw?.title),
  category: toText(raw?.category) || 'Other',
  sizeBytes: Number(raw?.fileSize ?? 0),
  uploadedAt: toText(raw?.uploadedAt),
  url: toText(raw?.fileUrl),
  notes: toText(raw?.notes),
});

/**
 * These endpoints answer with a bare array. Anything else — an error envelope
 * that came back on a 200, or a payload whose shape changed — is a failure, not
 * an empty list, so it is thrown for the caller's `catch` to report instead of
 * the screen quietly rendering "nothing here".
 */
const toList = <T>(
  response: any,
  map: (raw: any, index: number) => T,
  subject: string,
): T[] => {
  if (Array.isArray(response)) return response.map(map);

  // Tolerate the rows arriving wrapped, the way some endpoints return them.
  const rows = response?.data ?? response?.items;
  if (Array.isArray(rows)) return rows.map(map);

  throw new Error(
    toText(response?.message) || `Could not read ${subject} from the server.`,
  );
};

export const PatientPrescriptionRepository = {
  /** `GET /hms/portal/medical-records/GetMyPrescriptions` — every prescription on the account. */
  getMyPrescriptions: async (): Promise<PortalPrescription[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalPrescriptions,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return toList(response, toPortalPrescription, 'prescriptions');
  },

  /**
   * Where one prescription's PDF is served. The route is outside the API's
   * encryption, so the id goes in plain; it needs the patient's login, which
   * `getFileHeaders` adds.
   */
  getPdfUrl: (prescriptionId: number): string =>
    `${API_URL}${ENDPOINTS.portalPrescriptionPdf}?prescriptionId=${Number(prescriptionId ?? 0) || 0}`,

  /** The name a saved PDF gets, as the portal names it. */
  getPdfFileName: (code?: string | null): string => {
    const safe = toText(code).replace(/\s+/g, '_');
    return safe ? `Prescription_${safe}.pdf` : 'Prescription.pdf';
  },

  /**
   * `GET /hms/patient/documents?patientCode=…` — every document of one family
   * member, which is the whole list a prescription card shows. Left blank the
   * endpoint answers the account's own documents.
   */
  getDocuments: async (
    patientCode: string,
  ): Promise<PrescriptionAttachment[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.patientDocuments,
      method: 'GET',
      baseUrl: API_URL,
      params: patientCode ? { patientCode } : {},
    };
    const response = await apiRequest<any>(api_params);

    return toList(response, toAttachment, 'documents');
  },

  /** Kept here so document callers need not know about `FileRepository`. */
  uploadFile: async (file: UploadFile): Promise<string> =>
    FileRepository.upload(file),

  /**
   * `POST /hms/patient/documents` — files an uploaded file under a patient.
   * The same endpoint backs the Reports screen, so the call lives once, in
   * `PatientReportRepository`; this keeps the attachment-shaped signature.
   */
  createDocument: async (payload: CreateAttachmentPayload): Promise<void> => {
    await PatientReportRepository.createReport({
      patientCode: payload?.patientCode ?? '',
      category: payload?.category ?? 'Other',
      title: payload?.title ?? '',
      fileUrl: payload?.fileUrl ?? '',
      fileName: payload?.fileName ?? '',
      fileSize: Number(payload?.fileSize ?? 0),
      notes: payload?.notes ?? '',
    });
  },

  /** `DELETE /hms/patient/documents/{documentId}`. */
  deleteDocument: async (documentId: string): Promise<void> =>
    PatientReportRepository.deleteReport(documentId),
};

export default PatientPrescriptionRepository;
