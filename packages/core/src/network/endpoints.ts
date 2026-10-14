export const ENDPOINTS = {
  login: '/hms/auth/login',
  patientProfile: '/hms/patient/profile',
  patientProfileAll: '/hms/patient/profile/all',
  patientProfileAllergies: '/hms/patient/profile/allergies',
  patientProfileMedicalHistory: '/hms/patient/profile/medical-history',
  /** The registration a patient's profile is — where the profile is created and saved. */
  patientRegistration: '/hms/registration/patients',
  sendOtp: '/hms/auth/otp/send',
  verifyOtp: '/hms/auth/otp/verify',
  registerWithOtp: '/hms/auth/otp/register',
  forgotPassword: '/hms/auth/forgot-password',
  fileUpload: '/hms/FileUpload/upload',
  /** Serves a stored blob. Anonymous, so the url needs no token. */
  fileDownload: '/hms/FileUpload/download',
  // ── Find Doctors: the patient portal's doctor directory ────────────────────
  portalDoctorsSearch: '/hms/portal/doctors/SearchDoctors',
  portalDoctorById: '/hms/portal/doctors/GetDoctorById',
  portalDoctorFilterOptions: '/hms/portal/doctors/GetFilterOptions',
  // ── Find Doctors: booking with a doctor ────────────────────────────────────
  consultationDetail:
    '/hms/AppointmentConsultation/GetAppointmentConsultationDetail',
  consultationSlots:
    '/hms/AppointmentConsultation/GetAvailableAppointmentSlots',
  consultationCreateAppointment:
    '/hms/AppointmentConsultation/CreateAppointment',
  appointments: '/hms/appointments',
  /** One appointment in full, for its patient. */
  portalAppointmentDetail: '/hms/portal/appointments/GetAppointmentDetail',
  /** The patient's prescriptions, and one drawn as a PDF (outside the API's encryption). */
  portalPrescriptions: '/hms/portal/medical-records/GetMyPrescriptions',
  portalPrescriptionPdf: '/hms/portal/medical-records/GetPrescriptionPdf',
  /** Today's Medicines, as the portal binds it (both 404 on dev as of 2026-10-14). */
  todayMedicines: '/hms/prescriptions/today',
  medicineSchedule: '/hms/medicine-schedule',
  patientDocuments: '/hms/patient/documents',
  followUps: '/hms/followups',

  // ── Find Doctors: AI doctor finder — pepobot, on AI_ASSIST_URL ────────────
  /** A patient's symptoms into a recommended specialist and doctors from this hospital. */
  aiDoctorFind: '/hms_doctors_find',

  // ── AI voice — Whisper speech-to-text, on AI_STT_URL ──────────────────────
  /** A recording of a patient's symptoms into text. */
  aiTranscribe: '/transcribe',
};
