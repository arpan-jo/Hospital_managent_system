/**
 * Display formatters shared by screens. Kept dependency-free so they stay
 * unit-testable without the React Native runtime.
 */

/** 1000 -> "1,000". Avoids Intl/toLocaleString, which varies across Hermes builds. */
export const groupThousands = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  const negative = value < 0;
  const [whole, fraction] = Math.abs(value).toString().split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
};

/** Fixed 2-decimal money string with thousands separators: 1000 -> "1,000.00". */
export const formatMoney = (value: number): string => {
  const safe = Number.isFinite(value) ? value : 0;
  const [whole, fraction] = Math.abs(safe).toFixed(2).split('.');
  return `${safe < 0 ? '-' : ''}${groupThousands(Number(whole))}.${fraction}`;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** "27/07/2026" — avoids Intl, which is inconsistent across Hermes builds. */
export const formatShortDate = (date: Date): string =>
  `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;

/** "27 Jul 2026". Month names are passed in so they stay in the locale files. */
export const formatDayMonthYear = (date: Date, monthNames: string[]): string =>
  `${date.getDate()} ${monthNames[date.getMonth()] ?? ''} ${date.getFullYear()}`;

/** "2026-08-10" — for passing dates through serializable navigation params. */
export const toISODate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** Parses "YYYY-MM-DD" into a local Date at midnight. Invalid input returns today. */
export const fromISODate = (value: string | undefined | null): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

/** The English month abbreviations the API dates its rows with. */
const API_MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

/**
 * Normalises whatever a payload calls a date into "YYYY-MM-DD".
 *
 * Some endpoints date their rows for display rather than for parsing — the
 * documents list sends "06 Aug 2026" — and `fromISODate` answers *today* for
 * anything it cannot read, which silently stamps every row with the current
 * date. Run payload dates through here first; unreadable input becomes '' so
 * the screen can show a dash instead of a wrong date.
 */
export const toISODateFromApi = (value: string | undefined | null): string => {
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const match = /^(\d{1,2})[\s-]+([A-Za-z]{3,})[\s-]+(\d{4})$/.exec(text);
  if (!match) return '';

  const month = API_MONTHS.indexOf(match[2].slice(0, 3).toLowerCase());
  if (month < 0) return '';

  return `${match[3]}-${pad2(month + 1)}-${pad2(Number(match[1]))}`;
};

/** "14:00" -> "2:00 PM". Returns the input untouched if it is not HH:mm. */
export const to12Hour = (time: string): string => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? '');
  if (!match) return time ?? '';
  const hours = Number(match[1]);
  if (hours > 23) return time;
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${suffix}`;
};

/**
 * Whole years since an ISO birth date. Returns 0 for missing/unparseable input
 * rather than NaN, so it is safe to render straight into a label.
 */
export const calculateAge = (isoDate: string | undefined | null): number => {
  const birth = fromISODate(isoDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate ?? '')) return 0;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return Math.max(age, 0);
};

/** "2003-02-02" -> "Feb 2, 2003". Month names are passed in from the locale files. */
export const formatLongDate = (isoDate: string, monthNames: string[]): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate ?? '')) return isoDate ?? '';
  const date = fromISODate(isoDate);
  return `${monthNames[date.getMonth()] ?? ''} ${date.getDate()}, ${date.getFullYear()}`;
};

/**
 * 'male' -> 'Male'. Enum-ish values come back from the API in whatever case
 * they were stored in, and every screen wants them shown the same way.
 */
export const toTitleCase = (value: string | undefined | null): string => {
  const text = String(value ?? '').trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1).toLowerCase()}` : '';
};

/**
 * Drops a leading title so initials come from the name itself:
 * "Dr. Shad" -> "Shad", "Dr.Shad" -> "Shad", "MD. Tamim Hasan" -> "Tamim Hasan".
 *
 * The title must be closed by a dot or by whitespace. Accounts are registered
 * without the space ("Dr.Shad") often enough that requiring one left the title
 * in place; requiring neither would eat the start of a real name like
 * "Mstislav", which opens with one of these titles.
 */
export const stripHonorific = (name: string | undefined | null): string =>
  (name ?? '')
    .replace(/^\s*(dr|prof|mr|mrs|ms|md|mohammad)(\.\s*|\s+)/i, '')
    .trim();

/**
 * A doctor's name as the portal shows it: "Dr." in front, once.
 * "Md. Emdad Karim" -> "Dr. Md. Emdad Karim", "Dr.Ahmed" -> "Dr. Ahmed".
 *
 * Only a "Dr" title already in the stored name is replaced. "Md." and
 * "Mohammad" are part of a Bangladeshi name, not a title to drop —
 * `stripHonorific` drops them because it only feeds initials.
 */
export const withDoctorTitle = (name: string | undefined | null): string => {
  const bare = (name ?? '').replace(/^\s*dr(\.\s*|\s+)/i, '').trim();
  return bare ? `Dr. ${bare}` : '';
};

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'];

/** 954368 -> "932 KB". Falls back to "0 B" for missing or nonsense input. */
export const formatFileSize = (bytes: number | undefined | null): string => {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';

  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < FILE_SIZE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  // Bytes are always whole; larger units keep one decimal unless it is .0.
  const rounded = unit === 0 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${rounded} ${FILE_SIZE_UNITS[unit]}`;
};

/** "OIP.jpg" -> "JPG". Returns '' when the name carries no extension. */
export const fileExtensionLabel = (filename: string | undefined | null): string => {
  const parts = (filename ?? '').split('.');
  return parts.length > 1 ? (parts.pop() ?? '').toUpperCase() : '';
};
