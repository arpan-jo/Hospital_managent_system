/** How a prescription reads on screen — shared by the list, its card and the upload form. */
import { PrescriptionVisitType, toISODate, withDoctorTitle } from '@app/core';

/**
 * The day a prescription was written, on the patient's own calendar.
 * `prescribedAt` comes in UTC, so a late-evening visit in Dhaka would otherwise
 * show the next day. '' when the time cannot be read.
 */
export const prescriptionDay = (prescribedAt?: string | null): string => {
  const date = new Date(String(prescribedAt ?? ''));
  return Number.isNaN(date.getTime()) ? '' : toISODate(date);
};

/** The portal's doctor title: "Dr." in front unless the name already carries a title. */
export const doctorTitle = (name?: string | null, fallback = ''): string =>
  withDoctorTitle(name) || fallback;

export const VISIT_LABEL_KEY: Record<PrescriptionVisitType, string> = {
  opd: 'myPrescriptions.visit.opd',
  emergency: 'myPrescriptions.visit.emergency',
  ipd: 'myPrescriptions.visit.ipd',
};
