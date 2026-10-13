import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { toTitleCase } from '../utils/format';

/**
 * `strStatus` on tblAppointments — nvarchar(20) with no check constraint,
 * defaulting to `pending`. These five are the values the API actually returns;
 * the appointments list groups them into its four tabs.
 */
export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
];

/**
 * `strType` on tblAppointments — free-text nvarchar(20), no check constraint,
 * defaulting to `in_person`. The values actually stored are `in_person`,
 * `follow_up`, `report` and `video` (`audio` matches the doctor's audio
 * consultation option); `visit` also appears but only on doctor-created rows,
 * so the patient app never sends it.
 */
export type AppointmentType =
  | 'in_person'
  | 'follow_up'
  | 'report'
  | 'audio'
  | 'video';

/** `strPaymentMethod` — cash, mobile_banking and cheque are in use today. */
export type PaymentMethod = 'cash' | 'card' | 'mobile_banking' | 'cheque';

export interface CreateAppointmentPayload {
  doctorUserId: string | number;
  locationId: string | number;
  /** 'YYYY-MM-DD'. */
  appointmentDate: string;
  /** 'HH:mm' — the slot's raw start time, not a formatted label. */
  time: string;
  type: AppointmentType;
  /** Identifies who the appointment is for, e.g. 'PAT-20260804-0002'. */
  patientCode: string;
  paymentMethod: PaymentMethod;
  /** Chief complaint. Omitted from the request when blank. */
  reason?: string;
}

export interface CreatedAppointment {
  appointmentId: number;
  doctorUserId: string;
  locationId: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  time: string;
  status: string;
  type: string;
  reason: string;
  tokenNumber: number;
  patientName: string;
  patientCode: string;
  doctorName: string;
  doctorSpecialty: string;
  locationName: string;
  locationAddress: string;
  paymentAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
  paymentMethod: string;
}

export interface Appointment {
  id: string;
  /** `doctorUserId` — the id the doctor details screen reads by. */
  doctorId: string;
  /**
   * `patientUserId`. One account holds several patient profiles, so the doctor's
   * patient screen needs it together with {@link Appointment.patientCode}.
   */
  patientUserId: number;
  locationId: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  /** Raw 'HH:mm' as stored — screens format it for display. */
  time: string;
  status: AppointmentStatus;
  /**
   * `strType`. Free text, so it is not narrowed to {@link AppointmentType}:
   * doctor-created rows carry values the patient app never books, e.g. `visit`.
   */
  type: string;
  /** Chief complaint. */
  reason: string;
  token: number;
  doctorNotes: string;
  createdAt: string;
  patientName: string;
  patientCode: string;
  patientAge: number;
  patientGender: string;
  patientBloodType: string;
  patientPhone: string;
  patientAddress: string;
  /** Blob name — run it through `getFileUrl` before rendering. */
  patientPhotoUrl: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorDesignation: string;
  /** Blob name — run it through `getFileUrl` before rendering. */
  doctorPhotoUrl: string;
  locationName: string;
  locationAddress: string;
  hasConsultation: boolean;
  /** `paymentAmount` — the chamber fee for this appointment. */
  fee: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  paymentReference: string;
  discountValue: number;
  /** 'percent' or 'amount'. */
  discountMode: string;
  /** Derived from `paymentStatus`, so cards do not repeat the comparison. */
  paid: boolean;
  symptoms: string;
  allergies: string;
  problemDescription: string;
  currentMedication: string;
}

const toText = (value: any): string => String(value ?? '').trim();

const toNumber = (value: any): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Anything the API has not seen before is treated as still pending. */
const toStatus = (raw: any): AppointmentStatus => {
  const status = toText(raw)?.toLowerCase() as AppointmentStatus;
  return APPOINTMENT_STATUSES.includes(status) ? status : 'pending';
};

/**
 * Defensive mapping — the payload is wide and every field can come back null.
 *
 * Exported because `/api/appointments/paged` answers with the very same rows:
 * the doctor's list maps them through this rather than keeping a second copy
 * that would drift the moment a field is added.
 */
