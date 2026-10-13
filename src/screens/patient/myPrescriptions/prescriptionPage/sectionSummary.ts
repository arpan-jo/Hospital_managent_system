import { DeskListSectionConfig, SectionItem, fieldsForTab } from './sectionConfig';

/**
 * Turning a section's items into the lines shown under it on the desk, and
 * later on the printed page.
 *
 * The portal writes a `buildXxxSummary` per section; the twelve of them differ
 * only in which fields they append and with what punctuation, so the rules live
 * here once, keyed by what a field *is* rather than which section it came from.
 * Read against the portal's builders, the output is the same string.
 */

export interface SectionSummaryLine {
  /** Stable within a section — tab and name, which is what identity is here. */
  key: string;
  /** "Fever 5 days · Chest". */
  text: string;
  /** Shown apart from the text, as the portal does. */
  note?: string;
  /** QUERY_MARKER for a queried diagnosis, URGENT_MARKER for an urgent order. */
  marker?: string;
  /**
   * Blob name of an uploaded reference photo. The line's text is then just the
   * field's name — a stored blob id means nothing to a doctor or a patient.
   */
  imageId?: string;
  /** The doctor's "show on the prescription" choice for that photo. */
  showImage?: boolean;
  /**
   * Reference only — a past investigation shown for context. It is not part of
   * this visit, so it has no ✕; tapping it records the finding instead.
   */
  isRecent?: boolean;
  /**
   * Worked out from other entries — BMI and BSA from height and weight — and
   * never stored, so there is nothing of its own to remove.
   */
  isDerived?: boolean;
  /**
   * Part of the entry on the line above — a medicine's dose period — so it goes
   * only with that entry and has no ✕ of its own, as on the portal.
   */
  isDetail?: boolean;
  item: SectionItem;
}

export interface SectionSummaryGroup {
  /**
   * The tab's label, already readable — absent for a section with one list.
   * Resolved here rather than at each consumer: the printed page has no
   * translator of its own, and a raw key would end up on a patient's sheet.
   */
  title?: string;
  /** The tab this group lists, for a section whose tabs hold separate lists. */
  tabKey?: string;
  /** The heading the printed page uses — the portal's own English wording. */
  printTitle?: string;
  lines: SectionSummaryLine[];
}

/** Leads a queried diagnosis's line, on the desk and on the printed page. */
export const QUERY_MARKER = '?';

/**
 * Flags an urgent investigation or operation. Never shown as itself: the line
 * ends in the word "Urgent" instead, as the portal writes it.
 */
export const URGENT_MARKER = '!';

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

