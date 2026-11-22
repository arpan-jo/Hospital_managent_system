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

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Bangla digits as 0–9: doctors write a dose either way ("০+০+১" is "0+0+1"). */
const toAsciiDigits = (text: string): string =>
  String(text ?? '')?.replace?.(/[০-৯]/g, digit => String(BANGLA_DIGITS.indexOf(digit))) ?? '';

const FRACTION_SIGNS = '½¼¾⅓⅔⅛';

/**
 * One position of a dose pattern: a fraction (1/2), a fraction sign with or
 * without a whole number (½, 1½), or a count (1, 10, 0.5).
 */
const DOSE = `(\\d+\\/\\d+|\\d*[${FRACTION_SIGNS}]|\\d+(?:\\.\\d+)?)`;

/**
 * Three or four doses joined by + or −. Anything after them that does not
 * carry on a dose (a note the server ran into the dose, "1+0+1খাবারেরপরে")
 * is left out.
 */
const DOSE_PATTERN = new RegExp(
  `^${DOSE}[+-]${DOSE}[+-]${DOSE}(?:[+-]${DOSE})?(?=$|[^\\d./+\\-${FRACTION_SIGNS}])`,
);

/** A dose that is actually taken: anything above zero — ½ and 0.5 included. */
const isTaken = (dose?: string): boolean => {
  const text = String(dose ?? '');
  if (!text) return false;
  if (new RegExp(`[${FRACTION_SIGNS}]`).test(text)) return true;
  const [top, bottom] = text.split('/');
  const value = bottom === undefined ? Number(top) : Number(top) / Number(bottom);
  return Number.isFinite(value) && value > 0;
};

/**
 * Which of the day's slots a frequency falls in, as the portal reads it:
 * "1-0-1" is morning/afternoon/night by position (a fourth figure adds the
 * evening), and the usual words — qid, tds, bd, od, nocte — map to theirs, in
 * the portal's order. Beyond the portal, a dose written in Bangla digits
 * ("০+০+১") or as a fraction ("½+0+½", "1/2", "0.5") is read too: the portal
 * takes those for a morning dose, which puts a night-only medicine under
 * Morning.
 */
export const slotsOfFrequency = (frequency?: string | null): MedicineSlot[] => {
  const raw = toAsciiDigits(toText(frequency))?.toLowerCase?.() ?? '';
  const numeric = DOSE_PATTERN.exec(raw);

  if (numeric) {
    const [, morning, afternoon, third, fourth] = numeric;
    const slots: MedicineSlot[] = [];
    if (isTaken(morning)) slots.push('morning');
    if (isTaken(afternoon)) slots.push('afternoon');
    if (fourth === undefined) {
      if (isTaken(third)) slots.push('night');
    } else {
      if (isTaken(third)) slots.push('evening');
      if (isTaken(fourth)) slots.push('night');
    }
    return slots.length ? slots : ['morning'];
  }

  if (/\bqid\b|\bfour\s+times\b|\b4\s+times\b/.test(raw)) return [...MEDICINE_SLOTS];
  if (/\btds\b|\btid\b|\bthree\s+times\b|\b3\s+times\b/.test(raw)) return ['morning', 'afternoon', 'night'];
  if (/\bbd\b|\btwice\b|\bbid\b|\b2\s+times\b/.test(raw)) return ['morning', 'night'];
  // Before "at night", as the portal checks: "once at night" is a morning dose there too.
  if (/\bod\b|\bonce\b|\b1\s+time\b|\bonce\s+daily\b/.test(raw)) return ['morning'];
  if (/\bnocte\b|\bhs\b|\bat\s+night\b/.test(raw)) return ['night'];
  return ['morning'];
};

