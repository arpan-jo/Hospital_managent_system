import { ScheduleSlot } from '../repositories/DoctorRepository';

export interface BookingTotals {
  discountAmount: number;
  netPayable: number;
  dueAmount: number;
}

const round2 = (value: number): number =>
  Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
};

/**
 * Money path for the booking sheet. Inputs come straight off text fields, so
 * every one is clamped: a discount outside 0–100% or a negative receivable
 * must never produce a negative payable or a negative due.
 */
export const calculateBookingTotals = (
  amount: number,
  discountPercent: number,
  receivable: number,
): BookingTotals => {
  const safeAmount = Math.max(Number.isFinite(amount) ? amount : 0, 0);
  const percent = clamp(discountPercent, 0, 100);

  const discountAmount = round2((safeAmount * percent) / 100);
  const netPayable = round2(safeAmount - discountAmount);
  const paid = clamp(receivable, 0, netPayable);

  return { discountAmount, netPayable, dueAmount: round2(netPayable - paid) };
};

/** The doctor's slots for the weekday the given date falls on. */
export const slotsForDate = (
  schedule: ScheduleSlot[] | undefined | null,
  date: Date | undefined | null,
): ScheduleSlot[] => {
  if (!schedule?.length || !date || Number.isNaN(date.getTime())) return [];
  return schedule.filter(slot => slot?.day === date.getDay());
};
