/** How vitals read on screen — shared by the latest card, the trend and the history. */
import { VitalsRecord } from '@app/core';

export type VitalsMetric = 'bp' | 'pulse' | 'spo2' | 'temp' | 'weight' | 'bmi';

/** Each measure keeps one colour everywhere it shows — tile, chip and trend line. */
const METRIC_TONE: Record<VitalsMetric, { icon: string; light: [string, string]; dark: [string, string] }> = {
  bp: { icon: 'heart-pulse', light: ['#D6336C', '#FDEBF2'], dark: ['#F59BBE', '#3A1C28'] },
  pulse: { icon: 'pulse', light: ['#E8590C', '#FFF0E6'], dark: ['#FFA36B', '#3A2416'] },
  spo2: { icon: 'water-percent', light: ['#1C7ED6', '#E7F3FF'], dark: ['#74C0FC', '#142A3D'] },
  temp: { icon: 'thermometer', light: ['#D97706', '#FFF4DB'], dark: ['#FFC34D', '#3A2E14'] },
  weight: { icon: 'scale-bathroom', light: ['#0F7B6C', '#E3F5F2'], dark: ['#5FD3C2', '#16302C'] },
  bmi: { icon: 'human-male-height', light: ['#7048E8', '#F0EBFF'], dark: ['#B197FC', '#261E3D'] },
};

export const metricTone = (metric: VitalsMetric, isDark?: boolean) => {
  const tone = METRIC_TONE[metric] ?? METRIC_TONE.bp;
  const [color, tint] = isDark ? tone.dark : tone.light;
  return { icon: tone.icon, color, tint };
};

/** The unit printed after a value; BMI has none. */
export const METRIC_UNIT: Record<VitalsMetric, string> = {
  bp: 'mmHg',
  pulse: 'bpm',
  spo2: '%',
  temp: '°C',
  weight: 'kg',
  bmi: '',
};

/** The label key of each measure; SpO₂ and BMI read the same in every language. */
export const METRIC_LABEL_KEY: Record<VitalsMetric, string> = {
  bp: 'vitals.bloodPressure',
  pulse: 'vitals.pulse',
  spo2: 'vitals.spo2',
  temp: 'vitals.temperature',
  weight: 'vitals.weight',
  bmi: 'vitals.bmi',
};

/** A reading as sent, or '' when it was not taken. */
export const formatReading = (value?: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(value);
};

/** "120/80", or "120/—" without the lower one; '' without the upper one — as the portal prints it. */
export const formatBloodPressure = (record?: VitalsRecord | null): string => {
  const sys = formatReading(record?.bpSys);
  if (!sys) return '';
  return `${sys}/${formatReading(record?.bpDia) || '—'}`;
};

/** The value of one measure as shown, '' when not taken. */
export const metricValue = (record: VitalsRecord | null | undefined, metric: VitalsMetric): string => {
  switch (metric) {
    case 'bp':
      return formatBloodPressure(record);
    case 'pulse':
      return formatReading(record?.pulse);
    case 'spo2':
      return formatReading(record?.spo2);
    case 'temp':
      return formatReading(record?.tempCelsius);
    case 'weight':
      return formatReading(record?.weightKg);
    case 'bmi':
      return formatReading(record?.bmi);
    default:
      return '';
  }
};

/** The measures the portal's history lists, in its column order. */
export const HISTORY_METRICS: VitalsMetric[] = ['bp', 'pulse', 'spo2', 'temp', 'weight', 'bmi'];

/** The measures the portal's trend draws; blood pressure as two lines. */
export const TREND_METRICS: VitalsMetric[] = ['bp', 'pulse', 'spo2', 'temp'];

/** The numbers one trend line is drawn through, oldest first. */
export const trendSeries = (
  records: VitalsRecord[] | null | undefined,
  metric: VitalsMetric,
): { lines: (number | null)[][]; dates: string[] } => {
  const rows = records ?? [];
  const pick = (read: (record: VitalsRecord) => number | null | undefined) =>
    rows.map(record => {
      const value = read(record);
      return value === null || value === undefined || !Number.isFinite(value) ? null : value;
    });
  const dates = rows.map(record => record?.recordedAt ?? '');
  switch (metric) {
    case 'bp':
      return { lines: [pick(r => r?.bpSys), pick(r => r?.bpDia)], dates };
    case 'pulse':
      return { lines: [pick(r => r?.pulse)], dates };
    case 'spo2':
      return { lines: [pick(r => r?.spo2)], dates };
    case 'temp':
      return { lines: [pick(r => r?.tempCelsius)], dates };
    default:
      return { lines: [], dates };
  }
};

/** A line needs two points — a measure taken once has no trend yet. */
export const hasTrend = (records: VitalsRecord[] | null | undefined, metric: VitalsMetric): boolean =>
  trendSeries(records, metric).lines.some(line => line.filter(value => value !== null).length >= 2);
