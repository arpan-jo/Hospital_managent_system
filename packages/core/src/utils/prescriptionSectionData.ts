/**
 * A prescription's raw sectionData (what the doctor's workstation saved) as
 * the sections and medicines the app shows. GetPrescription used to answer
 * with this already done, by the backend's PortalPrescriptionSectionFlattener
 * and the *SummaryBuilder files it calls; the print data hands over only the
 * raw blob, so this is a port of that code, to show the same text the patient
 * saw before and the printed sheet shows.
 *
 * Where the C# would throw (a field of the wrong JSON type, a null item, a
 * physical-exam item that is not an object), GetPrescription answered 500 and
 * there was no prescription to match; here only that one value reads as
 * missing, so the rest still shows.
 */
import type {
  PrescriptionDose,
  PrescriptionMedicine,
  PrescriptionSection,
  PrescriptionSectionLine,
} from '../repositories/MedicalRecordRepository';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };
type SectionGroup = PrescriptionSection['groups'][number];

interface SummaryLine {
  text: string;
  note: string | null;
}

interface SummaryGroup<L extends SummaryLine = SummaryLine> {
  groupName: string;
  lines: L[];
}

// ── Reading the JSON ─────────────────────────────────────────────────────────

/**
 * A string is parsed; anything else is taken as the JSON it would be sent as
 * (JSON.stringify gives undefined for undefined, which JSON.parse rejects).
 * Whatever is not JSON reads as nothing, like the backend's TryParse.
 */
const parse = (sectionData: unknown): Json | undefined => {
  try {
    return JSON.parse(
      typeof sectionData === 'string' ? sectionData : JSON.stringify(sectionData),
    );
  } catch {
    return undefined;
  }
};

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A property by its exact name, as JsonElement.TryGetProperty reads it. Own
 * properties only, so a key like "constructor" is not found on the prototype.
 */
const own = (obj: JsonObject, key: string): Json | undefined =>
  Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;

/**
 * An item's field, matched the way the builders' JsonSerializer binds it
 * (PropertyNameCaseInsensitive), so "followupDate" and "followUpDate" both
 * fill FollowupDate. A name given twice keeps its last value.
 */
const field = (item: JsonObject, name: string): Json | undefined => {
  const wanted = name.toUpperCase();
  let found: Json | undefined;
  for (const key of Object.keys(item)) {
    if (key.toUpperCase() === wanted) found = item[key];
  }
  return found;
};

/** A `string?` field; any other JSON type reads as missing. */
const str = (item: JsonObject, name: string): string | null => {
  const value = field(item, name);
  return typeof value === 'string' ? value : null;
};

/** A `bool?` field, compared `== true` as the C# does. */
const isTrue = (item: JsonObject, name: string): boolean => field(item, name) === true;

/** DeserializeArray: a section's items, none when the value is not an array. */
const items = (value: Json | undefined): JsonObject[] =>
  Array.isArray(value) ? value.filter(isObject) : [];

// ── PrescriptionSummarySupport ───────────────────────────────────────────────

/**
 * The white space of .NET's Trim() and Regex `\s`: JS's own trim also strips
 * U+FEFF and keeps U+0085, which would decide differently whether a name is
 * blank.
 */
const SPACE = '\\t-\\r \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const EDGE_SPACE = new RegExp(`^[${SPACE}]+|[${SPACE}]+$`, 'g');
const SPACE_RUN = new RegExp(`[${SPACE}]+`, 'g');

const trimmed = (s: string | null | undefined): string => (s ?? '').replace(EDGE_SPACE, '');

/** .NET's `\d` is any Unicode digit, so a date written in Bangla digits is reordered too. */
const ISO_DATE = /^\p{Nd}{4}-\p{Nd}{2}-\p{Nd}{2}$/u;

/** 'YYYY-MM-DD' → 'DD/MM/YYYY'; anything else as it is. */
const displayDate = (iso: string | null): string => {
  const s = trimmed(iso);
  if (!ISO_DATE.test(s)) return s;
  const [year, month, day] = s.split('-');
  return `${day}/${month}/${year}`;
};

