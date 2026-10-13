import { RxItem, toRxItem } from '@app/core';
import { DESK_LIST_SECTIONS, SectionItem } from './sectionConfig';
import {
  SectionSummaryGroup,
  SectionSummaryLine,
  buildSectionSummary,
  displayDate,
  normalizeSectionItems,
} from './sectionSummary';
import {
  CONTINUE_MEDICINE_GROUP_KEY,
  GROUPS_META_KEY,
  INVESTIGATION_LIST_KEY,
  MEDICINE_LIST_KEY,
  NOTE_SUFFIX,
  PAST_HISTORY_GROUP_KEY,
  SEARCH_LIST_KEY,
  VITALS_GROUP_KEY,
} from './assessmentKeys';

/**
 * Every section's summary, behind one call.
 *
 * Twelve of them are the same shape and go through `buildSectionSummary`. The
 * other three do not: Physical Examination and History store a map of groups
 * and fields rather than a list, and Rx stores medicines. Those two readers
 * live here, so the desk never has to know which kind of section it is showing.
 */

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

const ADD_LIST_KEYS = [SEARCH_LIST_KEY, MEDICINE_LIST_KEY, INVESTIGATION_LIST_KEY];

/*
 * The portal's Vitals tab takes height in centimetres or in feet and inches.
 * `Height Unit` is which of the two the doctor chose, not a reading, and the
 * feet and inches are one height between them — so none of the three prints on
 * a line of its own; the two parts print together as "Height: 5 ft 7 in".
 */
export const HEIGHT_UNIT_KEY = 'Height Unit';
export const HEIGHT_CM_KEY = 'Height (cm)';
export const HEIGHT_FT_KEY = 'Height (ft)';
export const HEIGHT_IN_KEY = 'Height (in)';
export const WEIGHT_KEY = 'Weight (kg)';
const HEIGHT_KEYS = [HEIGHT_UNIT_KEY, HEIGHT_FT_KEY, HEIGHT_IN_KEY];

/** The merged height line's name — not a stored field; removing it clears both parts. */
const HEIGHT_LINE_KEY = 'Height';

/** A group's height in centimetres, in whichever unit it was taken. */
const heightInCm = (slice: Record<string, unknown>): number | undefined => {
  if ((slice?.[HEIGHT_UNIT_KEY] ?? 'CM') === 'Inch') {
    const feet = Number(slice?.[HEIGHT_FT_KEY]);
    const inches = Number(slice?.[HEIGHT_IN_KEY]);
    const total = (Number.isFinite(feet) ? feet : 0) * 12 + (Number.isFinite(inches) ? inches : 0);
    return total > 0 ? total * 2.54 : undefined;
  }
  const cm = Number(slice?.[HEIGHT_CM_KEY]);
  return Number.isFinite(cm) && cm > 0 ? cm : undefined;
};

/**
 * BMI (kg/m², one decimal) and BSA (Mosteller, m², two decimals), as the
 * portal works them out. Never stored — both follow height and weight, and
 * appear only once both are there.
 */
export const bmiAndBsa = (slice: Record<string, unknown>): { bmi?: string; bsa?: string } => {
  const cm = heightInCm(slice);
  const kg = Number(slice?.[WEIGHT_KEY]);
  if (!cm || !Number.isFinite(kg) || kg <= 0) return {};

  const metres = cm / 100;
  return {
    bmi: (kg / (metres * metres)).toFixed(1),
    bsa: Math.sqrt((cm * kg) / 3600).toFixed(2),
  };
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * A date field as it prints. The app stores 'YYYY-MM-DD'; the portal stores the
 * UTC time of local midnight, which reads as the right day only in local time.
 */
const dateText = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return displayDate(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
};

const RESERVED_GROUP_NAMES: Record<string, string> = {
  [VITALS_GROUP_KEY]: 'Vitals',
  [PAST_HISTORY_GROUP_KEY]: 'Past History',
  [CONTINUE_MEDICINE_GROUP_KEY]: 'Continue Medicine',
};

/** A stored field value, as something readable. A list pick unwraps to its label. */
const fieldText = (value: unknown): string => {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : '';

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('value' in record) return text(record?.label ?? record?.value);
    return '';
  }
  return dateText(text(value));
};

/**
 * An uploaded photo, recognised by the `showOnMain` choice the image input
 * always writes alongside it — a list pick stores `{value,label}` and has none.
 */
const asImage = (value: unknown): { id: string; show: boolean } | null => {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  if (typeof record?.showOnMain !== 'boolean' || !record?.value) return null;

  return { id: text(record.value), show: record.showOnMain === true };
};

