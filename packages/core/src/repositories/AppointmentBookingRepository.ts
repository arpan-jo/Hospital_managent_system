/**
 * Booking an appointment with a doctor, as the patient portal does it: the
 * doctor's consultation terms (fees, the weekdays they sit), the windows open
 * on one date, and the booking itself. These are the calls behind the web's
 * doctor page, with the same parameters and the same request body.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { serverMessageOf } from '../network/serverMessage';

/** The visit types the portal books. Each is offered only when its fee is set. */
export type ConsultationType = 'new_patient' | 'follow_up' | 'report';

/** A doctor's terms for a visit — `DoctorConsultationDetailDto` on the API. */
export interface DoctorConsultationDetail {
  employeeId: number;
  doctorSpecialty: string;
  departmentName: string;
  /** A sub-specialty within the department, when one is set. */
  departmentSection: string;
  /** Where the visit takes place. */
  officeName: string;
  /** Ready to show as sent, e.g. "< 1 yr". */
  experience: string;
  /** The fee for a new patient. */
  fee: number;
  followUpFee: number;
  reportVisitFee: number;
  /** How many days a follow-up stays valid. */
  followUpValidDuration: number;
  /** The weekdays the doctor sits, as the API names them — "Mon", "Tue", … */
  scheduledDays: string[];
}

/** One bookable time inside a window. */
export interface ConsultationSubSlot {
  /** "14:09" — sent back verbatim when the patient picks this time. */
  startTime: string;
  endTime: string;
  isBooked: boolean;
  isPast: boolean;
}

/** One window of a doctor's day — `AvailableSlotDto` on the API. */
export interface AvailableSlot {
  slotId: number;
  day: string;
  startTime: string;
  endTime: string;
  bookingCapacity: number;
  bookedCount: number;
  /** Places still free in the window. */
  availableSlots: number;
  perPatientMinutes: number;
  subSlots: ConsultationSubSlot[];
}

export interface CreateConsultAppointmentInput {
  /** The doctor's `employeeId`. */
  doctorId: number;
  patientRegistrationId: number;
  accountId: number;
  branchId: number;
  officeId: number;
  /** The signed-in account. */
  userId: number;
  /** "YYYY-MM-DD". */
  appointmentDate: string;
  slotId: number;
  /**
   * A sub-slot's `startTime` when the patient picked one; '' lets the server
   * give the next free time in the window.
   */
  time: string;
  type: ConsultationType;
  reason: string;
  /** The fee of the chosen visit type. */
  paymentAmount: number;
}

/** What a booking answers with — `ConsultBookedResultDto` on the API. */
export interface ConsultBookedResult {
  appointmentId: number;
  /** The patient's token for the day. */
  serialNo: number;
  appointmentDate: string;
  time: string;
  status: string;
  paymentStatus: string;
}

/** The opening the server offers when the one asked for is gone. */
export interface SuggestedSlot {
  /** "YYYY-MM-DD". */
  date: string;
  startTime: string;
  time: string;
}

export type BookingFailureCode = 'SLOT_FULL' | 'SUB_SLOT_TAKEN' | '';

/** Why a booking was turned down, read off the error the API sent. */
export interface BookingFailure {
  code: BookingFailureCode;
  /** The server's own words; '' when it sent none. */
  message: string;
  suggestedSlot: SuggestedSlot | null;
}

const toText = (value: any): string => String(value ?? '').trim();

/**
 * The booking is given a minute, not the client's usual ten seconds: a request
 * that times out here may still be saved by the server, and trying again would
 * book the patient twice.
 */
const BOOKING_TIMEOUT_MS = 60_000;

const toNumber = (value: any): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toConsultationDetail = (raw: any): DoctorConsultationDetail => ({
  employeeId: toNumber(raw?.employeeId),
  doctorSpecialty: toText(raw?.doctorSpecialty),
  departmentName: toText(raw?.departmentName),
  departmentSection: toText(raw?.departmentSection),
  officeName: toText(raw?.officeName),
  experience: toText(raw?.experience),
  fee: toNumber(raw?.fee),
  followUpFee: toNumber(raw?.followUpFee),
  reportVisitFee: toNumber(raw?.reportVisitFee),
  followUpValidDuration: toNumber(raw?.followUpValidDuration),
  scheduledDays: Array.isArray(raw?.scheduleDays)
    ? raw?.scheduleDays
        ?.map((day: any) => toText(day?.day))
        ?.filter(Boolean) ?? []
    : [],
});

const toSubSlot = (raw: any): ConsultationSubSlot => ({
  startTime: toText(raw?.startTime),
  endTime: toText(raw?.endTime),
  isBooked: Boolean(raw?.isBooked),
  isPast: Boolean(raw?.isPast),
});

