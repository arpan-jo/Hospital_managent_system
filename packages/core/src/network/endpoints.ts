export const ENDPOINTS = {
  login: '/hms/auth/login',
  patientProfile: '/hms/patient/profile',
  patientProfileAll: '/hms/patient/profile/all',
  patientProfileAllergies: '/hms/patient/profile/allergies',
  patientProfileMedicalHistory: '/hms/patient/profile/medical-history',
  sendOtp: '/hms/auth/otp/send',
  verifyOtp: '/hms/auth/otp/verify',
  registerWithOtp: '/hms/auth/otp/register',
  forgotPassword: '/hms/auth/forgot-password',
  fileUpload: '/hms/FileUpload/upload',
  /** Serves a stored blob. Anonymous, so the url needs no token. */
  fileDownload: '/hms/FileUpload/download',
  filters: '/hms/doctors/filters',
  doctors: '/hms/doctors',
  appointments: '/hms/appointments',
  /** What the doctor recorded during a visit, keyed by its appointment. */
  consultations: '/hms/consultations',
  prescriptions: '/hms/prescriptions',
  prescriptionDoctors: '/hms/prescriptions/doctors',
  prescriptionsToday: '/hms/prescriptions/today',
  medicineSchedule: '/hms/medicine-schedule',
  patientDocuments: '/hms/patient/documents',
  followUps: '/hms/followups',

  // ── Find Doctors: AI doctor finder — pepobot, on AI_ASSIST_URL ────────────
  /** A patient's symptoms into a recommended specialist and doctors from this hospital. */
  aiDoctorFind: '/doctors_find',

  // ── AI voice — Whisper speech-to-text, on AI_STT_URL ──────────────────────
  /** A recording of a patient's symptoms into text. */
  aiTranscribe: '/transcribe',
};