/** "3" + "Days" → "3 days"; just the value with no unit; null with no value. */
const joinDuration = (value: string | null, unit: string | null): string | null => {
  const dv = trimmed(value);
  if (!dv) return null;
  const du = trimmed(unit);
  return du ? `${dv} ${du.toLowerCase()}` : dv;
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const BN_UNITS = new Map([
  ['days', 'দিন'],
  ['weeks', 'সপ্তাহ'],
  ['months', 'মাস'],
  ['years', 'বছর'],
]);

const toBanglaDigits = (s: string): string => s.replace(/[0-9]/g, d => BN_DIGITS[Number(d)]);

const joinNonEmpty = (parts: string[]): string => parts.filter(p => p.length > 0).join(' ');

const noteOf = (item: JsonObject): string | null => trimmed(str(item, 'note')) || null;

/** Every builder's loop: the items that have a name, in order. */
const named = <L>(list: JsonObject[], render: (item: JsonObject, name: string) => L): L[] =>
  list.flatMap(item => {
    const name = trimmed(str(item, 'name'));
    return name ? [render(item, name)] : [];
  });

/** The tabbed sections: each tab owns its own items; one group per tab, in tab order. */
const byTab = <L extends SummaryLine>(
  value: Json,
  tabs: [string, string][],
  render: (item: JsonObject, name: string, tab: string) => L,
): SummaryGroup<L>[] => {
  const list = items(value);
  return tabs
    .map(([tab, label]) => ({
      groupName: label,
      lines: named(
        list.filter(item => str(item, 'tab') === tab),
        (item, name) => render(item, name, tab),
      ),
    }))
    .filter(group => group.lines.length > 0);
};

// ── The builders, one per section ────────────────────────────────────────────

const buildAdvice = (value: Json): SummaryLine[] =>
  named(items(value), (item, name) => {
    // The বাংলা switch prints the Bangla lookup name.
    const bangla = str(item, 'lang') === 'bn' ? trimmed(str(item, 'nameBangla')) : '';
    return { text: bangla || name, note: noteOf(item) };
  });

const buildAllergy = (value: Json): SummaryLine[] =>
  named(items(value), (item, name) => {
    const severity = trimmed(str(item, 'severity'));
    const type = trimmed(str(item, 'type')) === 'medicine' ? ' (Medicine)' : '';
    return { text: name + type + (severity ? ` - ${severity}` : ''), note: noteOf(item) };
  });

const buildBtOrder = (value: Json): SummaryLine[] =>
  named(items(value), (item, name) => ({ text: name, note: noteOf(item) }));

/** Shared by chief complaint and services: "name duration · extra". */
const withDurationAnd = (value: Json, extraField: string): SummaryLine[] =>
  named(items(value), (item, name) => {
    const duration = joinDuration(str(item, 'durationValue'), str(item, 'durationUnit'));
    const extra = trimmed(str(item, extraField));
    return {
      text: (duration !== null ? `${name} ${duration}` : name) + (extra ? ` · ${extra}` : ''),
      note: noteOf(item),
    };
  });

const buildDiagnosis = (value: Json) =>
  byTab(
    value,
    [
      ['provisional', 'Provisional Diagnosis'],
      ['final', 'Final Diagnosis'],
    ],
    (item, name) => {
      const duration = joinDuration(str(item, 'durationValue'), str(item, 'durationUnit'));
      return {
        text: duration !== null ? `${name} ${duration}` : name,
        note: noteOf(item),
        isQuery: isTrue(item, 'isQuery'),
      };
    },
  );

const buildDisposal = (value: Json) =>
  byTab(
    value,
    [
      ['admission', 'Admission'],
      ['disposal', 'Disposal'],
    ],
    (item, name, tab) => {
      if (tab === 'admission') {
        const where = [trimmed(str(item, 'doctorName')), trimmed(str(item, 'roomName'))].filter(Boolean);
        return { text: name + (where.length ? ` — ${where.join(', ')}` : ''), note: noteOf(item) };
      }
      const duration = joinDuration(str(item, 'durationValue'), str(item, 'durationUnit')) ?? '';
      return { text: name + (duration ? ` ${duration}` : ''), note: noteOf(item) };
    },
  );

const AFTER_FIRST = new RegExp(`^পরে?[${SPACE}]`);

/** Bangla word order for a বাংলা follow-up line. */
const banglaFollowUpText = (displayName: string, duration: string, date: string): string => {
  if (displayName.includes('{duration}') || displayName.includes('{date}')) {
    // The setup page's Bangla name carries its own word order ("{duration} পর পুনরায় আসবেন");
    // the date goes in brackets unless the name places it with {date}.
    const text = trimmed(
      displayName.split('{duration}').join(duration).split('{date}').join(date).replace(SPACE_RUN, ' '),
    );
    return !displayName.includes('{date}') && date ? `${text} (${date})` : text;
  }
  const bracketed = date ? `(${date})` : '';
  // A name that starts with "পর"/"পরে" ("after") takes the time in front.
  if (AFTER_FIRST.test(displayName) && duration) {
    return joinNonEmpty([`${duration} ${displayName}`, bracketed]);
  }
  return joinNonEmpty([displayName, duration ? `${duration} পর` : '', bracketed]);
};

const buildFollowUp = (value: Json): SummaryLine[] =>
  named(items(value), (item, name) => {
    // With বাংলা on, the whole line is Bangla (name, digits, unit), not a mix.
    const bn = str(item, 'lang') === 'bn';
    const bangla = trimmed(str(item, 'nameBangla'));
    const displayName = bn && bangla ? bangla : name;

    const dv = trimmed(str(item, 'durationValue'));
    const du = trimmed(str(item, 'durationUnit')).toLowerCase();
    const duration = dv
      ? joinNonEmpty([bn ? toBanglaDigits(dv) : dv, bn ? BN_UNITS.get(du) ?? du : du])
      : '';
    const rawDate = displayDate(str(item, 'followupDate'));
    const date = bn ? toBanglaDigits(rawDate) : rawDate;

    return {
      text: bn ? banglaFollowUpText(displayName, duration, date) : joinNonEmpty([displayName, duration, date]),
      note: noteOf(item),
    };
  });

const buildInvestigation = (value: Json) =>
  named(items(value), (item, name) => {
    const date = displayDate(str(item, 'date'));
    return { text: name + (date ? ` ${date}` : ''), note: noteOf(item), isUrgent: isTrue(item, 'isUrgent') };
  });

const buildInvestigationFinding = (value: Json) =>
  byTab(
    value,
    [
      ['notes', 'Investigation Findings Notes'],
      ['previous', 'Previous Investigation'],
    ],
    (item, name, tab) => {
      const date = displayDate(str(item, 'date'));
      const dated = name + (date ? ` ${date}` : '');
      if (tab !== 'notes') return { text: dated, note: null };
      const result = trimmed(str(item, 'result'));
      return { text: dated + (result ? ` — ${result}` : ''), note: noteOf(item) };
    },
  );

const buildOperation = (value: Json) =>
  byTab(
    value,
    [
      ['operation', 'Operation'],
      ['procedure', 'Procedure / Minor OT'],
    ],
    (item, name, tab) => {
      const date = displayDate(str(item, 'date'));
      return {
        text: name + (date ? ` ${date}` : ''),
        note: noteOf(item),
        // Only the Operation tab is ever marked urgent.
        isUrgent: tab === 'operation' && isTrue(item, 'isUrgent'),
      };
    },
  );

const buildReferred = (value: Json) =>
  byTab(
    value,
    [
      ['internal', 'Internal Referred'],
      ['external', 'External Referred'],
    ],
    (item, name, tab) => {
      const target = trimmed(str(item, tab === 'internal' ? 'doctorName' : 'departmentName'));
      return { text: name + (target ? ` — ${target}` : ''), note: noteOf(item) };
    },
  );

const buildTreatmentPlan = (value: Json): SummaryLine[] =>
  named(items(value), (item, name) => {
    const parts = [name];
    const step = trimmed(str(item, 'step'));
    if (step) parts.push(`(Step ${step})`);
    const dates = [displayDate(str(item, 'plannedDate')), displayDate(str(item, 'treatmentDate'))].filter(Boolean);
    if (dates.length) parts.push(dates.join(' → '));
    if (isTrue(item, 'isCompleted')) parts.push('✓');
    return { text: parts.join(' '), note: noteOf(item) };
  });

// ── Physical Examination / History ───────────────────────────────────────────
//
// { __groups: [{ id, name }], [groupId]: { [field]: value, [field + "_Note"]: string,
//   __extraFields / __medicineItems / __investigationItems: string[],
//   [itemName]: { dose, durationValue, durationUnit } } }

interface ExamLine extends SummaryLine {
  key: string;
  isImage: boolean;
}

const GROUPS_META_KEY = '__groups';
const NOTE_SUFFIX = '_Note';

/** Groups under fixed keys, shown even when __groups does not list them. */
const FIXED_GROUPS: [string, string][] = [
  ['__vitals', 'Vitals'],
  ['__pastHistory', 'Past History'],
  ['__continueMedicine', 'Continue Medicine'],
];

const ADDED_LISTS = [
  { listKey: '__extraFields', withDose: false, withDuration: true },
  { listKey: '__medicineItems', withDose: true, withDuration: true },
  { listKey: '__investigationItems', withDose: false, withDuration: false },
];
const ADDED_LIST_KEYS = new Set(ADDED_LISTS.map(list => list.listKey));

/** JsonElement.ToString() for a group id: numbers as written, true as "True". */
const asStringId = (value: Json): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return value === null ? '' : JSON.stringify(value);
};

