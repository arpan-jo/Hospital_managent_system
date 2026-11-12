import { VitalsRecord } from '@app/core';
import { formatBloodPressure, hasTrend, metricValue, trendSeries } from './vitalsUi';

jest.mock('@app/core', () => ({}));

const record = (fields: Partial<VitalsRecord>): VitalsRecord => ({
  id: 1,
  appointmentId: 1,
  recordedAt: '2026-11-01T10:00:00',
  bpSys: null,
  bpDia: null,
  pulse: null,
  tempCelsius: null,
  spo2: null,
  respRate: null,
  heightCm: null,
  weightKg: null,
  bmi: null,
  doctorName: '',
  isUploaded: false,
  patientRegistrationId: 1,
  patientName: 'Al Amin',
  patientCode: 'P-1',
  ...fields,
});

describe('formatBloodPressure', () => {
  it('prints both sides', () => {
    expect(formatBloodPressure(record({ bpSys: 120, bpDia: 80 }))).toBe('120/80');
  });

  it('dashes a missing lower side, as the portal does', () => {
    expect(formatBloodPressure(record({ bpSys: 130 }))).toBe('130/—');
  });

  it('is blank without the upper side', () => {
    expect(formatBloodPressure(record({ bpDia: 80 }))).toBe('');
    expect(formatBloodPressure(null)).toBe('');
  });
});

describe('metricValue', () => {
  it('reads each measure as sent', () => {
    const sitting = record({ pulse: 72, spo2: 98, tempCelsius: 36.8, weightKg: 68.5, bmi: 23.7 });
    expect(metricValue(sitting, 'pulse')).toBe('72');
    expect(metricValue(sitting, 'spo2')).toBe('98');
    expect(metricValue(sitting, 'temp')).toBe('36.8');
    expect(metricValue(sitting, 'weight')).toBe('68.5');
    expect(metricValue(sitting, 'bmi')).toBe('23.7');
  });

  it('is blank for a measure not taken', () => {
    expect(metricValue(record({}), 'pulse')).toBe('');
    expect(metricValue(undefined, 'bmi')).toBe('');
  });
});

describe('trendSeries / hasTrend', () => {
  const rows = [
    record({ recordedAt: '2026-10-01T10:00:00', bpSys: 120, bpDia: 80, pulse: 70 }),
    record({ recordedAt: '2026-10-15T10:00:00', pulse: 75 }),
    record({ recordedAt: '2026-11-01T10:00:00', bpSys: 128, bpDia: 84, spo2: 97 }),
  ];

  it('draws blood pressure as two lines, gaps left as null', () => {
    expect(trendSeries(rows, 'bp').lines).toEqual([
      [120, null, 128],
      [80, null, 84],
    ]);
  });

  it('charts a measure from its first reading, as the portal does', () => {
    expect(hasTrend(rows, 'bp')).toBe(true);
    expect(hasTrend(rows, 'pulse')).toBe(true);
    // Taken once: a dot, not yet a line — still charted.
    expect(hasTrend(rows, 'spo2')).toBe(true);
    expect(hasTrend(rows, 'temp')).toBe(false);
    expect(hasTrend([], 'bp')).toBe(false);
    expect(hasTrend(null, 'bp')).toBe(false);
  });
});
