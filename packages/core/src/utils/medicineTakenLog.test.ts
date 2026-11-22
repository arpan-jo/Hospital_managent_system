import {
  TAKEN_LOG_KEEP_DAYS,
  medicineDoseKey,
  pruneTakenLogs,
  readTakenLog,
  takenLogDay,
  toggleTakenDose,
} from './medicineTakenLog';

const mockStore = new Map<string, string>();
const mockStorage = {
  getString: jest.fn((key: string) => mockStore.get(key)),
  set: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
  }),
  getAllKeys: jest.fn(() => Array.from(mockStore.keys())),
  remove: jest.fn((key: string) => mockStore.delete(key)),
};

jest.mock('./secureStorage', () => ({
  get storage() {
    return mockStorage;
  },
}));

const DAY = '2026-11-22';
const KEY = `med-log-${DAY}`;

beforeEach(() => {
  mockStore.clear();
  mockStorage.getString.mockClear();
  mockStorage.set.mockClear();
  mockStorage.getAllKeys.mockClear();
  mockStorage.remove.mockClear();
});

describe('medicine taken log', () => {
  it('keys a dose and a day as the portal does', () => {
    expect(medicineDoseKey(123, 'night')).toBe('123_night');
    expect(takenLogDay(new Date(2026, 10, 22, 23, 59))).toBe(DAY);
    // A broken date falls back to today rather than "NaN-NaN-NaN".
    expect(takenLogDay(new Date(NaN))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('reads what is stored, and nothing from a missing or broken record', () => {
    expect(readTakenLog(DAY)).toEqual({});
    mockStore.set(KEY, '{"1_morning":true}');
    expect(readTakenLog(DAY)).toEqual({ '1_morning': true });
    mockStore.set(KEY, 'not json');
    expect(readTakenLog(DAY)).toEqual({});
    mockStore.set(KEY, '[1,2]');
    expect(readTakenLog(DAY)).toEqual({});
    mockStore.set(KEY, 'null');
    expect(readTakenLog(DAY)).toEqual({});
  });

  it('flips a tick on top of what is stored now, so a tick made on the other panel is kept', () => {
    // The Dashboard panel ticked the morning dose…
    expect(toggleTakenDose('1_morning', DAY)).toEqual({ '1_morning': true });
    // …then My Prescriptions, which opened before that, ticks the night dose.
    expect(toggleTakenDose('1_night', DAY)).toEqual({ '1_morning': true, '1_night': true });
    expect(JSON.parse(mockStore.get(KEY) ?? '{}')).toEqual({ '1_morning': true, '1_night': true });
    // A second tap takes it back off.
    expect(toggleTakenDose('1_morning', DAY)).toEqual({ '1_morning': false, '1_night': true });
  });

  it('keeps each day to itself', () => {
    toggleTakenDose('1_morning', '2026-11-21');
    expect(readTakenLog(DAY)).toEqual({});
  });

  it('never throws: a failed read or write still answers', () => {
    mockStorage.getString.mockImplementationOnce(() => {
      throw new Error('storage gone');
    });
    expect(readTakenLog(DAY)).toEqual({});
    mockStorage.set.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    expect(toggleTakenDose('2_night', DAY)).toEqual({ '2_night': true });
    expect(toggleTakenDose('', DAY)).toEqual({});
  });
});

describe('pruneTakenLogs', () => {
  const NOW = new Date(2026, 10, 22, 9, 0); // 2026-11-22

  it('keeps today and the last seven days, and takes away older days', () => {
    expect(TAKEN_LOG_KEEP_DAYS).toBe(7);
    for (const day of ['2026-11-22', '2026-11-21', '2026-11-15', '2026-11-14', '2026-10-01', '2025-12-31']) {
      mockStore.set(`med-log-${day}`, '{"1_morning":true}');
    }
    expect(pruneTakenLogs(TAKEN_LOG_KEEP_DAYS, NOW)).toBe(3);
    expect(Array.from(mockStore.keys()).sort()).toEqual([
      'med-log-2026-11-15',
      'med-log-2026-11-21',
      'med-log-2026-11-22',
    ]);
  });

  it('counts back across a month and a year', () => {
    mockStore.set('med-log-2026-12-31', '{}');
    mockStore.set('med-log-2026-12-24', '{}');
    mockStore.set('med-log-2026-12-25', '{}');
    expect(pruneTakenLogs(7, new Date(2027, 0, 1))).toBe(1);
    expect(mockStore.has('med-log-2026-12-24')).toBe(false);
    expect(mockStore.has('med-log-2026-12-25')).toBe(true);
  });

  it('never touches anything but a day record — other keys, odd names, a later day', () => {
    mockStore.set('reminder_permission_asked', 'true');
    mockStore.set('reminder_followup_records_5', '{}');
    mockStore.set('med-log-2020-01-01-extra', '{}');
    mockStore.set('med-log-bad', '{}');
    mockStore.set('cache_med-log-2020-01-01', '{}');
    mockStore.set('med-log-2026-12-01', '{}');
    expect(pruneTakenLogs(7, NOW)).toBe(0);
    expect(mockStore.size).toBe(6);
  });

  it('never throws, whatever the storage does', () => {
    mockStorage.getAllKeys.mockImplementationOnce(() => {
      throw new Error('storage gone');
    });
    expect(pruneTakenLogs(7, NOW)).toBe(0);
    mockStorage.getAllKeys.mockImplementationOnce(() => null as any);
    expect(pruneTakenLogs(7, NOW)).toBe(0);
    expect(pruneTakenLogs(7, new Date(NaN))).toBe(0);
    expect(pruneTakenLogs(NaN as any)).toBe(0);
  });
});