const scalarText = (value: Json): string =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';

/** A field's value as text; a list choice ({ value, label }) shows its label. Null when empty. */
const displayValue = (value: Json | undefined): string | null => {
  if (isObject(value)) {
    const inner = own(value, 'value');
    if (inner === undefined) return null;
    const label = own(value, 'label');
    const chosen = label !== undefined && label !== null ? label : inner;
    return chosen === null ? null : trimmed(scalarText(chosen)) || null;
  }
  if (typeof value === 'string') return trimmed(value) || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

const isTruthy = (value: Json): boolean => {
  if (value === null || value === false) return false;
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'number') return value !== 0;
  return true;
};

/**
 * An image field carries a showOnMain flag (ImageValueInput always sets it);
 * a list choice is a bare { value, label }.
 */
const isImageValue = (value: Json): boolean => {
  if (!isObject(value) || typeof own(value, 'showOnMain') !== 'boolean') return false;
  const id = own(value, 'value');
  return id !== undefined && isTruthy(id);
};

const examLines = (group: JsonObject): ExamLine[] => {
  const noteFor = (key: string): string | null => {
    const note = own(group, key + NOTE_SUFFIX);
    return typeof note === 'string' ? trimmed(note) || null : null;
  };
  const listOf = (listKey: string): string[] => {
    const list = own(group, listKey);
    return Array.isArray(list) ? list.filter((name): name is string => typeof name === 'string') : [];
  };
  const added = new Set(ADDED_LISTS.flatMap(list => listOf(list.listKey)));
  const lines: ExamLine[] = [];

  // The form's own fields — "Field: value"; a ticked checkbox is just its name.
  for (const key of Object.keys(group)) {
    if (ADDED_LIST_KEYS.has(key) || key.endsWith(NOTE_SUFFIX) || added.has(key)) continue;
    const value = group[key];
    if (typeof value === 'boolean') {
      if (value) lines.push({ text: key, note: noteFor(key), key, isImage: false });
      continue;
    }
    const display = displayValue(value);
    if (display === null) continue;
    lines.push({ text: `${key}: ${display}`, note: noteFor(key), key, isImage: isImageValue(value) });
  }

  // Items the doctor added — "Napa 1+0+1 5 days" / "CBC".
  for (const { listKey, withDose, withDuration } of ADDED_LISTS) {
    for (const name of listOf(listKey)) {
      const item = own(group, name);
      const parts = [name];
      // The C# throws on an item that is not an object; it reads as just its name here.
      if (isObject(item) && withDose) {
        const dose = displayValue(own(item, 'dose'));
        if (dose !== null) parts.push(dose);
      }
      if (isObject(item) && withDuration) {
        const dv = displayValue(own(item, 'durationValue'));
        const du = displayValue(own(item, 'durationUnit'));
        if (dv !== null) parts.push(du !== null ? `${dv} ${du.toLowerCase()}` : dv);
      }
      lines.push({ text: parts.join(' '), note: noteFor(name), key: name, isImage: false });
    }
  }

  return lines;
};

