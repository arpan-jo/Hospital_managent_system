/**
 * How a visit prescription is laid out as a sheet: what goes above the
 * medicines and what below, the vitals pulled out into their own strip, and the
 * medicine names written the way a printed prescription writes them.
 */
import { PrescriptionMedicine, PrescriptionSection } from '@app/core';

export interface PadVital {
  label: string;
  value: string;
}

/**
 * What was found — written above the medicines on a printed sheet. Everything
 * else (the plan, advice, follow-up, a referral…) is an instruction and goes
 * below them. Each half keeps the order the API sends.
 */
const FINDINGS_KEYS = [
  'physicalExamination',
  'history',
  'chiefComplaint',
  'investigation',
  'investigationFindings',
  'diagnosis',
  'allergy',
];

export const splitPadSections = (sections: PrescriptionSection[] | null | undefined) => {
  const list = sections ?? [];
  return {
    findings: list.filter(section => FINDINGS_KEYS.includes(section?.key ?? '')),
    instructions: list.filter(section => !FINDINGS_KEYS.includes(section?.key ?? '')),
  };
};

/** "Pulse (R): 33" — a name, a colon, a reading. */
const VITAL_LINE = /^([^:]{1,40}):\s*(.+)$/;
/** "Height Unit" — the unit of another reading, not a reading itself. */
const UNIT_SUFFIX = /\s+unit$/i;

/**
 * The examination's vitals group, read out as name / reading pairs for the
 * vitals strip, and the sections without them. A line that is not a
 * "name: reading" stays where it was; a "<name> Unit" line goes onto that
 * reading ("Height: 160" + "Height Unit: CM" → "160 CM"), and is dropped when
 * there is no such reading — a unit alone says nothing.
 */
export const takeVitals = (
  sections: PrescriptionSection[] | null | undefined,
): { vitals: PadVital[]; sections: PrescriptionSection[] } => {
  const vitals: PadVital[] = [];
  const units: { name: string; unit: string }[] = [];

  const rest = (sections ?? [])
    .map(section => {
      if (section?.key !== 'physicalExamination') return section;
      const groups = (section?.groups ?? [])
        .map(group => {
          if (!/vital/i.test(group?.groupName ?? '')) return group;
          const kept = (group?.lines ?? []).filter(line => {
            const match = VITAL_LINE.exec((line?.text ?? '').trim());
            if (!match) return true;
            const name = match[1].trim();
            const reading = match[2].trim();
            if (UNIT_SUFFIX.test(name)) {
              units.push({ name: name.replace(UNIT_SUFFIX, '').toLowerCase(), unit: reading });
            } else {
              vitals.push({ label: name, value: line?.note ? `${reading} (${line.note})` : reading });
            }
            return false;
          });
          return { ...group, lines: kept };
        })
        .filter(group => (group?.lines ?? []).length > 0);
      return { ...section, groups };
    })
    .filter(section => (section?.groups ?? []).length > 0);

  units.forEach(({ name, unit }) => {
    const vital = vitals.find(item => item.label.toLowerCase() === name);
    if (vital && !vital.value.toLowerCase().endsWith(unit.toLowerCase())) {
      vital.value = `${vital.value} ${unit}`;
    }
  });

  return { vitals, sections: rest };
};

/** How a printed prescription shortens a dosage form. */
const FORM_SHORT: Record<string, string> = {
  tablet: 'Tab.',
  tab: 'Tab.',
  capsule: 'Cap.',
  cap: 'Cap.',
  syrup: 'Syp.',
  syp: 'Syp.',
  suspension: 'Susp.',
  injection: 'Inj.',
  inj: 'Inj.',
  ointment: 'Oint.',
  suppository: 'Supp.',
  inhaler: 'Inh.',
};

/** "Tablet" as "Tab.", as on paper; a form it does not know is kept as it came. */
export const medicineForm = (type: string | null | undefined): string => {
  const text = (type ?? '').trim();
  return FORM_SHORT[text.toLowerCase().replace(/\.$/, '')] ?? text;
};

/** "1+0+1" as "1 + 0 + 1", so the times of day read apart. */
export const formatDose = (dose: string | null | undefined): string =>
  (dose ?? '').trim().replace(/\s*\+\s*/g, ' + ');

/** The medicine's form and name on one line: "Tab. Napa 500 mg". */
export const medicineTitle = (medicine: Pick<PrescriptionMedicine, 'type' | 'brand'> | null | undefined) =>
  [medicineForm(medicine?.type), (medicine?.brand ?? '').trim()].filter(Boolean).join(' ');

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * How old the patient was on the day of the prescription — whole years, and
 * months for a baby. Null when either date cannot be read or the birth is later.
 */
export const ageOnDay = (
  dateOfBirth: string | null | undefined,
  day: string | null | undefined,
): { years: number; months: number } | null => {
  const birth = DAY.exec((dateOfBirth ?? '').trim());
  const on = DAY.exec((day ?? '').trim());
  if (!birth || !on) return null;
  let months = (Number(on[1]) - Number(birth[1])) * 12 + (Number(on[2]) - Number(birth[2]));
  if (Number(on[3]) < Number(birth[3])) months -= 1;
  if (months < 0) return null;
  return { years: Math.floor(months / 12), months: months % 12 };
};

/** "#2F45E5" at the given opacity — for the sheet's hairlines and tints, drawn from the theme. */
export const withAlpha = (hex: string | null | undefined, alpha: number): string => {
  const match = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!match) return hex ?? 'transparent';
  const value = parseInt(match[1], 16);
  // eslint-disable-next-line no-bitwise
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};
