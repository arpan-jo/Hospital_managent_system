export const ENDPOINTS = {
  login: '/hms/auth/login',
  /** Ends the login on the server too — every older token of the account is refused after it. */
  logout: '/hms/auth/logout',
  patientProfile: '/hms/patient/profile',
  patientProfileAll: '/hms/patient/profile/all',
  patientProfileAllergies: '/hms/patient/profile/allergies',
  patientProfileMedicalHistory: '/hms/patient/profile/medical-history',
  /** The registration a patient's profile is — where the profile is created and saved. */
  patientRegistration: '/hms/registration/patients',
  sendOtp: '/hms/auth/otp/send',
  verifyOtp: '/hms/auth/otp/verify',
  registerWithOtp: '/hms/auth/otp/register',
  /**
   * A signed-in email account proves a mobile number (code from `sendOtp`) and
   * adopts the hospital-counter registrations carrying it.
   */
  linkPhone: '/hms/auth/otp/link-phone',
  forgotPassword: '/hms/auth/forgot-password',
  /** Forgot password by mobile: a reset code by SMS, then the reset with it. */
  sendResetOtp: '/hms/auth/otp/reset/send',
  resetWithOtp: '/hms/auth/otp/reset',
  fileUpload: '/hms/FileUpload/upload',
  /** Serves a stored blob. Anonymous, so the url needs no token. */
  fileDownload: '/hms/FileUpload/download',
  // ── Find Doctors: the patient portal's doctor directory ────────────────────
  portalDoctorsSearch: '/hms/portal/doctors/SearchDoctors',
  portalDoctorById: '/hms/portal/doctors/GetDoctorById',
  portalDoctorFilterOptions: '/hms/portal/doctors/GetFilterOptions',
  portalDoctorReviews: '/hms/portal/doctors/GetReviews',
  portalDoctorAddReview: '/hms/portal/doctors/AddReview',
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
  /** The patient cancels one of their own pending or confirmed appointments. */
  portalAppointmentCancel: '/hms/portal/appointments/CancelAppointment',
  /** Today's appointments and where each doctor's queue stands — the Queue Monitor's rule. */
  portalTodayQueue: '/hms/portal/appointments/GetTodayQueue',
  portalRescheduleAppointment: '/hms/portal/appointments/RescheduleAppointment',
  // ── Messages: the patient and the doctors they have seen ───────────────────
  /** Doctors a registration has had an appointment with — whom a new thread can go to. */
  portalMessageDoctors: '/hms/portal/messages/GetDoctors',
  /** Every thread of the account, latest first, with its last message and unread count. */
  portalMessageThreads: '/hms/portal/messages/GetThreads',
  /** One thread in full — reading it marks the doctor's messages as read. */
  portalMessageThread: '/hms/portal/messages/GetThread',
  portalMessageSend: '/hms/portal/messages/Send',
  // ── Home Collection: lab tests ordered from the portal ─────────────────────
  /** The home-collection charge an order for this registration will carry. */
  portalLabOrderInfo: '/hms/portal/lab-orders/GetInfo',
  /** The hospital's tests the registration can order — 50 at most, by name. */
  portalLabTestItems: '/hms/portal/lab-orders/GetTestItems',
  portalLabOrderCreate: '/hms/portal/lab-orders/Create',
  portalLabOrders: '/hms/portal/lab-orders/GetMyOrders',
  portalLabOrderCancel: '/hms/portal/lab-orders/Cancel',
  /** The patient's prescriptions, and one drawn as a PDF (outside the API's encryption). */
  portalPrescriptions: '/hms/portal/medical-records/GetMyPrescriptions',
  portalPrescriptionPdf: '/hms/portal/medical-records/GetPrescriptionPdf',
  /** One prescription in full — the Reports page's structured view. */
  portalPrescriptionDetail: '/hms/portal/medical-records/GetPrescription',
  /** Every lab or imaging test billed to the account, at any stage. */
  portalLabTests: '/hms/portal/medical-records/GetMyLabTests',
  /** `/{billRowId}/pdf` — one final test report as the printed sheet (outside the API's encryption). */
  portalLabReportPdf: '/hms/portal/medical-records/lab-reports',
  /** Every bill raised at the hospital for the account, with items and payments. */
  portalBills: '/hms/portal/medical-records/GetMyBills',
  /** Every vitals reading for the account's patients, newest first. */
  portalVitals: '/hms/portal/medical-records/GetMyVitals',
  /** One final radiology test's own images, as a link to the PACS viewer. */
  portalRadiologyImages: '/hms/portal/medical-records/GetRadiologyImages',
  /** Today's Medicines, as the portal binds it (both 404 on dev as of 2026-10-14). */
  todayMedicines: '/hms/prescriptions/today',
  medicineSchedule: '/hms/medicine-schedule',
  patientDocuments: '/hms/patient/documents',
  /** Lab reports the patient uploaded and confirmed after the AI read them. */
  patientUploadedLabReports: '/hms/patient/documents/lab-reports',
  /** Prescriptions the patient uploaded — DELETE `/{prescriptionId}` removes one. */
  patientUploadedPrescriptions: '/hms/patient/documents/prescriptions',
  /** The patient's follow-ups. */
  portalFollowUps: '/hms/portal/followups/GetMyFollowUps',
  /**
   * The signed-in user's notifications — the portal header's bell. The unread
   * count, marking read and deleting hang off this path.
   */
  notifications: '/hms/notifications',

  // ── Find Doctors: AI doctor finder — pepobot, on AI_ASSIST_URL ────────────
  /** A patient's symptoms into a recommended specialist and doctors from this hospital. */
  aiDoctorFind: '/hms_doctors_find',
  /**
   * An uploaded prescription or lab report read by the AI into fields the
   * patient reviews — multipart, as the portal sends it (pepobot, like the finder).
   */
  aiDocumentExtract: '/v1/documents/extract',

  // ── AI voice — Whisper speech-to-text, on AI_STT_URL ──────────────────────
  /** A recording of a patient's symptoms into text. */
  aiTranscribe: '/transcribe',
};
