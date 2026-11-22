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

/** A day's record key, and nothing else: `med-log-YYYY-MM-DD`. */
const LOG_KEY = /^med-log-(\d{4}-\d{2}-\d{2})$/;

/** How many days of ticks are kept before today's; older ones are of no use. */
export const TAKEN_LOG_KEEP_DAYS = 7;

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
 * Takes away the records of days more than `keepDays` before today. A day's
 * ticks are only shown on that day, so without this they would pile up on the
 * phone for good, one record a day. Only `med-log-YYYY-MM-DD` keys are touched;
 * today's and later ones always stay. Gives back how many were taken away.
 * Run once as the app opens. Never throws.
 */
export const pruneTakenLogs = (keepDays: number = TAKEN_LOG_KEEP_DAYS, now?: Date): number => {
  try {
    const today = now instanceof Date && Number.isFinite(now?.getTime?.()) ? now : new Date();
    const days = Math.max(0, Math.trunc(Number(keepDays) || 0));
    const oldestKept = takenLogDay(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - days),
    );
    const keys = storage?.getAllKeys?.() ?? [];
    let removed = 0;
    for (const key of Array.isArray(keys) ? keys : []) {
      const day = LOG_KEY.exec(String(key ?? ''))?.[1];
      // "YYYY-MM-DD" sorts as the days do.
      if (day && day < oldestKept) {
        storage?.remove?.(key);
        removed += 1;
      }
    }
    return removed;
  } catch (error: any) {
    console.log('medicine taken log prune error ==>', error?.message);
    return 0;
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
