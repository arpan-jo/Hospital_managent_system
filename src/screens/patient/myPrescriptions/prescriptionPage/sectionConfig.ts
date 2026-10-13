import { OpdLookupType } from '@app/core';
import { INVESTIGATION_CATALOGUE } from './investigationCatalogue';

/**
 * What each of the desk's list-style sections is made of.
 *
 * Twelve of the fifteen sections are the same screen with different columns:
 * an add-box that suggests from the doctor's own vocabulary, starred
 * quick-picks, sometimes saved groups, and a list of items each carrying a few
 * extra fields. The portal writes twelve near-identical components; here that
 * shape is described once as data and rendered once, so a change to how items
 * behave is a change in one place.
 *
 * Physical Examination, History and Rx are not in here — those three genuinely
 * differ and have their own forms.
 */

/** One extra editor on an item row, beyond its name. */
export type SectionFieldConfig =
  /** Number + unit, stored as `durationValue` / `durationUnit`. */
  | { kind: 'duration' }
  | {
      kind: 'text';
      name: string;
      labelKey: string;
      /** A count rather than words — takes digits only, as the portal's number box does. */
      numeric?: boolean;
    }
  | {
      kind: 'date';
      name: string;
      labelKey: string;
      /**
       * This date and the item's duration are two ways of saying the same
       * thing, so each fills the other in and the date cannot be set behind
       * today. Only Follow-Up works this way.
       */
      followsDuration?: boolean;
    }
  | { kind: 'toggle'; name: string; labelKey: string }
  | { kind: 'select'; name: string; labelKey: string; options: string[] }
  /**
   * Free text, with `options` offered underneath as the doctor types — picking
   * one is a shortcut, not a limit. Prints like a select.
   */
  | {
      kind: 'suggest';
      name: string;
      labelKey: string;
      options: readonly string[];
      maxLength?: number;
    }
  /**
   * A doctor's name, typed, with the doctors from `/api/doctors` offered as
   * the doctor types — a referral can go to someone outside that list, as on
   * the portal. Stored as `doctorName`, plus `doctorId` when a listed doctor
   * was named.
   */
  | { kind: 'doctor'; labelKey: string };

/** A tab inside a section. */
export interface SectionTabConfig {
  key: string;
  labelKey: string;
  /**
   * The add-box's label on this tab, for a section whose tabs add different
   * things ("Add Admission" / "Add Disposal"); the section's own otherwise.
   */
  addLabelKey?: string;
  /**
   * The vocabulary this tab's add-box suggests from, when it is not the
   * section's; `null` for a tab with none — Disposal's "Admission" is not a
   * lookup type, so the portal suggests nothing there.
   */
  lookupType?: OpdLookupType | null;
  /**
   * The heading the printed page gives this tab's list, word for word as the
   * portal prints it ("Provisional Diagnosis"). English whatever the app's
   * language, so a sheet reads the same whichever screen printed it.
   */
  printLabel?: string;
  /** Only these fields show on this tab; every field when omitted. */
  fields?: string[];
  /** This tab lists the doctor's saved groups and can create one. */
  isGroupTab?: boolean;
  /**
   * The tab is a read-only view of the patient's history rather than something
   * the doctor adds to — Investigation Finding's "Previous Investigation".
   */
  isHistoryTab?: boolean;
}

export interface DeskListSectionConfig {
  /** Matches `componentKey` from the doctor's section setup. */
  key: string;
  /** Which vocabulary the add-box suggests from. */
  lookupType?: OpdLookupType;
  /** The add-box's label, worded per section as the portal words it ("Add Chief Complaint"). */
  addLabelKey: string;
  /**
   * A fixed clinical list the add-box offers alongside that vocabulary, for a
   * section whose terms are standard rather than personal. A section with one
   * also remembers what was last picked from it.
   */
  catalogue?: readonly string[];
  /**
   * 'shared' — every tab shows one list, adding from either appends to it.
   * 'separate' — each tab owns its own items, kept apart by a `tab` field.
   * Omitted — a single list, no tabs.
   */
  tabMode?: 'shared' | 'separate';
  tabs?: SectionTabConfig[];
  /** Starred items are scoped per tab under these names, rather than shared. */
  favoriteSubTypeByTab?: Record<string, string>;
  fields: SectionFieldConfig[];
}

/** One item on a section's list. Extra fields are section-defined. */
export interface SectionItem {
  name: string;
  /** Which tab it belongs to, for `separate` sections. */
  tab?: string;
  [field: string]: unknown;
}

/** As long as the portal lets a typed body part be. */
export const BODY_PART_MAX_LENGTH = 100;