/** 'YYYY-MM-DD' → 'DD/MM/YYYY'; anything else is passed through as typed. */
export const displayDate = (value: unknown): string => {
  const iso = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;

  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Chief Complaint was once kept as a list per tab, `{ chief: [...], group: [...] }`,
 * before its two tabs came to share one. Records saved that way still exist.
 */
const LEGACY_TAB_LISTS = ['chief', 'group'];

/** Those lists read as one, the first of any repeated name kept — as the portal reads them. */
const mergeLegacyTabLists = (value: Record<string, unknown>): SectionItem[] =>
  LEGACY_TAB_LISTS.reduce<SectionItem[]>((merged, tabKey) => {
    const rows = Array.isArray(value?.[tabKey]) ? (value[tabKey] as SectionItem[]) : [];
    rows.forEach(row => {
      if (row && !merged.some(kept => kept?.name === row?.name)) merged.push(row);
    });
    return merged;
  }, []);

/**
 * A list section's stored value as its items. Anything that is not a list
 * reads as empty, save the older per-tab shape above. Whatever the doctor
 * changes is written back as a plain list, so an old record is brought up to
 * date the first time it is edited.
 */
export const normalizeSectionItems = (value: unknown): SectionItem[] => {
  if (Array.isArray(value)) return value as SectionItem[];
  if (value && typeof value === 'object') {
    return mergeLegacyTabLists(value as Record<string, unknown>);
  }
  return [];
};

export const itemsForTab = (items: SectionItem[], tabKey?: string): SectionItem[] =>
  tabKey ? items.filter(item => item?.tab === tabKey) : items;

/** Tab and name together — the same pair the portal removes an entry by. */
export const itemKey = (item?: SectionItem): string =>
  `${item?.tab ?? ''}:${item?.name ?? ''}`;

/**
 * One item's display line. Built in the order the portal builds it: the name,
 * then the measured parts, then the qualifiers it hangs off a separator.
 */
const buildLine = (
  config: DeskListSectionConfig,
  item: SectionItem,
): SectionSummaryLine | null => {
  const name = text(item?.name);
  if (!name) return null;

  const parts = [name];
  const dates: string[] = [];
  /** Hung off the line with " · ". */
  const qualifiers: string[] = [];
  /** Hung off the line with " — ". */
  const targets: string[] = [];
  let marker: string | undefined;
  let isCompleted = false;

  config?.fields?.forEach(field => {
    if (field?.kind === 'duration') {
      const value = text(item?.durationValue);
      if (!value) return;
      const unit = text(item?.durationUnit);
      parts.push(unit ? `${value} ${unit.toLowerCase()}` : value);
      return;
    }

    if (field?.kind === 'doctor') {
      const doctorName = text(item?.doctorName);
      if (doctorName) targets.push(doctorName);
      return;
    }

    if (field?.kind === 'date') {
      const value = displayDate(item?.[field.name]);
      if (value) dates.push(value);
      return;
    }

    if (field?.kind === 'toggle') {
      if (!item?.[field.name]) return;
      // Completion reads as a tick at the end of the line; the other two are flags on it.
      if (field.name === 'isCompleted') isCompleted = true;
      else marker = field.name === 'isQuery' ? QUERY_MARKER : URGENT_MARKER;
      return;
    }

    if (field?.kind === 'select' || field?.kind === 'suggest') {
      const value = text(item?.[field.name]);
      if (value) qualifiers.push(value);
      return;
    }

    const value = text(item?.[field.name]);
    if (!value || field.name === 'note') return;

    // Each free-text field has its own place on the line, as the portal does it.
    if (field.name === 'step') parts.push(`(Step ${value})`);
    else if (field.name === 'session') qualifiers.push(value);
    else targets.push(value);
  });

  // A plan's planned and actual dates read as one range; everything else is a
  // single date sitting after the name.
  if (dates.length) parts.push(dates.join(' → '));
  // After the dates, as the portal writes it: "Physio (Step 2) 12/07/2026 → 15/07/2026 ✓".
  if (isCompleted) parts.push('✓');

  const line =
    parts.join(' ') +
    (qualifiers.length ? ` · ${qualifiers.join(' · ')}` : '') +
    (targets.length ? ` — ${targets.join(', ')}` : '');

  const note = text(item?.note);

  return { key: itemKey(item), text: line, note: note || undefined, marker, item };
};

/**
 * A section's summary, grouped the way it is entered: one group per tab when
 * the tabs own separate lists, otherwise a single ungrouped list. Empty groups
 * are dropped so a section never shows a heading with nothing under it.
 */
export const buildSectionSummary = (
  config: DeskListSectionConfig | undefined,
  value: unknown,
  /** Turns a tab's label key into its text; the key is used as-is without one. */
  translate?: (key: string) => string,
): SectionSummaryGroup[] => {
  if (!config) return [];

  const items = normalizeSectionItems(value);
  const toLines = (rows: SectionItem[]): SectionSummaryLine[] =>
    rows.map(row => buildLine(config, row)).filter(Boolean) as SectionSummaryLine[];

  if (config?.tabMode !== 'separate') {
    const lines = toLines(items);
    return lines.length ? [{ lines }] : [];
  }

  return (config?.tabs ?? [])
    // A history tab is the patient's record, not something entered here.
    .filter(tab => !tab?.isHistoryTab)
    .map(tab => {
      // Only what this tab asks for is read — an Operation's urgent flag is
      // not a Procedure's, as on the portal.
      const tabConfig = { ...config, fields: fieldsForTab(config, tab?.key) };

      return {
        title: translate ? translate(tab?.labelKey ?? '') : tab?.labelKey,
        tabKey: tab?.key,
        printTitle: tab?.printLabel,
        lines: itemsForTab(items, tab?.key)
          .map(row => buildLine(tabConfig, row))
          .filter(Boolean) as SectionSummaryLine[],
      };
    })
    .filter(group => group.lines.length > 0);
};
