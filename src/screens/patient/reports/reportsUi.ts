/** How the Reports page reads on screen — dates, colours and labels shared by its sections. */
import { formatDayMonthYear, fromISODate, to12Hour, toISODateFromApi } from '@app/core';

type Tone = { color: string; tint: string };

const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * "12 Aug 2026". A bare 'YYYY-MM-DD' is read as calendar parts, an ISO time
 * as the patient's own day — the portal's `formatRecordDate`. '' when unreadable.
 */
export const formatRecordDate = (value: string | null | undefined, months: string[]): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return formatDayMonthYear(fromISODate(text), months);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : formatDayMonthYear(date, months);
};

/** "12 Aug 2026, 3:40 PM". */
export const formatRecordDateTime = (value: string | null | undefined, months: string[]): string => {
  const text = String(value ?? '').trim();
  const date = new Date(text);
  if (!text || /^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime())) {
    return formatRecordDate(text, months);
  }
  const time = to12Hour(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`);
  return `${formatDayMonthYear(date, months)}, ${time}`;
};

/** The upload date as the server words it ("14 Oct 2026"), in the app's month names. */
export const formatUploadDate = (value: string | null | undefined, months: string[]): string => {
  const iso = toISODateFromApi(value);
  return iso ? formatDayMonthYear(fromISODate(iso), months) : String(value ?? '');
};

/** The portal's document size: "0 B", "512 B", "24.6 KB", "1.2 MB". */
export const formatBytes = (bytes?: number | null): string => {
  const size = Number(bytes ?? 0) || 0;
  if (size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const IMAGE_EXTENSIONS = ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG'];

/** The icon a document gets from its extension, as on the portal. */
export const fileIcon = (extension?: string | null): string => {
  const ext = String(extension ?? '').toUpperCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image-outline';
  return ext === 'PDF' ? 'file-pdf-box' : 'file-outline';
};

/** The portal's category colours — blue, purple, green, amber, red, grey. */
const CATEGORY_LIGHT: Record<string, Tone> = {
  'Lab Report': { color: '#2F55D4', tint: '#EAF0FF' },
  'X-Ray / Scan': { color: '#7C3AED', tint: '#F2EBFF' },
  Prescription: { color: '#1B8A4B', tint: '#E6F6EC' },
  'Medical Certificate': { color: '#B27400', tint: '#FEF3E0' },
  'Discharge Summary': { color: '#C62828', tint: '#FDECEC' },
  Other: { color: '#5F6478', tint: '#EEEFF4' },
};

const CATEGORY_DARK: Record<string, Tone> = {
  'Lab Report': { color: '#9FB4FF', tint: '#1F2A4F' },
  'X-Ray / Scan': { color: '#C9B2FF', tint: '#2C2148' },
  Prescription: { color: '#6FD3A0', tint: '#173126' },
  'Medical Certificate': { color: '#F5C26B', tint: '#3A2E14' },
  'Discharge Summary': { color: '#F2B8B5', tint: '#3A1F1E' },
  Other: { color: '#B9BFD4', tint: '#272B3A' },
};

export const categoryTone = (category: string, isDark?: boolean): Tone =>
  (isDark ? CATEGORY_DARK : CATEGORY_LIGHT)[category] ??
  (isDark ? CATEGORY_DARK.Other : CATEGORY_LIGHT.Other);

/** The translation of a category the web offers; any other is shown as stored. */
export const CATEGORY_LABEL_KEY: Record<string, string> = {
  'Lab Report': 'myPrescriptions.categoryLabReport',
  'X-Ray / Scan': 'myPrescriptions.categoryXrayScan',
  Prescription: 'myPrescriptions.categoryPrescription',
  'Medical Certificate': 'myPrescriptions.categoryMedicalCertificate',
  'Discharge Summary': 'myPrescriptions.categoryDischargeSummary',
  Other: 'myPrescriptions.categoryOther',
};

/** Each section's icon and colour — the portal's blue flask, purple scan and green pill. */
export const RECORD_TONE = {
  pathology: {
    icon: 'flask-outline',
    light: { color: '#2F55D4', tint: '#EAF0FF' },
    dark: { color: '#9FB4FF', tint: '#1F2A4F' },
  },
  radiology: {
    icon: 'radiology-box-outline',
    light: { color: '#7C3AED', tint: '#F2EBFF' },
    dark: { color: '#C9B2FF', tint: '#2C2148' },
  },
  prescriptions: {
    icon: 'pill',
    light: { color: '#1B8A4B', tint: '#E6F6EC' },
    dark: { color: '#6FD3A0', tint: '#173126' },
  },
} as const;

export type RecordKind = keyof typeof RECORD_TONE;

export const recordTone = (kind: RecordKind, isDark?: boolean): Tone =>
  isDark ? RECORD_TONE[kind].dark : RECORD_TONE[kind].light;

/** Age from a birth date, "12Y 3M 4D" — the portal's report sheet; '-' when unknown. */
export const formatAge = (dob?: string | null, today: Date = new Date()): string => {
  const text = String(dob ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '-';
  const birth = fromISODate(text);
  if (birth.getTime() > today.getTime()) return '-';

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();
  if (days < 0) {
    months -= 1;
    // Borrow the length of the month before this one.
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${years}Y ${months}M ${days}D`;
};

/** "06/08/26 03:40 PM" — the report sheet's date and time; '-' when unknown. */
export const formatSheetDateTime = (value: string | Date | null | undefined, yearDigits: 2 | 4 = 2): string => {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  if (!value || Number.isNaN(date.getTime())) return '-';
  const year = String(date.getFullYear());
  const hours = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${
    yearDigits === 4 ? year : year.slice(-2)
  } ${pad2(hours)}:${pad2(date.getMinutes())} ${date.getHours() < 12 ? 'AM' : 'PM'}`;
};
