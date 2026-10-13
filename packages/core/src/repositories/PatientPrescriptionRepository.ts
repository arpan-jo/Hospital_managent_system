/**
 * The patient's prescriptions, end to end: the list, the printed record behind
 * one row, the medicines due today, the reminder times those doses fire at, and
 * the documents a card lists.
 *
 * Two keys, not one. A row's id keys the record itself — the detail. The
 * payload calls it `consultationId`, but it is the **prescription id**
 * (`tblPrescriptionEntries`): every row of `GET /api/prescriptions` lines up
 * with the prescription of the same id, `medicineCount` included. The name is
 * the API's; the meaning is what the calls actually do. The row's `patientCode`
 * keys the documents — those hang off the patient, not off the visit.
 *
 * The doctor-side prescription *setup* lives on its own screens and does not
 * share this data.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import FileRepository, { UploadFile } from './FileRepository';
import PatientReportRepository from './PatientReportRepository';

/**
 * One dosing slot of the day. Single source of truth for the Today's Medicines
 * tabs and the reminder rows — they cannot drift apart because both read this.
 */
export type DoseSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export const DOSE_SLOTS: DoseSlot[] = [
  'morning',
  'afternoon',
  'evening',
  'night',
];

/** Reminder time per slot as 'HH:mm' — `MedicineScheduleDto` in app shape. */
export type ReminderSchedule = Record<DoseSlot, string>;

/** Only used until the first `GET /api/medicine-schedule` answers. */
export const DEFAULT_REMINDER_SCHEDULE: ReminderSchedule = {
  morning: '08:00',
  afternoon: '14:00',
  evening: '18:00',
  night: '21:00',
};

/** One row of `GET /api/prescriptions` — the account's prescriptions, the
 *  signed-in patient's own and their family members'. */
export interface PrescriptionListItem {
  /** `consultationId` on the payload — a prescription id, see the file header. */
  id: string;
  /** Sent as 0 on every row so far; kept because the payload carries it. */
  appointmentId: string;
  /** 'YYYY-MM-DD' — `appointmentDate` on the payload. */
  issuedAt: string;
  doctorName: string;
  /** `doctorSpecialty`, trimmed — the payload pads it (" Cardiology"). */
  specialty: string;
  /** Blob name — run it through `getFileUrl` before rendering. */
  doctorPhotoUrl: string;
  /** Sent as null on every row so far. */
  diagnosis: string;
  medicineCount: number;
  patientName: string;
  /** Joins a row to a family member — the list carries no patient id. */
  patientCode: string;
}

/** An option of `GET /api/prescriptions/doctors`. */
export interface PrescriptionDoctor {
  /** `userId` — what the list's `doctorUserId` filter expects. */
  id: string;
  name: string;
}

/**
 * The filters `GET /api/prescriptions` takes. There is deliberately no patient
 * filter: the endpoint has none, so the member chip and the name/code search
 * are applied on the client against `patientCode` / `patientName`.
 */
export interface PrescriptionListQuery {
  doctorUserId?: string;
  /** 'YYYY-MM-DD'. */
  fromDate?: string;
  /** 'YYYY-MM-DD'. */
  toDate?: string;
}

/**
 * One dose line of a medicine. Most medicines have a single line; a course the
 * doctor split into stages ("2 days at 1+0+1, then 3 days at 2+0+2") arrives as
 * several, and the record prints one row each.
 */
export interface MedicineDoseLine {
  /** The doctor's own pattern, verbatim — "1-0-1", "1+0+1". */
  dose: string;
  /** "5 Days" as the record prints it; '' when no number was recorded. */
  duration: string;
  /** "After meal", "Before meal", … */
  instruction: string;
}

