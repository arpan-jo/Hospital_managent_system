/** Who the prescription is for. */
export interface DeskPatient {
  name: string;
  mobile: string;
  /** Years, as free text — the portal's patient bar takes it the same way. */
  age: string;
  /** 'Male' | 'Female' | 'Other', or '' before it is picked. */
  gender: string;
  address: string;
  /**
   * Registration code, e.g. 'P-000123'. Empty until the patient is registered —
   * a walk-in gets one on the first save.
   */
  patientCode: string;
  /** The numeric id behind that code; 0 while unregistered. */
  registrationId: number;
  /**
   * Set only when the patient came in from the queue. It is what lets Save &
   * Show mark the appointment completed; a walk-in has no appointment to close.
   */
  appointmentId: number;
}

/**
 * What patient-scoped calls key off. The API takes a registration code, and a
 * profile without one is addressed by its registration id instead — the portal
 * does the same. Never shown as text: an id in a field labelled "Patient ID"
 * reads as a code that does not exist. The printed barcode does encode it, as
 * the portal's does, so the sheet still scans to the patient.
 */
export const patientLookupCode = (patient?: DeskPatient): string =>
  patient?.patientCode || (patient?.registrationId ? String(patient.registrationId) : '');
