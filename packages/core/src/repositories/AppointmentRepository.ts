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

/**
 * One of the patient's appointments today and where the doctor's queue stands —
 * `PortalQueueStatusDto`, by the hospital Queue Monitor's own rule.
 */
export interface TodayQueueEntry {
  appointmentId: number;
  /** Lower-case: pending, confirmed, completed, cancelled, no_show. */
  status: string;
  /** 'HH:mm', or as sent when it is not. */
  time: string;
  /** The patient's own token; null when none was issued. */
  tokenNumber: number | null;
  doctorEmployeeId: number;
  doctorName: string;
  roomNumber: string;
  /** The token the doctor is seeing now; null while nobody has been called. */
  nowServingToken: number | null;
  /** Confirmed patients with a smaller token still waiting ahead. */
  aheadCount: number;
  /** This patient has been called in. */
  isCalled: boolean;
  patientName: string;
  patientRegistrationId: number;
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
  /** The doctor's hospital — the slot lookup a reschedule makes needs them. */
  accountId: number;
  branchId: number;
}

/** Where a pending appointment moves to — the portal's reschedule body. */
export interface RescheduleInput {
  appointmentId: number;
  /** "YYYY-MM-DD". */
  appointmentDate: string;
  slotId: number;
  /** "HH:mm" inside the window; '' leaves it to the server — the next free time. */
  time?: string;
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

/** A token is a positive whole number; anything else is "none". */
const toToken = (value: any): number | null => {
  const token = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(token) && token > 0
    ? token
    : null;
};

/**
 * The token the doctor is on. Null means nobody has been called yet. The server
 * sends 0 once someone is being seen who has no token or serial — the queue has
 * started all the same, as the portal reads it (`!= null`).
 */
const toServingToken = (value: any): number | null => {
  const token = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(token) && token >= 0
    ? token
    : null;
};

/** '09:30:00' → '09:30', so `to12Hour` reads it; anything else is kept as sent. */
const toClockTime = (value: any): string => {
  const text = toText(value);
  const match = /^(\d{1,2}:\d{2})(:\d{2})?$/.exec(text);
  return match ? match[1] : text;
};

const toQueueEntry = (raw: any): TodayQueueEntry => ({
  appointmentId: toNumber(raw?.appointmentId),
  status: toText(raw?.status)?.toLowerCase() ?? '',
  time: toClockTime(raw?.time),
  tokenNumber: toToken(raw?.tokenNumber),
  doctorEmployeeId: toNumber(raw?.doctorEmployeeId),
  doctorName: toText(raw?.doctorName),
  roomNumber: toText(raw?.roomNumber),
  nowServingToken: toServingToken(raw?.nowServingToken),
  aheadCount: Math.max(0, toNumber(raw?.aheadCount)),
  isCalled: Boolean(raw?.isCalled),
  patientName: toText(raw?.patientName),
  patientRegistrationId: toNumber(raw?.patientRegistrationId),
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
  accountId: toNumber(raw?.accountId),
  branchId: toNumber(raw?.branchId),
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

  /**
   * `GET /hms/portal/appointments/GetTodayQueue` — each of the account's
   * appointments today: its token, the token being seen now, how many are ahead.
   * Every stage comes back; the screen picks the ones still waiting.
   */
  getTodayQueue: async (): Promise<TodayQueueEntry[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalTodayQueue,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return Array.isArray(response)
      ? response.map(toQueueEntry).filter(entry => entry.appointmentId > 0)
      : [];
  },

  /**
   * `PATCH /hms/portal/appointments/RescheduleAppointment` — moves one of the
   * patient's own pending appointments, as the portal does. 404 when it is not
   * theirs; 400 and 409 carry the desk's words (closed day, slot full, not
   * pending). Answers with the appointment as it now stands.
   */
  rescheduleAppointment: async (input: RescheduleInput): Promise<AppointmentDetail | null> => {
    const time = toText(input?.time);
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalRescheduleAppointment,
      method: 'PATCH',
      baseUrl: API_URL,
      data: {
        appointmentId: toNumber(input?.appointmentId),
        appointmentDate: toText(input?.appointmentDate),
        slotId: toNumber(input?.slotId) || null,
        time: time || null,
      },
    };
    const response = await apiRequest<any>(api_params);

    return toNumber(response?.appointmentId) ? toDetail(response) : null;
  },
};

export default AppointmentRepository;