const buildPhysicalExam = (value: Json): SummaryGroup<ExamLine>[] => {
  if (!isObject(value)) return [];

  const metaList = own(value, GROUPS_META_KEY);
  const meta = (Array.isArray(metaList) ? metaList : []).filter(isObject).map(group => {
    const id = own(group, 'id');
    const name = own(group, 'name');
    return { id: id === undefined ? '' : asStringId(id), name: typeof name === 'string' ? name : '' };
  });

  const groupIds = meta.length
    ? meta.map(group => group.id)
    : Object.keys(value).filter(key => key !== GROUPS_META_KEY);
  // Unshifted narrowest-last, so they lead as Vitals, Past History, Continue Medicine.
  for (const [key] of [...FIXED_GROUPS].reverse()) {
    if (own(value, key) !== undefined && !groupIds.includes(key)) groupIds.unshift(key);
  }

  const nameOf = (id: string): string =>
    FIXED_GROUPS.find(([key]) => key === id)?.[1] ||
    meta.find(group => group.id === id)?.name ||
    `Group ${id}`;

  return groupIds.flatMap(groupId => {
    const group = own(value, groupId);
    if (!isObject(group)) return [];
    const lines = examLines(group);
    return lines.length ? [{ groupName: nameOf(groupId), lines }] : [];
  });
};

