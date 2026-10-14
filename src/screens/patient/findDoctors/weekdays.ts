/**
 * Weekdays as the doctor API names them ("Mon", "Tue", …), shared by the
 * doctor card, the day filter and the booking screen so the three agree.
 */
import { fromISODate, toISODate } from '@app/core';

/** In `Date#getDay()` order, which is also the order of the `days` locale block. */
export const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Monday first — the order the portal shows a week in. */
export const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The patient's own today, not the server's. */
export const todayAbbr = (): string => DAY_ABBRS[new Date().getDay()] ?? '';

/** "Mon" -> 1: the index of its name in the `days` locale block; -1 when unknown. */
export const dayIndexOf = (abbr?: string | null): number =>
  DAY_ABBRS.indexOf(String(abbr ?? '').trim());

/**
 * The next date that falls on a weekday — today when today is that day — as
 * "YYYY-MM-DD". `abbr` is one of `DAY_ABBRS`; anything else answers ''.
 */
export const nextDateForDay = (abbr: string): string => {
  const dayIndex = dayIndexOf(abbr);
  if (dayIndex < 0) return '';

  const date = new Date();
  date.setDate(date.getDate() + ((dayIndex - date.getDay() + 7) % 7));
  // The phone's own calendar day, not the UTC one.
  return toISODate(date);
};

/** "2026-10-14" -> "Wed"; '' when the text is not a date. */
export const dayAbbrOfDate = (isoDate?: string | null): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate ?? ''))) return '';

  return DAY_ABBRS[fromISODate(isoDate).getDay()] ?? '';
};