/**
 * Physical Examination / History — a group per tab, and under it whatever was
 * filled in: the static fields as "Field: value", the added items with their
 * dose and duration.
 */
export const buildAssessmentSummary = (value: unknown): SectionSummaryGroup[] => {
  const record = (value ?? {}) as Record<string, any>;
  const meta: Array<{ id: string; name: string }> = Array.isArray(record?.[GROUPS_META_KEY])
    ? record[GROUPS_META_KEY]
    : [];

  const listedIds = meta.length
    ? meta.map(group => String(group?.id))
    : Object.keys(record).filter(key => key !== GROUPS_META_KEY);

  // A value can hold Vitals (or Past History, Continue Medicine) without the
  // list naming it — a draft saved before the form wrote the list, or one from
  // the portal. As there, a reserved group that holds something shows anyway,
  // ahead of the rest; on screen, in the section's count and on the print.
  const reservedIds = Object.keys(RESERVED_GROUP_NAMES).filter(
    id => record?.[id] && !listedIds.includes(id),
  );
  const groupIds = [...reservedIds, ...listedIds];

  const nameOf = (id: string): string =>
    RESERVED_GROUP_NAMES[id] ?? meta.find(group => String(group?.id) === id)?.name ?? `Group ${id}`;

  return groupIds
    .map(groupId => {
      const slice = record?.[groupId];
      if (!slice || typeof slice !== 'object') return { title: '', lines: [] };

      const lines: SectionSummaryLine[] = [];
      const addedNames = new Set<string>();
      ADD_LIST_KEYS.forEach(listKey => {
        (Array.isArray(slice?.[listKey]) ? slice[listKey] : []).forEach((name: string) =>
          addedNames.add(name),
        );
      });

      const noteOf = (base: string): string | undefined =>
        text(slice?.[`${base}${NOTE_SUFFIX}`]) || undefined;

      // Fields the doctor filled in, in the order they were stored.
      Object.keys(slice).forEach(key => {
        if (
          ADD_LIST_KEYS.includes(key) ||
          HEIGHT_KEYS.includes(key) ||
          key.endsWith(NOTE_SUFFIX) ||
          addedNames.has(key)
        ) {
          return;
        }

        const image = asImage(slice[key]);
        const display = image ? key : fieldText(slice[key]);
        if (!display) return;

        lines.push({
          key: `${groupId}:${key}`,
          // A photo's line is the field's name; the photo itself follows it.
          text: image || typeof slice[key] === 'boolean' ? key : `${key}: ${display}`,
          note: noteOf(key),
          imageId: image?.id,
          showImage: image?.show,
          item: { name: key, tab: groupId } as SectionItem,
        });
      });

      // Then what follows from those fields: a height in feet and inches as one
      // line, then BMI and BSA — after the fields and before the lists, as printed.
      const feet = text(slice?.[HEIGHT_FT_KEY]);
      const inches = text(slice?.[HEIGHT_IN_KEY]);
      if (feet || inches) {
        lines.push({
          key: `${groupId}:${HEIGHT_LINE_KEY}`,
          text: `Height: ${[feet ? `${feet} ft` : '', inches ? `${inches} in` : '']
            .filter(Boolean)
            .join(' ')}`,
          note: noteOf(HEIGHT_CM_KEY),
          item: { name: HEIGHT_LINE_KEY, tab: groupId } as SectionItem,
        });
      }

      const { bmi, bsa } = bmiAndBsa(slice);
      if (bmi) {
        lines.push({
          key: `${groupId}:BMI`,
          text: `BMI: ${bmi} kg/m²`,
          note: noteOf('BMI'),
          isDerived: true,
          item: { name: 'BMI', tab: groupId } as SectionItem,
        });
      }
      if (bsa) {
        lines.push({
          key: `${groupId}:BSA`,
          text: `BSA: ${bsa} m²`,
          note: noteOf('BSA'),
          isDerived: true,
          item: { name: 'BSA', tab: groupId } as SectionItem,
        });
      }

      // Then whatever was added to this group's lists.
      ADD_LIST_KEYS.forEach(listKey => {
        const names: string[] = Array.isArray(slice?.[listKey]) ? slice[listKey] : [];
        names.forEach(name => {
          const item = (slice?.[name] ?? {}) as Record<string, unknown>;
          const parts = [name];

          // Read like any field: the portal stores a unit nobody changed as its
          // picker option, `{ value: 'Days', label: 'Days' }`.
          const dose = fieldText(item?.dose);
          if (dose) parts.push(dose);

          const durationValue = fieldText(item?.durationValue);
          if (durationValue) {
            const unit = fieldText(item?.durationUnit);
            parts.push(unit ? `${durationValue} ${unit.toLowerCase()}` : durationValue);
          }

          // An investigation added on the portal can carry the date it was done.
          const date = listKey === INVESTIGATION_LIST_KEY ? dateText(text(item?.date)) : '';
          if (date) parts.push(date);

          lines.push({
            key: `${groupId}:${listKey}:${name}`,
            text: parts.join(' '),
            note: noteOf(name),
            item: { name, tab: groupId, listKey } as SectionItem,
          });
        });
      });

      return { title: nameOf(groupId), lines };
    })
    .filter(group => group.lines.length > 0);
};