/** No body-part master table exists anywhere — a static clinical list, head to toe. */
export const BODY_PARTS = [
  'Head',
  'Eye',
  'Ear',
  'Nose',
  'Throat',
  'Neck',
  'Chest',
  'Abdomen',
  'Back',
  'Pelvis',
  'Arm',
  'Elbow',
  'Wrist',
  'Hand',
  'Hip',
  'Knee',
  'Leg',
  'Ankle',
  'Foot',
  'Skin',
  'Whole Body',
];

const NOTE_FIELD: SectionFieldConfig = {
  kind: 'text',
  name: 'note',
  labelKey: 'doctorDesk.item.note',
};

export const DESK_LIST_SECTIONS: Record<string, DeskListSectionConfig> = {
  chiefComplaint: {
    key: 'chiefComplaint',
    addLabelKey: 'doctorDesk.add.chiefComplaint',
    lookupType: 'ChiefComplaint',
    tabMode: 'shared',
    tabs: [
      { key: 'chief', labelKey: 'doctorDesk.tabs.chiefComplaint' },
      { key: 'group', labelKey: 'doctorDesk.tabs.groupChiefComplaint', isGroupTab: true },
    ],
    fields: [
      { kind: 'duration' },
      // Typed, with the list as suggestions — "Left shoulder" is a body part
      // too. The portal made this free text on 2026-09-02.
      {
        kind: 'suggest',
        name: 'bodyPart',
        labelKey: 'doctorDesk.item.bodyPart',
        options: BODY_PARTS,
        maxLength: BODY_PART_MAX_LENGTH,
      },
      NOTE_FIELD,
    ],
  },

  investigation: {
    key: 'investigation',
    addLabelKey: 'doctorDesk.add.investigation',
    lookupType: 'Investigation',
    catalogue: INVESTIGATION_CATALOGUE,
    tabMode: 'shared',
    tabs: [
      { key: 'investigation', labelKey: 'doctorDesk.tabs.investigation' },
      { key: 'group', labelKey: 'doctorDesk.tabs.groupInvestigation', isGroupTab: true },
    ],
    fields: [
      { kind: 'date', name: 'date', labelKey: 'doctorDesk.item.date' },
      { kind: 'toggle', name: 'isUrgent', labelKey: 'doctorDesk.item.urgent' },
      NOTE_FIELD,
    ],
  },

  investigationFindings: {
    key: 'investigationFindings',
    addLabelKey: 'doctorDesk.add.investigationFinding',
    lookupType: 'Investigation',
    tabMode: 'separate',
    tabs: [
      {
        key: 'notes',
        labelKey: 'doctorDesk.tabs.findingNotes',
        printLabel: 'Investigation Findings Notes',
      },
      {
        key: 'previous',
        labelKey: 'doctorDesk.tabs.previousInvestigation',
        isHistoryTab: true,
      },
    ],
    fields: [
      { kind: 'date', name: 'date', labelKey: 'doctorDesk.item.date' },
      { kind: 'text', name: 'result', labelKey: 'doctorDesk.item.result' },
      NOTE_FIELD,
    ],
  },

  diagnosis: {
    key: 'diagnosis',
    addLabelKey: 'doctorDesk.add.diagnosis',
    lookupType: 'Diagnosis',
    tabMode: 'separate',
    tabs: [
      {
        key: 'provisional',
        labelKey: 'doctorDesk.tabs.provisional',
        printLabel: 'Provisional Diagnosis',
      },
      { key: 'final', labelKey: 'doctorDesk.tabs.final', printLabel: 'Final Diagnosis' },
    ],
    favoriteSubTypeByTab: {
      provisional: 'ProvisionalDiagnosis',
      final: 'FinalDiagnosis',
    },
    fields: [
      { kind: 'toggle', name: 'isQuery', labelKey: 'doctorDesk.item.query' },
      { kind: 'duration' },
      NOTE_FIELD,
    ],
  },

  services: {
    key: 'services',
    addLabelKey: 'doctorDesk.add.service',
    lookupType: 'Services',
    fields: [
      { kind: 'duration' },
      { kind: 'text', name: 'session', labelKey: 'doctorDesk.item.session' },
      NOTE_FIELD,
    ],
  },

  referred: {
    key: 'referred',
    addLabelKey: 'doctorDesk.add.referred',
    lookupType: 'Referred',
    tabMode: 'separate',
    tabs: [
      {
        key: 'internal',
        labelKey: 'doctorDesk.tabs.internalReferred',
        printLabel: 'Internal Referred',
        fields: ['doctor', 'note'],
      },
      {
        key: 'external',
        labelKey: 'doctorDesk.tabs.externalReferred',
        printLabel: 'External Referred',
        fields: ['departmentName', 'note'],
      },
    ],
    favoriteSubTypeByTab: { internal: 'InternalReferred', external: 'ExternalReferred' },
    fields: [
      { kind: 'doctor', labelKey: 'doctorDesk.item.doctor' },
      // No department endpoint exists, so this is typed rather than picked.
      { kind: 'text', name: 'departmentName', labelKey: 'doctorDesk.item.department' },
      NOTE_FIELD,
    ],
  },

  btOrder: {
    key: 'btOrder',
    addLabelKey: 'doctorDesk.add.btOrder',
    lookupType: 'BtOrder',
    fields: [NOTE_FIELD],
  },

  disposal: {
    key: 'disposal',
    addLabelKey: 'doctorDesk.add.disposal',
    lookupType: 'Disposal',
    tabMode: 'separate',
    tabs: [
      {
        key: 'admission',
        labelKey: 'doctorDesk.tabs.admission',
        addLabelKey: 'doctorDesk.add.admission',
        lookupType: null,
        printLabel: 'Admission',
        fields: ['doctor', 'roomName', 'note'],
      },
      {
        key: 'disposal',
        labelKey: 'doctorDesk.tabs.disposal',
        addLabelKey: 'doctorDesk.add.disposal',
        printLabel: 'Disposal',
        fields: ['duration', 'note'],
      },
    ],
    favoriteSubTypeByTab: { admission: 'Admission', disposal: 'Disposal' },
    fields: [
      { kind: 'doctor', labelKey: 'doctorDesk.item.doctor' },
      // No ward/room endpoint exists either — typed, same as the department above.
      { kind: 'text', name: 'roomName', labelKey: 'doctorDesk.item.ward' },
      { kind: 'duration' },
      NOTE_FIELD,
    ],
  },

  treatmentPlan: {
    key: 'treatmentPlan',
    addLabelKey: 'doctorDesk.add.treatmentPlan',
    lookupType: 'TreatmentPlan',
    fields: [
      { kind: 'text', name: 'step', labelKey: 'doctorDesk.item.step', numeric: true },
      { kind: 'date', name: 'plannedDate', labelKey: 'doctorDesk.item.plannedDate' },
      { kind: 'date', name: 'treatmentDate', labelKey: 'doctorDesk.item.treatmentDate' },
      { kind: 'toggle', name: 'isCompleted', labelKey: 'doctorDesk.item.completed' },
      NOTE_FIELD,
    ],
  },

  operation: {
    key: 'operation',
    addLabelKey: 'doctorDesk.add.operation',
    lookupType: 'Operation',
    tabMode: 'separate',
    tabs: [
      {
        key: 'operation',
        labelKey: 'doctorDesk.tabs.operation',
        addLabelKey: 'doctorDesk.add.operation',
        printLabel: 'Operation',
        fields: ['date', 'isUrgent', 'note'],
      },
      {
        key: 'procedure',
        labelKey: 'doctorDesk.tabs.procedure',
        addLabelKey: 'doctorDesk.add.procedure',
        printLabel: 'Procedure / Minor OT',
        fields: ['date', 'note'],
      },
    ],
    favoriteSubTypeByTab: { operation: 'Operation', procedure: 'ProcedureMinorOT' },
    fields: [
      { kind: 'date', name: 'date', labelKey: 'doctorDesk.item.date' },
      { kind: 'toggle', name: 'isUrgent', labelKey: 'doctorDesk.item.urgent' },
      NOTE_FIELD,
    ],
  },

  advice: {
    key: 'advice',
    addLabelKey: 'doctorDesk.add.advice',
    lookupType: 'Advice',
    tabMode: 'shared',
    tabs: [
      { key: 'advice', labelKey: 'doctorDesk.tabs.advice' },
      { key: 'group', labelKey: 'doctorDesk.tabs.groupAdvice', isGroupTab: true },
    ],
    fields: [NOTE_FIELD],
  },

  followUp: {
    key: 'followUp',
    addLabelKey: 'doctorDesk.add.followUp',
    lookupType: 'FollowUp',
    tabMode: 'shared',
    tabs: [
      { key: 'followUp', labelKey: 'doctorDesk.tabs.followUp' },
      { key: 'group', labelKey: 'doctorDesk.tabs.groupFollowUp', isGroupTab: true },
    ],
    fields: [
      { kind: 'duration' },
      {
        kind: 'date',
        name: 'followupDate',
        labelKey: 'doctorDesk.item.followUpDate',
        followsDuration: true,
      },
      NOTE_FIELD,
    ],
  },
};

/** The name a field is stored under — `duration` covers two keys, so it is its own case. */
export const fieldName = (field: SectionFieldConfig): string => {
  if (field?.kind === 'duration') return 'duration';
  if (field?.kind === 'doctor') return 'doctor';
  return field?.name ?? '';
};

/** Narrows a section's fields to the ones the given tab shows. */
export const fieldsForTab = (
  config?: DeskListSectionConfig,
  tabKey?: string,
): SectionFieldConfig[] => {
  const fields = config?.fields ?? [];
  const tab = config?.tabs?.find(item => item?.key === tabKey);
  if (!tab?.fields) return fields;

  return fields.filter(field => tab.fields?.includes(fieldName(field)));
};
