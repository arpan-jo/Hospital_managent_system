/**
 * The "taken" ticks of Today's Medicines, kept on the phone only, one record
 * per day. The key is `med-log-YYYY-MM-DD` and the record is
 * `{ "<itemId>_<slot>": true }`, the same key and shape the portal keeps in
 * the browser.
 *
 * Read from storage every time, never from a copy. The panel is on the
 * Dashboard and on My Prescriptions at once. A copy taken when one of them
 * opened would write back over the ticks made on the other.
 *
 * Nothing here throws. A tick that cannot be kept is only lost for the day.
 */
import { storage } from './secureStorage';
import { toISODate } from './format';
import type { MedicineSlot } from './medicineSlots';

const logKeyOf = (day: string) => `med-log-${day}`;

/** The log's day for `now`, by the phone's own date ("2026-11-22"). */
export const takenLogDay = (now?: Date): string => {
  const date = now instanceof Date && Number.isFinite(now?.getTime?.()) ? now : new Date();
  return toISODate(date);
};

/** One dose of one medicine line in one slot. */
export const medicineDoseKey = (prescriptionId: number, slot: MedicineSlot): string =>
  `${prescriptionId}_${slot}`;

/** The day's ticks as stored. Empty when there are none or they cannot be read. */
export const readTakenLog = (day?: string): Record<string, boolean> => {
  try {
    const raw = storage?.getString?.(logKeyOf(day || takenLogDay()));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error: any) {
    console.log('medicine taken log read error ==>', error?.message);
    return {};
  }
};

/**
 * Flips one dose's tick in what is stored now and gives back the day's ticks
 * after it. If the write fails, the returned ticks still show the flip, so the
 * screen follows the tap.
 */
export const toggleTakenDose = (key: string, day?: string): Record<string, boolean> => {
  const logDay = day || takenLogDay();
  const current = readTakenLog(logDay);
  if (!key) return current;
  const next = { ...current, [key]: !current?.[key] };
  try {
    storage?.set?.(logKeyOf(logDay), JSON.stringify(next));
  } catch (error: any) {
    console.log('medicine taken log write error ==>', error?.message);
  }
  return next;
};