export const toAppointment = (raw: any): Appointment => ({
  id: toText(raw?.appointmentId),
  doctorId: toText(raw?.doctorUserId),
  patientUserId: toNumber(raw?.patientUserId),
  locationId: toText(raw?.locationId),
  date: toText(raw?.appointmentDate)?.slice(0, 10) ?? '',
  time: toText(raw?.time),
  status: toStatus(raw?.status),
  type: toText(raw?.type),
  reason: toText(raw?.reason),
  token: toNumber(raw?.tokenNumber),
  doctorNotes: toText(raw?.doctorNotes),
  createdAt: toText(raw?.createdAt),
  patientName: toText(raw?.patientName),
  patientCode: toText(raw?.patientCode),
  patientAge: toNumber(raw?.patientAge),
  // Stored lowercase; every screen shows it as a label, so it is cased here
  // rather than in each of them.
  patientGender: toTitleCase(raw?.patientGender),
  patientBloodType: toText(raw?.patientBloodType),
  patientPhone: toText(raw?.patientPhone),
  patientAddress: toText(raw?.patientAddress),
  patientPhotoUrl: toText(raw?.patientPhotoUrl),
  doctorName: toText(raw?.doctorName),
  doctorSpecialty: toText(raw?.doctorSpecialty),
  doctorDesignation: toText(raw?.doctorDesignation),
  doctorPhotoUrl: toText(raw?.doctorPhotoUrl),
  locationName: toText(raw?.locationName),
  locationAddress: toText(raw?.locationAddress),
  hasConsultation: Boolean(raw?.hasConsultation),
  fee: toNumber(raw?.paymentAmount),
  paidAmount: toNumber(raw?.paidAmount),
  dueAmount: toNumber(raw?.dueAmount),
  paymentStatus: toText(raw?.paymentStatus),
  paymentMethod: toText(raw?.paymentMethod),
  paymentReference: toText(raw?.paymentReference),
  discountValue: toNumber(raw?.discountValue),
  discountMode: toText(raw?.discountMode),
  paid: toText(raw?.paymentStatus)?.toLowerCase() === 'paid',
  symptoms: toText(raw?.symptoms),
  allergies: toText(raw?.allergies),
  problemDescription: toText(raw?.problemDescription),
  currentMedication: toText(raw?.currentMedication),
});

/** The subset of the 201 body the booking flow actually renders. */
const toCreatedAppointment = (raw: any): CreatedAppointment => ({
  appointmentId: toNumber(raw?.appointmentId),
  doctorUserId: toText(raw?.doctorUserId),
  locationId: toText(raw?.locationId),
  date: toText(raw?.appointmentDate)?.slice(0, 10) ?? '',
  time: toText(raw?.time),
  status: toText(raw?.status),
  type: toText(raw?.type),
  reason: toText(raw?.reason),
  tokenNumber: toNumber(raw?.tokenNumber),
  patientName: toText(raw?.patientName),
  patientCode: toText(raw?.patientCode),
  doctorName: toText(raw?.doctorName),
  doctorSpecialty: toText(raw?.doctorSpecialty),
  locationName: toText(raw?.locationName),
  locationAddress: toText(raw?.locationAddress),
  paymentAmount: toNumber(raw?.paymentAmount),
  paidAmount: toNumber(raw?.paidAmount),
  dueAmount: toNumber(raw?.dueAmount),
  paymentStatus: toText(raw?.paymentStatus),
  paymentMethod: toText(raw?.paymentMethod),
});

export const AppointmentRepository = {
  /**
   * `GET /api/appointments`. The token identifies the patient, so the list
   * comes back already scoped to them — newest appointment first.
   */
  getAppointments: async (): Promise<Appointment[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.appointments,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return Array.isArray(response) ? response?.map(toAppointment) ?? [] : [];
  },

  /** `GET /api/appointments/{id}` — the same row shape as the list. */
  getAppointmentById: async (
    id: string | number,
  ): Promise<Appointment | null> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.appointments}/${encodeURIComponent(String(id ?? ''))}`,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return response ? toAppointment(response) : null;
  },

  /**
   * `PATCH /api/appointments/{id}/status`. Answers with the whole updated row,
   * so callers can drop what they were holding and keep this instead.
   */
  updateStatus: async (
    id: string | number,
    status: AppointmentStatus,
  ): Promise<Appointment | null> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.appointments}/${encodeURIComponent(
        String(id ?? ''),
      )}/status`,
      method: 'PATCH',
      baseUrl: API_URL,
      data: { status },
    };
    const response = await apiRequest<any>(api_params);

    return response ? toAppointment(response) : null;
  },

  /**
   * `POST /api/appointments`. The server owns the token number, the fee and the
   * payment status — the request never sends an amount, so the success screen
   * must render what comes back rather than what the form had.
   */
  createAppointment: async (
    payload: CreateAppointmentPayload,
  ): Promise<CreatedAppointment> => {
    const response = await apiRequest<any>({
      url: ENDPOINTS.appointments,
      method: 'POST',
      baseUrl: API_URL,
      data: {
        doctorUserId: toNumber(payload?.doctorUserId),
        locationId: toNumber(payload?.locationId),
        appointmentDate: payload?.appointmentDate ?? '',
        time: payload?.time ?? '',
        type: payload?.type ?? 'in_person',
        patientCode: payload?.patientCode ?? '',
        paymentMethod: payload?.paymentMethod ?? 'cash',
        // Optional fields the booking form does not collect yet — sent as null
        // so the shape always matches what the API documents.
        reason: payload?.reason?.trim() || null,
        symptoms: null,
        allergies: null,
        problemDescription: null,
        currentMedication: null,
        paymentReference: null,
        couponCode: null,
        receivableAmount: null,
      },
    });

    return toCreatedAppointment(response);
  },
};

export default AppointmentRepository;
