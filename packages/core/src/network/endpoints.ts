export const ENDPOINTS = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  patientProfile: '/api/patient/profile',
  patientProfileAll: '/api/patient/profile/all',
  patientProfileAllergies: '/api/patient/profile/allergies',
  patientProfileMedicalHistory: '/api/patient/profile/medical-history',
  sendOtp: '/api/auth/otp/send',
  verifyOtp: '/api/auth/otp/verify',
  registerWithOtp: '/api/auth/otp/register',
  register: '/api/auth/register',
  forgotPassword: '/api/auth/forgot-password',
  fileUpload: '/api/FileUpload/upload',
  /**
   * Serves a stored blob to the app, taking the JWT as an `access_token` query
   * param instead of a header — React Native's new architecture drops the
   * `headers` on an `<Image>` source, so a header-authenticated url can never
   * render. The web portal keeps using `/download` (below), which authenticates
   * from the cookie a browser sends on its own.
   */
  fileMobileDownload: '/api/FileUpload/mobile',
  /**
   * Header/cookie-authenticated download — kept for reference. The app cannot
   * use it: `<Image>` sends no Authorization header, so every request 401s.
   * Confirmed against the live API on 2026-08-24.
   */
  // fileDownload: '/api/FileUpload/download',
  filters: '/api/doctors/filters',
  doctors: '/api/doctors',
  topDoctors: '/api/doctors/top',
  /** `GET /api/reviews/doctor/{doctorUserId}` — a doctor's rating summary and review feed. */
  doctorReviews: '/api/reviews/doctor',
  /**
   * The patient's own review of one visit: `POST /api/reviews` to leave it and
   * `GET /api/reviews/appointment/{appointmentId}` to read it back. An
   * appointment can only ever carry one.
   */
  reviews: '/api/reviews',
  appointments: '/api/appointments',
  /** What the doctor recorded during a visit, keyed by its appointment. */
  consultations: '/api/consultations',
  prescriptions: '/api/prescriptions',
  prescriptionDoctors: '/api/prescriptions/doctors',
  prescriptionsToday: '/api/prescriptions/today',
  medicineSchedule: '/api/medicine-schedule',
  patientDocuments: '/api/patient/documents',
  followUps: '/api/followups',
  /** Renders a prescription's HTML to a PDF. */
  prescriptionPdf: '/api/prescription-pdf',

  // ── Find Doctors: AI doctor finder — pepobot, on AI_ASSIST_URL ────────────
  /** A patient's symptoms into a recommended specialist and doctors from this hospital. */
  aiDoctorFind: '/doctors_find',

  // ── AI voice — Whisper speech-to-text, on AI_STT_URL ──────────────────────
  /** A recording of a patient's symptoms into text. */
  aiTranscribe: '/transcribe',
};