/** One medicine of a prescription (`PrescriptionDto`, `tblPrescriptions`). */
export interface PrescribedMedicine {
  /** `prescriptionId`. */
  id: string;
  /** Brand and strength as the doctor wrote it, e.g. "Paracetamol 500mg". */
  name: string;
  /** Generic name, printed beside the brand — '' unless the Rx carries both. */
  generic: string;
  dosage: string;
  /** `formType` — Tablet, Syrup, Capsule … */
  form: string;
  /** The doctor's own pattern, stored verbatim, e.g. "1-0-1". */
  frequency: string;
  /** `frequency` read as slots, for the Today's Medicines tabs. */
  slots: DoseSlot[];
  /** "5 Days" as the record prints it; '' when no number was recorded. */
  duration: string;
  /** `instructions` — "After meal", "Before meal", … */
  instruction: string;
  /** Every dose row of the course — one entry mirrors `frequency`/`duration`. */
  doses: MedicineDoseLine[];
  route: string;
  type: string;
  /** Marked to continue past this prescription. */
  isContinue: boolean;
}

/** `GET /api/prescriptions/{prescriptionId}` — the record behind one row. */
export interface PrescriptionDetail {
  /** `consultationId` on the payload — a prescription id, see the file header. */
  id: string;
  appointmentId: string;
  /** Printed reference, e.g. "RX-20260811-0027". */
  rxId: string;
  /** 'YYYY-MM-DD'. */
  issuedAt: string;
  doctorName: string;
  specialty: string;
  doctorQualification: string;
  /** Blob name — run it through `getFileUrl` before rendering. */
  doctorPhotoUrl: string;
  hospital: string;
  bmdcRegNo: string;
  chamberAddress: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientMrNo: string;
  patientCode: string;
  diagnosis: string;
  doctorAdvice: string;
  consultationNotes: string;
  /** 'YYYY-MM-DD', or '' when no follow-up was set. */
  nextVisit: string;
  medicines: PrescribedMedicine[];
}

