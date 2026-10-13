import { ConsultationType } from '../screens/patient/findDoctors/useCreateAppointmentViewModel';

/**
 * The doctor/booking routes, shared by both stacks that can reach them: Find
 * Doctors (the Home tab) and the appointments list (the Activity tab). Keeping
 * the params in one place means the two stacks cannot drift apart.
 */
export type DoctorFlowStackParamList = {
  DoctorDetails: { doctorId: string };
  CreateAppointment: { doctorId: string; date?: string; slotStart?: string };
  /**
   * Everything the booking POST will need travels here as params: the confirm
   * screen re-reads the doctor for display only, never for the chosen values.
   */
  ConfirmAppointment: {
    doctorId: string;
    /** What the booking POST identifies the patient by, e.g. 'PAT-20260804-0002'. */
    patientCode: string;
    patientName: string;
    locationId: string;
    /** Chamber name, e.g. "Mediplex Hospital, Dhanmondi, Dhaka". */
    location: string;
    /** Chamber address, e.g. "Chamber 1, Block B". */
    locationAddress: string;
    consultationType: ConsultationType;
    amount: number;
    /** "2026-08-18". */
    date: string;
    /** Raw "09:00"/"13:00" — kept alongside the label for the booking payload. */
    slotStart: string;
    slotEnd: string;
    slotLabel: string;
    chiefComplaint: string;
  };
  BookingSuccess: {
    doctorId: string;
    date: string;
    slotLabel: string;
    token: number;
    amount: number;
    paymentMethod: string;
    location: string;
    /**
     * Filled in from the `POST /api/appointments` response. Optional because
     * the older two-step flow still lands here without them and falls back to
     * reading the doctor by id.
     */
    appointmentId?: number;
    doctorName?: string;
    doctorSpecialty?: string;
    patientName?: string;
    locationAddress?: string;
    dueAmount?: number;
    paymentStatus?: string;
  };
};
