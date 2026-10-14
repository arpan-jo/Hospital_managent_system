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

export interface Appointment {
  id: string;
  /** `doctorUserId`. */
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
   * `strType`. Free text, so it is not narrowed: the portal books `new_patient`,
   * `follow_up` and `report`, and doctor-created rows carry others, e.g. `visit`.
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
};

export default AppointmentRepository;
