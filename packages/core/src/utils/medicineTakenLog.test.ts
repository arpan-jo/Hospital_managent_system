import { medicineDoseKey, readTakenLog, takenLogDay, toggleTakenDose } from './medicineTakenLog';

const mockStore = new Map<string, string>();
const mockStorage = {
  getString: jest.fn((key: string) => mockStore.get(key)),
  set: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
  }),
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