// ── PortalPrescriptionSectionFlattener ───────────────────────────────────────

/**
 * The canonical order and labels — the staff Prescription View's left column
 * then its right, as one column. `rx` is not here: the medicines are their own
 * list.
 */
const SECTIONS: [string, string][] = [
  ['physicalExamination', 'Physical Examination'],
  ['history', 'History'],
  ['chiefComplaint', 'Chief Complaint'],
  ['investigation', 'Investigation'],
  ['investigationFindings', 'Investigation Finding'],
  ['diagnosis', 'Diagnosis'],
  ['services', 'Services'],
  ['referred', 'Referred'],
  ['btOrder', 'BT Order'],
  ['disposal', 'Disposal'],
  ['treatmentPlan', 'Treatment Plan'],
  ['operation', 'Operation'],
  ['advice', 'Advice'],
  ['followUp', 'Follow-up'],
  ['allergy', 'Allergy'],
];

/** The C# result as the app read it: nulls as '' and text trimmed (toPrescriptionDetail's toText). */
const toText = (s: string | null): string => (s ?? '').trim();

const line = (text: string, note: string | null, isUrgent = false): PrescriptionSectionLine => ({
  text: toText(text),
  note: trimmed(note) ? toText(note) : '',
  isUrgent,
});

/** A section with no grouping of its own — one unnamed group. */
const flat = <L>(lines: L[], toLine: (l: L) => PrescriptionSectionLine): SectionGroup[] =>
  lines.length ? [{ groupName: '', lines: lines.map(toLine) }] : [];

const grouped = <L extends SummaryLine>(
  groups: SummaryGroup<L>[],
  toLine: (l: L) => PrescriptionSectionLine,
): SectionGroup[] =>
  groups
    .map(group => ({ groupName: toText(group.groupName), lines: group.lines.map(toLine) }))
    .filter(group => group.lines.length > 0);

