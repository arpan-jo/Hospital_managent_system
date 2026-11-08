/** How a prescription reads on screen — shared by the list, its card and the upload form. */
import { PortalPrescription, PrescriptionVisitType, toISODate, withDoctorTitle } from '@app/core';

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

type PrescriptionLike =
  | Partial<
      Pick<
        PortalPrescription,
        'doctorName' | 'code' | 'visitType' | 'prescribedAt' | 'isUploaded' | 'sourceHospitalName' | 'sourceDate'
      >
    >
  | null
  | undefined;

/**
 * What kind of prescription it is, as a label key: the visit it was written at,
 * or "Uploaded" for one the patient uploaded — never "OPD" for that.
 */
export const prescriptionKindKey = (rx?: PrescriptionLike): string =>
  rx?.isUploaded
    ? 'myPrescriptions.uploaded'
    : VISIT_LABEL_KEY[rx?.visitType ?? 'opd'] ?? VISIT_LABEL_KEY.opd;

/**
 * The date a prescription goes by — `prescribedAt`, as the portal shows it
 * everywhere, an upload included (there it is when it was saved). The same date
 * the From/To filter tests and the server sorts by, so what a card shows and
 * where it falls never disagree.
 */
export const prescribedOn = (rx?: PrescriptionLike): string => rx?.prescribedAt || '';

/**
 * Its name in a list: the doctor, else its code, else — for an upload, which has
 * neither — the hospital or chamber on its sheet, else the fallback.
 */
export const prescriptionTitle = (rx: PrescriptionLike, fallback = ''): string =>
  doctorTitle(rx?.doctorName) || rx?.code || rx?.sourceHospitalName || fallback;
