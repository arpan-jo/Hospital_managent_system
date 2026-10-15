/**
 * The patient's own appointments, as the portal's Appointments pages read
 * them: the list from `/hms/appointments`, one appointment in full from the
 * portal detail endpoint, and cancelling one.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';

export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Payment as the detail reports it; the API also writes "Refund" after a refund. */
export type AppointmentPaymentStatus = 'paid' | 'partial' | 'unpaid' | 'refund';

/** One row of the list. Only these fields are reliable there — the rest come from the detail. */
export interface AppointmentSummary {
  id: number;
  /** 'YYYY-MM-DD', the clinic's own day. */
  date: string;
  /** 'HH:mm', clinic-local. */
  time: string;
  status: AppointmentStatus;
  /** As booked: new_patient, follow_up, report, … */
  type: string;
  /** 0 when the appointment has none. */
  token: number;
  doctorName: string;
  doctorSpecialty: string;
  doctorDesignation: string;
  /** A stored file's id or a url — run it through `getFileUrl`. */
  doctorPhotoUrl: string;
  /** The consultation fee; 0 when none was recorded. */
  fee: number;
}

/** One appointment in full — `PortalAppointmentDetailDto`. */
export interface AppointmentDetail extends AppointmentSummary {
  reason: string;
  doctorNotes: string;
  /** Always false today: the backend no longer keeps consultations. */
  hasConsultation: boolean;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: AppointmentPaymentStatus;
  doctorEmployeeId: number;
  patientRegistrationId: number;
  patientName: string;
  patientCode: string;
  patientPhone: string;
  patientGender: string;
  /** Null when the patient has no date of birth. */
  patientAge: number | null;
  patientBloodType: string;
  locationName: string;
  locationAddress: string;
}

const NOT_FOUND = 404;

const toText = (value: any): string => String(value ?? '').trim();

const toNumber = (value: any): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * The API stores status in mixed case ("Confirmed", "cancelled", …). Read it
 * the portal's way: lower case, and anything unknown as pending.
 */
export const normalizeAppointmentStatus = (raw: any): AppointmentStatus => {
  const status = toText(raw)?.toLowerCase() as AppointmentStatus;
  return APPOINTMENT_STATUSES.includes(status) ? status : 'pending';
};

const toPaymentStatus = (raw: any): AppointmentPaymentStatus => {
  const status = toText(raw)?.toLowerCase();
  if (status === 'paid' || status === 'partial' || status === 'refund') return status;
  return 'unpaid';
};

const toSummary = (raw: any): AppointmentSummary => ({
  id: toNumber(raw?.appointmentId),
  date: toText(raw?.appointmentDate),
  time: toText(raw?.time),
  status: normalizeAppointmentStatus(raw?.status),
  type: toText(raw?.type)?.toLowerCase() ?? '',
  token: toNumber(raw?.tokenNumber),
  doctorName: toText(raw?.doctorName),
  doctorSpecialty: toText(raw?.doctorSpecialty),
  doctorDesignation: toText(raw?.doctorDesignation),
  doctorPhotoUrl: toText(raw?.doctorPhotoUrl),
  fee: toNumber(raw?.paymentAmount),
});

const toDetail = (raw: any): AppointmentDetail => ({
  ...toSummary(raw),
  reason: toText(raw?.reason),
  doctorNotes: toText(raw?.doctorNotes),
  hasConsultation: Boolean(raw?.hasConsultation),
  paidAmount: toNumber(raw?.paidAmount),
  dueAmount: toNumber(raw?.dueAmount),
  paymentStatus: toPaymentStatus(raw?.paymentStatus),
  doctorEmployeeId: toNumber(raw?.doctorEmployeeId),
  patientRegistrationId: toNumber(raw?.patientRegistrationId),
  patientName: toText(raw?.patientName),
  patientCode: toText(raw?.patientCode),
  patientPhone: toText(raw?.patientPhone),
  patientGender: toText(raw?.patientGender),
  patientAge:
    raw?.patientAge === null || raw?.patientAge === undefined ? null : toNumber(raw?.patientAge),
  patientBloodType: toText(raw?.patientBloodType),
  locationName: toText(raw?.locationName),
  locationAddress: toText(raw?.locationAddress),
});

export const AppointmentRepository = {
  /** `GET /hms/appointments` — the patient's appointments, newest first. */
  getAppointments: async (): Promise<AppointmentSummary[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.appointments,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return Array.isArray(response) ? response?.map(toSummary) ?? [] : [];
  },

  /**
   * `GET /hms/portal/appointments/GetAppointmentDetail?appointmentId=` — null
   * when there is no such appointment, or it is not the patient's.
   */
  getAppointmentDetail: async (appointmentId: number): Promise<AppointmentDetail | null> => {
    const id = toNumber(appointmentId);
    if (!id) return null;

    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalAppointmentDetail,
      method: 'GET',
      baseUrl: API_URL,
      params: { appointmentId: id },
    };

    try {
      const response = await apiRequest<any>(api_params);
      return toNumber(response?.appointmentId) ? toDetail(response) : null;
    } catch (error: any) {
      if (error?.status === NOT_FOUND) return null;
      throw error;
    }
  },

  /**
   * `PATCH /hms/portal/appointments/CancelAppointment?appointmentId=`, no body,
   * as the portal sends it. Answers the appointment as it now stands — null
   * when the answer carries none.
   */
  cancelAppointment: async (appointmentId: number): Promise<AppointmentDetail | null> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalAppointmentCancel,
      method: 'PATCH',
      baseUrl: API_URL,
      params: { appointmentId: toNumber(appointmentId) },
    };
    const response = await apiRequest<any>(api_params);
    return toNumber(response?.appointmentId) ? toDetail(response) : null;
  },
};

export default AppointmentRepository;