const toAvailableSlot = (raw: any): AvailableSlot => ({
  slotId: toNumber(raw?.slotId),
  day: toText(raw?.day),
  startTime: toText(raw?.startTime),
  endTime: toText(raw?.endTime),
  bookingCapacity: toNumber(raw?.bookingCapacity),
  bookedCount: toNumber(raw?.bookedCount),
  availableSlots: toNumber(raw?.availableSlots),
  perPatientMinutes: toNumber(raw?.perPatientMinutes),
  subSlots: Array.isArray(raw?.subSlots)
    ? raw?.subSlots?.map(toSubSlot) ?? []
    : [],
});

const toBookedResult = (raw: any): ConsultBookedResult => ({
  appointmentId: toNumber(raw?.appointmentId),
  serialNo: toNumber(raw?.serialNo),
  appointmentDate: toText(raw?.appointmentDate),
  time: toText(raw?.time),
  status: toText(raw?.status),
  paymentStatus: toText(raw?.paymentStatus),
});

/**
 * The reason behind a rejected booking. `apiRequest` rejects with the decoded
 * body on `data`: an object carrying `code` when the slot was lost to someone
 * else, and just a message — or a bare sentence — for anything else.
 */
export const toBookingFailure = (error: any): BookingFailure => {
  const data = error?.data;
  const code = toText(data?.code);
  const suggested = data?.suggestedSlot;

  return {
    code: code === 'SLOT_FULL' || code === 'SUB_SLOT_TAKEN' ? code : '',
    message: serverMessageOf(error),
    suggestedSlot:
      suggested && typeof suggested === 'object'
        ? {
            date: toText(suggested?.date),
            startTime: toText(suggested?.startTime),
            time: toText(suggested?.time),
          }
        : null,
  };
};

export const AppointmentBookingRepository = {
  /** `GET /hms/AppointmentConsultation/GetAppointmentConsultationDetail`. */
  getConsultationDetail: async (doctor: {
    employeeId: number;
    accountId: number;
    branchId: number;
  }): Promise<DoctorConsultationDetail> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.consultationDetail,
      method: 'GET',
      baseUrl: API_URL,
      params: {
        employeeId: toNumber(doctor?.employeeId),
        accountId: toNumber(doctor?.accountId),
        branchId: toNumber(doctor?.branchId),
      },
    };
    const response = await apiRequest<any>(api_params);

    return toConsultationDetail(response);
  },

  /**
   * `GET /hms/AppointmentConsultation/GetAvailableAppointmentSlots` — the
   * windows open on one date. An empty list is a real answer: the doctor does
   * not sit that day, or every window has already ended.
   */
  getAvailableSlots: async (query: {
    employeeId: number;
    accountId: number;
    branchId: number;
    /** "YYYY-MM-DD". */
    appointmentDate: string;
    patientRegistrationId: number;
  }): Promise<AvailableSlot[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.consultationSlots,
      method: 'GET',
      baseUrl: API_URL,
      params: {
        employeeId: toNumber(query?.employeeId),
        accountId: toNumber(query?.accountId),
        branchId: toNumber(query?.branchId),
        appointmentDate: toText(query?.appointmentDate),
        patientRegistrationId: toNumber(query?.patientRegistrationId),
      },
    };
    const response = await apiRequest<any>(api_params);

    return Array.isArray(response) ? response?.map(toAvailableSlot) ?? [] : [];
  },

  /**
   * `POST /hms/AppointmentConsultation/CreateAppointment`. A rejection is read
   * with `toBookingFailure`.
   */
  createAppointment: async (
    input: CreateConsultAppointmentInput,
  ): Promise<ConsultBookedResult> => {
    const paymentAmount = toNumber(input?.paymentAmount);

    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.consultationCreateAppointment,
      method: 'POST',
      baseUrl: API_URL,
      timeout: BOOKING_TIMEOUT_MS,
      // The body the web posts, field for field. A patient books for
      // themselves, so there is never a walk-in; payment is taken at the desk.
      data: {
        doctorId: toNumber(input?.doctorId),
        patientRegistrationId: toNumber(input?.patientRegistrationId),
        accountId: toNumber(input?.accountId),
        branchId: toNumber(input?.branchId),
        officeId: toNumber(input?.officeId),
        userId: toNumber(input?.userId),
        walkInPatient: null,
        appointmentDate: toText(input?.appointmentDate),
        slotId: toNumber(input?.slotId),
        time: toText(input?.time),
        type: input?.type,
        reason: input?.reason || null,
        paymentAmount: paymentAmount > 0 ? paymentAmount : null,
        paymentMethod: 'Cash',
      },
    };
    const response = await apiRequest<any>(api_params);

    return toBookedResult(response);
  },
};

export default AppointmentBookingRepository;