/** Last resort for a key with no builder: its text, if it is text. Every canonical key has one. */
const plainText = (value: Json): SectionGroup[] => {
  const text = typeof value === 'string' ? trimmed(value) : '';
  return text ? [{ groupName: '', lines: [line(text, null)] }] : [];
};

const plain = (l: SummaryLine) => line(l.text, l.note);

const buildGroups = (key: string, value: Json): SectionGroup[] => {
  switch (key) {
    // The same clinical-assessment shape. An image is an SME document id the app
    // cannot fetch, so only the field's name shows, as the print does when the
    // doctor left "Show on main screen" unticked.
    case 'physicalExamination':
    case 'history':
      return grouped(buildPhysicalExam(value), l => line(l.isImage ? l.key : l.text, l.note));
    case 'chiefComplaint':
      return flat(withDurationAnd(value, 'bodyPart'), plain);
    case 'investigation':
      return flat(buildInvestigation(value), l => line(l.text, l.note, l.isUrgent));
    case 'investigationFindings':
      return grouped(buildInvestigationFinding(value), plain);
    case 'diagnosis':
      // "?" marks a query diagnosis, as on the print.
      return grouped(buildDiagnosis(value), l => line(l.isQuery ? `? ${l.text}` : l.text, l.note));
    case 'services':
      return flat(withDurationAnd(value, 'session'), plain);
    case 'referred':
      return grouped(buildReferred(value), plain);
    case 'btOrder':
      return flat(buildBtOrder(value), plain);
    case 'disposal':
      return grouped(buildDisposal(value), plain);
    case 'treatmentPlan':
      return flat(buildTreatmentPlan(value), plain);
    case 'operation':
      return grouped(buildOperation(value), l => line(l.text, l.note, l.isUrgent));
    case 'advice':
      return flat(buildAdvice(value), plain);
    case 'allergy':
      return flat(buildAllergy(value), plain);
    case 'followUp':
      return flat(buildFollowUp(value), plain);
    default:
      return plainText(value);
  }
};

/** The sections that carry something, in the canonical order. */
export const flattenSectionData = (sectionData: unknown): PrescriptionSection[] => {
  const root = parse(sectionData);
  if (!isObject(root)) return [];
  return SECTIONS.flatMap(([key, label]) => {
    const value = own(root, key);
    if (value === undefined) return [];
    const groups = buildGroups(key, value);
    return groups.length ? [{ key, label, groups }] : [];
  });
};

/**
 * The dates in the Follow-up section, as written ('YYYY-MM-DD'), each once —
 * for the follow-up reminders. Read as the sheet reads them: only the lines it
 * shows (those with a name), "followupDate" in any case. Other sections
 * (advice, treatment plan, services…) are never looked at.
 */
export const followUpDatesFromSectionData = (sectionData: unknown): string[] => {
  const root = parse(sectionData);
  if (!isObject(root)) return [];
  const dates = named(items(own(root, 'followUp')), item => trimmed(str(item, 'followupDate')));
  return [...new Set(dates.filter(Boolean))];
};

const toDose = (item: JsonObject): PrescriptionDose => ({
  dose: toText(str(item, 'dose')),
  durationValue: toText(str(item, 'durationValue')),
  durationUnit: toText(str(item, 'durationUnit')),
  note: toText(str(item, 'note')),
});

/** The medicines in the section data's `rx`; one without a brand is skipped. */
export const medicinesFromSectionData = (sectionData: unknown): PrescriptionMedicine[] => {
  const root = parse(sectionData);
  if (!isObject(root)) return [];
  return items(own(root, 'rx'))
    .filter(item => trimmed(str(item, 'brand')).length > 0)
    .map(item => ({
      ...toDose(item),
      type: toText(str(item, 'type')),
      generic: toText(str(item, 'generic')),
      brand: toText(trimmed(str(item, 'brand'))),
      route: toText(str(item, 'route')),
      isContinue: isTrue(item, 'isContinue'),
      isMixed: isTrue(item, 'isMixed'),
      multiDose: items(field(item, 'multiDose')).map(toDose),
    }));
};