/** The Rx form's own label for its Mixed switch. */
const MIXED_LABEL_KEY = 'doctorDesk.rx.mixed';

/** Rx — one line per medicine, plus a line per dose period when the course changes. */
export const buildRxSummary = (
  value: unknown,
  translate?: (key: string) => string,
): SectionSummaryGroup[] => {
  const items: RxItem[] = Array.isArray(value) ? (value as unknown[]).map(toRxItem) : [];
  const lines: SectionSummaryLine[] = [];
  const mixedLabel = translate ? translate(MIXED_LABEL_KEY) : 'Mixed';

  items.forEach((item, index) => {
    const brand = text(item?.brand);
    if (!brand) return;

    // Headed as the portal heads it: the form before the name ("Tablet Napa"),
    // the generic and the route, then Mixed. The route sits up here so a course
    // in dose periods, which has no line of its own below, still shows it.
    const head = [
      [text(item?.type), brand].filter(Boolean).join(' '),
      text(item?.generic),
      text(item?.route),
      item?.isMixed ? mixedLabel : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const periods = item?.multiDose ?? [];

    const tail = periods.length
      ? ''
      : [
          text(item?.dose),
          text(item?.durationValue)
            ? `${item.durationValue} ${text(item?.durationUnit).toLowerCase()}`.trim()
            : '',
        ]
          .filter(Boolean)
          .join(' — ');

    lines.push({
      key: `rx:${index}`,
      text: tail ? `${head} — ${tail}` : head,
      note: text(item?.note) || undefined,
      // A continuing medicine is worth spotting on the list at a glance.
      marker: item?.isContinue ? '↻' : undefined,
      item: { name: brand, index } as unknown as SectionItem,
    });

    periods.forEach((period, periodIndex) => {
      const detail = [
        text(period?.dose),
        text(period?.durationValue)
          ? `${period.durationValue} ${text(period?.durationUnit).toLowerCase()}`.trim()
          : '',
        text(period?.instruction),
      ]
        .filter(Boolean)
        .join(' — ');
      if (!detail) return;

      lines.push({
        key: `rx:${index}:${periodIndex}`,
        text: `↳ ${detail}`,
        isDetail: true,
        item: { name: brand, index } as unknown as SectionItem,
      });
    });
  });

  return lines.length ? [{ lines }] : [];
};

/** The summary for any section, whichever kind it is. */
export const buildDeskSectionSummary = (
  sectionKey: string,
  value: unknown,
  /**
   * Resolves tab labels — without it the printed page would show raw keys —
   * and the word Rx marks a mixed medicine with.
   */
  translate?: (key: string) => string,
): SectionSummaryGroup[] => {
  if (sectionKey === 'physicalExamination' || sectionKey === 'history') {
    return buildAssessmentSummary(value);
  }
  if (sectionKey === 'rx') return buildRxSummary(value, translate);

  return buildSectionSummary(DESK_LIST_SECTIONS[sectionKey], value, translate);
};

/**
 * How many entries a section holds, for its badge.
 *
 * Counted from what the section actually recorded, not from the shape of the
 * stored value: Physical Examination and History keep bookkeeping keys of their
 * own that are not entries, and an Rx medicine with several dose periods is
 * still one medicine.
 */
export const countDeskSectionEntries = (sectionKey: string, value: unknown): number => {
  if (sectionKey === 'physicalExamination' || sectionKey === 'history') {
    // BMI and BSA are read off height and weight, not entries of their own.
    return buildAssessmentSummary(value).reduce(
      (total, group) => total + group.lines.filter(line => !line?.isDerived).length,
      0,
    );
  }
  if (sectionKey === 'rx') {
    const items: RxItem[] = Array.isArray(value) ? (value as unknown[]).map(toRxItem) : [];
    return items.filter(item => item?.brand?.trim()).length;
  }
  // Read as the section reads it, so an older Chief Complaint record still counts.
  return normalizeSectionItems(value).length;
};
