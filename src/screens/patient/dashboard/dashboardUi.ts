/** What the home screen works out from the portal's lists — the same sums the portal's dashboard makes. */
import { AppointmentSummary, LabTest } from '@app/core';

/** Booked and still ahead: the two stages a visit can be waited on in. */
const UPCOMING_STATUSES = ['pending', 'confirmed'];

/**
 * The next visit, as the portal's dashboard picks it: pending or confirmed, on
 * today or later, the earliest date first and, within a day, the earliest time.
 * Null when there is none.
 */
export const nextAppointmentOf = (
  appointments: AppointmentSummary[] | null | undefined,
  today: string,
): AppointmentSummary | null => {
  const upcoming = (appointments ?? []).filter(
    appointment =>
      UPCOMING_STATUSES.includes(appointment?.status ?? '') &&
      /^\d{4}-\d{2}-\d{2}/.test(appointment?.date ?? '') &&
      (appointment?.date ?? '').slice(0, 10) >= today,
  );
  upcoming.sort(
    (a, b) =>
      (a?.date ?? '').localeCompare(b?.date ?? '') || (a?.time ?? '').localeCompare(b?.time ?? ''),
  );
  return upcoming[0] ?? null;
};

/** Pathology and radiology together: how many reports are still to come and how many are ready. */
export const reportCountsOf = (tests: LabTest[] | null | undefined): { pending: number; ready: number } => {
  const rows = tests ?? [];
  const ready = rows.filter(test => test?.isReportReady).length;
  return { pending: rows.length - ready, ready };
};
