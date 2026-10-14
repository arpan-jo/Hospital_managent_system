/**
 * The day's four dose slots and how a written frequency maps onto them, as the
 * portal's Today's Medicines panel reads it. Kept free of native modules so it
 * can be unit-tested.
 */

export const MEDICINE_SLOTS = ['morning', 'afternoon', 'evening', 'night'] as const;
export type MedicineSlot = (typeof MEDICINE_SLOTS)[number];

/** 'HH:mm' per slot. */
export type MedicineSlotTimes = Record<MedicineSlot, string>;

export const DEFAULT_SLOT_TIMES: MedicineSlotTimes = {
  morning: '08:00',
  afternoon: '14:00',
  evening: '18:00',
  night: '21:00',
};

const toText = (value: any): string => String(value ?? '').trim();

/**
 * Which of the day's slots a frequency falls in, as the portal reads it:
 * "1-0-1" is morning/afternoon/night by position (a fourth figure adds the
 * evening), and the usual words — qid, tds, bd, od, nocte — map to theirs.
 */
export const slotsOfFrequency = (frequency?: string | null): MedicineSlot[] => {
  const raw = toText(frequency).toLowerCase();
  const numeric = /^(\d)[+-](\d)[+-](\d)(?:[+-](\d))?$/.exec(raw);

  if (numeric) {
    const [, morning, afternoon, third, fourth] = numeric;
    const slots: MedicineSlot[] = [];
    if (morning !== '0') slots.push('morning');
    if (afternoon !== '0') slots.push('afternoon');
    if (fourth === undefined) {
      if (third !== '0') slots.push('night');
    } else {
      if (third !== '0') slots.push('evening');
      if (fourth !== '0') slots.push('night');
    }
    return slots.length ? slots : ['morning'];
  }

  if (/\bqid\b|\bfour\s+times\b|\b4\s+times\b/.test(raw)) return [...MEDICINE_SLOTS];
  if (/\btds\b|\btid\b|\bthree\s+times\b|\b3\s+times\b/.test(raw)) return ['morning', 'afternoon', 'night'];
  if (/\bbd\b|\btwice\b|\bbid\b|\b2\s+times\b/.test(raw)) return ['morning', 'night'];
  if (/\bnocte\b|\bhs\b|\bat\s+night\b/.test(raw)) return ['night'];
  return ['morning'];
};

