/**
 * Reserved keys of a prescription's assessment data.
 *
 * Physical Examination and History are stored as groups of fields. Ahead of
 * the groups a doctor configured come ones nobody can remove — the vitals
 * taken at booking, and the past history and continuing medicines recorded
 * with them. They sit under these keys in the very same shape a configured
 * group produces, so the summary and the printed page treat them identically.
 */

/** Reserved key holding the ordered group list, so a summary can name them. */
export const GROUPS_META_KEY = '__groups';

export const VITALS_GROUP_KEY = '__vitals';
export const PAST_HISTORY_GROUP_KEY = '__pastHistory';
export const CONTINUE_MEDICINE_GROUP_KEY = '__continueMedicine';

/** Where each add-and-list field type keeps the names it has collected. */
export const SEARCH_LIST_KEY = '__extraFields';
export const MEDICINE_LIST_KEY = '__medicineItems';
export const INVESTIGATION_LIST_KEY = '__investigationItems';

export const NOTE_SUFFIX = '_Note';