/** One row of `GET /api/prescriptions/today` — a dose due today. */
export interface TodayMedicine extends PrescribedMedicine {
  consultationId: string;
  doctorName: string;
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
 * One row of `GET /api/patient/documents` — a file the patient attached.
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

/** `POST /api/patient/documents` body (`CreatePatientDocumentDto`). */
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

/** "120.00" -> "120"; the payload pads vitals and durations with zeros. */
const trimDecimals = (value: any): string => toText(value).replace(/\.0+$/, '');

/**
 * "1-0-1" -> the slots the dose fires in.
 *
 * The doctor types the pattern and the backend stores it verbatim, so its
 * length varies. Each length is spread over the four slots the reminder
 * schedule keeps:
 *
 *   "1"        -> morning
 *   "1-1"      -> morning, night
 *   "1-0-1"    -> morning, afternoon, night
 *   "1-0-1-0"  -> morning, afternoon, evening, night
 *
 * A pattern with no digits at all (free text such as "SOS") falls back to the
 * morning tab, so the medicine is listed somewhere rather than vanishing — the
 * card shows the pattern verbatim either way.
 */
export const parseFrequencySlots = (
  frequency: string | undefined | null,
): DoseSlot[] => {
  const parts = toText(frequency)
    .split(/[^0-9½.]+/)
    .filter(Boolean);

  if (parts.length === 0) return ['morning'];

  const SLOTS_BY_LENGTH: Record<number, DoseSlot[]> = {
    1: ['morning'],
    2: ['morning', 'night'],
    3: ['morning', 'afternoon', 'night'],
    4: DOSE_SLOTS,
  };
  const layout = SLOTS_BY_LENGTH[parts.length] ?? DOSE_SLOTS;

  const slots = layout.filter(
    (_, index) => Number(parts[index] ?? 0) > 0 || parts[index] === '½',
  );
  return slots.length > 0 ? slots : ['morning'];
};

/** Defensive mapping — every field on the payload can come back null. */
const toPrescriptionListItem = (raw: any): PrescriptionListItem => ({
  id: toText(raw?.consultationId),
  appointmentId: toText(raw?.appointmentId),
  issuedAt: toText(raw?.appointmentDate).slice(0, 10),
  doctorName: toText(raw?.doctorName),
  specialty: toText(raw?.doctorSpecialty),
  doctorPhotoUrl: toText(raw?.doctorPhotoUrl),
  diagnosis: toText(raw?.diagnosis),
  medicineCount: Number(raw?.medicineCount ?? 0),
  patientName: toText(raw?.patientName),
  patientCode: toText(raw?.patientCode),
});

const toPrescriptionDoctor = (raw: any): PrescriptionDoctor => ({
  id: toText(raw?.userId),
  name: toText(raw?.fullName),
});

/**
 * The course length as the record prints it. `GET /api/prescriptions/{id}`
 * sends `duration` already joined with its unit ("5 Days") — and sends the bare
 * unit ("Days") when the doctor left the number out, which says nothing and is
 * dropped. Rows that still carry `durationUnit` separately are joined here.
 */
const toDuration = (raw: any): string => {
  const value = trimDecimals(raw?.duration);
  const unit = toText(raw?.durationUnit);
  const text =
    unit && !value.toLowerCase().includes(unit.toLowerCase())
      ? [value, unit].filter(Boolean).join(' ')
      : value;

  return /\d/.test(text) ? text : '';
};

const toMedicine = (raw: any, index: number): PrescribedMedicine => {
  const frequency = toText(raw?.frequency);
  const duration = toDuration(raw);
  const instruction = toText(raw?.instructions);

  return {
    id: toText(raw?.prescriptionId) || String(index),
    name: toText(raw?.medicine),
    // The consultation's own rows carry one name; only the pad splits the two.
    generic: '',
    dosage: toText(raw?.dosage),
    form: toText(raw?.formType),
    frequency,
    slots: parseFrequencySlots(frequency),
    duration,
    instruction,
    doses: [{ dose: frequency, duration, instruction }],
    route: toText(raw?.route),
    type: toText(raw?.type),
    isContinue: Boolean(raw?.isContinue),
  };
};

const toPrescriptionDetail = (raw: any): PrescriptionDetail => ({
  id: toText(raw?.consultationId),
  appointmentId: toText(raw?.appointmentId),
  rxId: toText(raw?.rxId),
  issuedAt: toText(raw?.appointmentDate).slice(0, 10),
  doctorName: toText(raw?.doctorName),
  specialty: toText(raw?.doctorSpecialty),
  doctorQualification: toText(raw?.doctorQualification),
  doctorPhotoUrl: toText(raw?.doctorPhotoUrl),
  hospital: toText(raw?.doctorHospital),
  bmdcRegNo: toText(raw?.doctorBmdcNo),
  chamberAddress: toText(raw?.doctorClinicAddress),
  patientName: toText(raw?.patientName),
  patientAge: Number(raw?.patientAge ?? 0),
  patientGender: toText(raw?.patientGender),
  patientMrNo: toText(raw?.patientMrNo),
  patientCode: toText(raw?.patientCode),
  diagnosis: toText(raw?.diagnosis),
  doctorAdvice: toText(raw?.doctorAdvice),
  consultationNotes: toText(raw?.consultationNotes),
  nextVisit: toText(raw?.followUpDate).slice(0, 10),
  medicines: Array.isArray(raw?.medicines) ? raw.medicines.map(toMedicine) : [],
});

/**
 * A dose row carries its medicine fields plus who prescribed it and for whom.
 * The endpoint has no schema in swagger, so the context fields are read through
 * the names the rest of the API uses for them.
 */
const toTodayMedicine = (raw: any, index: number): TodayMedicine => ({
  ...toMedicine(raw, index),
  consultationId: toText(raw?.consultationId),
  doctorName: toText(raw?.doctorName),
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

const toReminderSchedule = (raw: any): ReminderSchedule => ({
  morning:
    toText(raw?.morningTime).slice(0, 5) || DEFAULT_REMINDER_SCHEDULE.morning,
  afternoon:
    toText(raw?.afternoonTime).slice(0, 5) ||
    DEFAULT_REMINDER_SCHEDULE.afternoon,
  evening:
    toText(raw?.eveningTime).slice(0, 5) || DEFAULT_REMINDER_SCHEDULE.evening,
  night: toText(raw?.nightTime).slice(0, 5) || DEFAULT_REMINDER_SCHEDULE.night,
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
  /**
   * `GET /api/prescriptions`. The token scopes the rows to the account, so the
   * response already covers the patient and their family members.
   */
  getPrescriptions: async (
    query: PrescriptionListQuery = {},
  ): Promise<PrescriptionListItem[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.prescriptions,
      method: 'GET',
      baseUrl: API_URL,
      // Blank filters are left off so the server never reads '' as a value.
      params: {
        ...(query?.doctorUserId ? { doctorUserId: query.doctorUserId } : {}),
        ...(query?.fromDate ? { fromDate: query.fromDate } : {}),
        ...(query?.toDate ? { toDate: query.toDate } : {}),
      },
    };
    const response = await apiRequest<any>(api_params);

    return toList(response, toPrescriptionListItem, 'prescriptions');
  },

  /** `GET /api/prescriptions/doctors` — only doctors who issued a record. */
  getDoctors: async (): Promise<PrescriptionDoctor[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.prescriptionDoctors,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return toList(response, toPrescriptionDoctor, 'doctors');
  },

  /** `GET /api/prescriptions/{prescriptionId}` — the record behind one row. */
  getPrescriptionDetail: async (
    prescriptionId: string,
  ): Promise<PrescriptionDetail> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.prescriptions}/${prescriptionId}`,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    // An error envelope on a 200 would otherwise map to a blank record.
    if (!response?.consultationId) {
      throw new Error(
        toText(response?.message) ||
          'Could not read this prescription from the server.',
      );
    }

    return toPrescriptionDetail(response);
  },

  /** `GET /api/prescriptions/today` — doses due today, for one member or all. */
  getTodaysMedicines: async (
    patientCode?: string,
  ): Promise<TodayMedicine[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.prescriptionsToday,
      method: 'GET',
      baseUrl: API_URL,
      params: patientCode ? { patientCode } : {},
    };
    const response = await apiRequest<any>(api_params);

    return toList(response, toTodayMedicine, "today's medicines");
  },

  /** `GET /api/medicine-schedule` — the four reminder times. */
  getReminderSchedule: async (): Promise<ReminderSchedule> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.medicineSchedule,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return toReminderSchedule(response);
  },

  /**
   * `PUT /api/medicine-schedule`. The offset goes with the times so the server
   * can fire reminders in the patient's own timezone.
   */
  saveReminderSchedule: async (
    schedule: ReminderSchedule,
  ): Promise<ReminderSchedule> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.medicineSchedule,
      method: 'PUT',
      baseUrl: API_URL,
      data: {
        morningTime: schedule?.morning ?? DEFAULT_REMINDER_SCHEDULE.morning,
        afternoonTime:
          schedule?.afternoon ?? DEFAULT_REMINDER_SCHEDULE.afternoon,
        eveningTime: schedule?.evening ?? DEFAULT_REMINDER_SCHEDULE.evening,
        nightTime: schedule?.night ?? DEFAULT_REMINDER_SCHEDULE.night,
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
      },
    };
    const response = await apiRequest<any>(api_params);

    return toReminderSchedule(response);
  },

  /**
   * `GET /api/patient/documents?patientCode=…` — every document of one family
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
   * `POST /api/patient/documents` — files an uploaded file under a patient.
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

  /** `DELETE /api/patient/documents/{documentId}`. */
  deleteDocument: async (documentId: string): Promise<void> =>
    PatientReportRepository.deleteReport(documentId),
};

export default PatientPrescriptionRepository;
