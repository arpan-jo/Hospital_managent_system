const mockStore = new Map<string, string | boolean>();
const mockStorage = {
  getString: jest.fn((key: string) => {
    const value = mockStore.get(key);
    return typeof value === 'string' ? value : undefined;
  }),
  getBoolean: jest.fn((key: string) => {
    const value = mockStore.get(key);
    return typeof value === 'boolean' ? value : undefined;
  }),
  set: jest.fn((key: string, value: string | boolean) => {
    mockStore.set(key, value);
  }),
  remove: jest.fn((key: string) => mockStore.delete(key)),
};

const mockNotifications = {
  scheduleReminder: jest.fn(),
  cancelReminder: jest.fn(),
  cancelReminders: jest.fn(),
  requestNotificationPermission: jest.fn(),
};

// Read when called, not when the module loads — the mocks are set up after the imports run.
jest.mock('./secureStorage', () => ({
  get storage() {
    return mockStorage;
  },
}));
jest.mock('./localNotifications', () => ({
  loadNotifee: () => ({ EventType: { DELIVERED: 3, PRESS: 1, ACTION_PRESS: 2 } }),
  scheduleReminder: (...args: any[]) => mockNotifications.scheduleReminder(...args),
  cancelReminder: (...args: any[]) => mockNotifications.cancelReminder(...args),
  cancelReminders: (...args: any[]) => mockNotifications.cancelReminders(...args),
  requestNotificationPermission: (...args: any[]) =>
    mockNotifications.requestNotificationPermission(...args),
}));
jest.mock('./i18n', () => ({
  __esModule: true,
  // The key, and its values in order: 'followUpReminder.visit(Dr. A|Thursday…)'.
  default: {
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key}(${Object.values(options).join('|')})` : key,
  },
}));

import { AppState } from 'react-native';
import {
  claimFollowUpReminders,
  clearFollowUpReminders,
  followUpReminderBody,
  followUpReminderTime,
  handleFollowUpEvent,
  parseFollowUpDay,
  planFollowUpReminders,
  scheduleFollowUpReminders,
} from './followUpReminder';

/** A local time — months 1-based, as written. */
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

const OWNER_KEY = 'reminder_followup_owner';
const recordsOf = (userId: number | string) => `reminder_followup_records_${userId}`;
const records = (userId: number | string = 7) =>
  JSON.parse((mockStore.get(recordsOf(userId)) as string) ?? '{}');
/** Every id set so far, with its time. */
const setCalls = () =>
  mockNotifications.scheduleReminder.mock.calls.map(([arg]) => `${arg.id}@${arg.at.getTime()}`);

// The jest mock's currentState is a function, so it is swapped by hand and put back after.
const originalAppState = (AppState as any).currentState;
const setAppState = (state: string) => {
  (AppState as any).currentState = state;
};
afterAll(() => {
  (AppState as any).currentState = originalAppState;
});

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

describe('parseFollowUpDay', () => {
  it("reads 'YYYY-MM-DD' as that day's local midnight", () => {
    expect(parseFollowUpDay('2026-11-21')).toEqual(at(2026, 11, 21));
  });

  it('ignores a time after the day', () => {
    expect(parseFollowUpDay('2026-11-21T00:00:00')).toEqual(at(2026, 11, 21));
    expect(parseFollowUpDay(' 2026-11-21 10:30 ')).toEqual(at(2026, 11, 21));
  });

  it('refuses what is not a real day', () => {
    ['', '2026-02-30', '2026-13-01', '21/11/2026', '2026-1-5', 'tomorrow', '০২০২৬-১১-২১'].forEach(value =>
      expect(parseFollowUpDay(value)).toBeNull(),
    );
    expect(parseFollowUpDay(null as any)).toBeNull();
    expect(parseFollowUpDay(undefined as any)).toBeNull();
  });
});

describe('followUpReminderTime', () => {
  it('the day before the follow-up, at 8 PM', () => {
    // Follow-up tomorrow, seen by the doctor in the morning.
    expect(followUpReminderTime('2026-11-19', at(2026, 11, 18, 9))).toEqual(at(2026, 11, 18, 20));
    expect(followUpReminderTime('2026-11-19', at(2026, 11, 18, 19, 59))).toEqual(at(2026, 11, 18, 20));
    // Further off.
    expect(followUpReminderTime('2026-12-25', at(2026, 11, 18, 10))).toEqual(at(2026, 12, 24, 20));
  });

  it('a follow-up 4 days off, opened for the first time on the day before: still 8 PM', () => {
    // Seen on the 18th, follow-up on the 22nd; the prescription is first opened on the 21st.
    expect(followUpReminderTime('2026-11-22', at(2026, 11, 18, 15))).toEqual(at(2026, 11, 21, 20));
    expect(followUpReminderTime('2026-11-22', at(2026, 11, 21, 15))).toEqual(at(2026, 11, 21, 20));
  });

  it('set after 8 PM on the day before (seen by the doctor late): 10 PM that evening', () => {
    expect(followUpReminderTime('2026-11-19', at(2026, 11, 18, 20))).toEqual(at(2026, 11, 18, 22));
    expect(followUpReminderTime('2026-11-19', at(2026, 11, 18, 21, 59))).toEqual(at(2026, 11, 18, 22));
    expect(followUpReminderTime('2026-11-22', at(2026, 11, 21, 21))).toEqual(at(2026, 11, 21, 22));
  });

  it('set from 10 PM on the day before: nothing', () => {
    expect(followUpReminderTime('2026-11-19', at(2026, 11, 18, 22))).toBeNull();
    expect(followUpReminderTime('2026-11-19', at(2026, 11, 18, 23, 30))).toBeNull();
  });

  it('today or past: nothing', () => {
    expect(followUpReminderTime('2026-11-18', at(2026, 11, 18, 7))).toBeNull();
    expect(followUpReminderTime('2026-11-01', at(2026, 11, 18, 7))).toBeNull();
    // Just past midnight the follow-up is today.
    expect(followUpReminderTime('2026-11-19', at(2026, 11, 19, 0, 30))).toBeNull();
  });

  it('crosses a month and a year end', () => {
    expect(followUpReminderTime('2027-01-01', at(2026, 12, 31, 10))).toEqual(at(2026, 12, 31, 20));
    expect(followUpReminderTime('2027-01-01', at(2026, 12, 31, 21))).toEqual(at(2026, 12, 31, 22));
    expect(followUpReminderTime('2027-01-02', at(2026, 12, 31, 10))).toEqual(at(2027, 1, 1, 20));
    expect(followUpReminderTime('2026-03-01', at(2026, 2, 28, 10))).toEqual(at(2026, 2, 28, 20));
    expect(followUpReminderTime('2026-03-02', at(2026, 2, 28, 10))).toEqual(at(2026, 3, 1, 20));
  });

  it('a missing or broken "now" reads as the real now, never a crash', () => {
    expect(() => followUpReminderTime('2026-11-21', null as any)).not.toThrow();
    expect(() => followUpReminderTime('2026-11-21', new Date(NaN))).not.toThrow();
  });

  it('a date it cannot read: nothing', () => {
    expect(followUpReminderTime('', at(2026, 11, 18))).toBeNull();
    expect(followUpReminderTime('2026-02-30', at(2026, 1, 1))).toBeNull();
  });
});

describe('planFollowUpReminders', () => {
  const base = { prescriptionId: 2639, doctorName: 'Aysha Akther', patientName: 'Karim', records: {} };
  const rec = (when: Date, id?: string, doctor = 'Aysha Akther', patient = 'Karim') => ({
    at: when.getTime(),
    doctor,
    patient,
    ...(id ? { id } : {}),
  });

  it('sets a new one', () => {
    const plan = planFollowUpReminders({ ...base, dates: ['2026-11-21'], now: at(2026, 11, 18, 15) });

    expect(plan.schedule).toEqual([
      { key: '2639|2026-11-21', id: 'followup-2639-2026-11-21', date: '2026-11-21', at: at(2026, 11, 20, 20), isNew: true },
    ]);
    expect(plan.cancelIds).toEqual([]);
    expect(plan.drop).toEqual([]);
  });

  it('one already set keeps its time — never moved, even where the rule would now say 8 PM', () => {
    // A stored time is kept as it was: this 10 PM stays 10 PM though the rule, at 7 PM, says 8 PM.
    const known = { '2639|2026-11-21': rec(at(2026, 11, 20, 22)) };

    const plan = planFollowUpReminders({ ...base, records: known, dates: ['2026-11-21'], now: at(2026, 11, 20, 19) });

    expect(plan.schedule).toEqual([
      { key: '2639|2026-11-21', id: 'followup-2639-2026-11-21', date: '2026-11-21', at: at(2026, 11, 20, 22), isNew: false },
    ]);
  });

  it('one that has shown is never set again (opened at 9 PM after the 8 PM one, where the rule would say 10 PM)', () => {
    const known = { '2639|2026-11-21': rec(at(2026, 11, 20, 20)) };

    const plan = planFollowUpReminders({ ...base, records: known, dates: ['2026-11-21'], now: at(2026, 11, 20, 21) });

    expect(plan.schedule).toEqual([]);
    expect(plan.cancelIds).toEqual([]);
  });

  it('a date the doctor changed: the old one goes, the new one is set', () => {
    const known = { '2639|2026-11-21': rec(at(2026, 11, 20, 20)) };

    const plan = planFollowUpReminders({ ...base, records: known, dates: ['2026-11-25'], now: at(2026, 11, 18, 15) });

    expect(plan.drop).toEqual(['2639|2026-11-21']);
    expect(plan.cancelIds).toEqual(['followup-2639-2026-11-21']);
    expect(plan.schedule.map(item => [item.id, item.at])).toEqual([['followup-2639-2026-11-25', at(2026, 11, 24, 20)]]);
  });

  it("a follow-up taken off: its reminder goes; another prescription's stays", () => {
    const known = {
      '12|2026-11-21': rec(at(2026, 11, 20, 20), undefined, 'A', 'B'),
      '123|2026-11-21': rec(at(2026, 11, 20, 20), undefined, 'C', 'D'),
    };

    const plan = planFollowUpReminders({ ...base, prescriptionId: 12, records: known, dates: [], now: at(2026, 11, 18) });

    expect(plan.drop).toEqual(['12|2026-11-21']);
    expect(plan.cancelIds).toEqual(['followup-12-2026-11-21']);
  });

  it('the same visit on another prescription relies on its reminder — never a second one', () => {
    const known = { '2700|2026-11-21': rec(at(2026, 11, 20, 20), 'followup-2700-2026-11-21', 'aysha akther ', 'KARIM') };

    const plan = planFollowUpReminders({ ...base, records: known, dates: ['2026-11-21'], now: at(2026, 11, 18) });

    expect(plan.keep).toEqual({
      '2639|2026-11-21': { at: at(2026, 11, 20, 20).getTime(), doctor: 'Aysha Akther', patient: 'Karim', id: 'followup-2700-2026-11-21' },
    });
    // Set again under the other's id (it replaces itself), never under a new one.
    expect(plan.schedule.map(item => [item.id, item.isNew])).toEqual([['followup-2700-2026-11-21', false]]);
  });

  it('another doctor on the same day is another visit', () => {
    const known = { '2700|2026-11-21': rec(at(2026, 11, 20, 20), 'followup-2700-2026-11-21') };

    const plan = planFollowUpReminders({ ...base, doctorName: 'Nabid Alam', records: known, dates: ['2026-11-21'], now: at(2026, 11, 18) });

    expect(plan.schedule.map(item => [item.id, item.isNew])).toEqual([['followup-2639-2026-11-21', true]]);
  });

  it('a shared reminder stays while the other prescription still has the visit (date changed on one)', () => {
    // A (100) set it; B (200) relies on it. The doctor moves A to the 28th.
    const known = {
      '100|2026-11-25': rec(at(2026, 11, 24, 20), 'followup-100-2026-11-25'),
      '200|2026-11-25': rec(at(2026, 11, 24, 20), 'followup-100-2026-11-25'),
    };

    const plan = planFollowUpReminders({ ...base, prescriptionId: 100, records: known, dates: ['2026-11-28'], now: at(2026, 11, 18) });

    expect(plan.drop).toEqual(['100|2026-11-25']);
    expect(plan.cancelIds).toEqual([]);
    expect(plan.schedule.map(item => item.id)).toEqual(['followup-100-2026-11-28']);
  });

  it('a shared reminder goes once the last prescription relying on it lets go', () => {
    const known = { '200|2026-11-25': rec(at(2026, 11, 24, 20), 'followup-100-2026-11-25') };

    const plan = planFollowUpReminders({ ...base, prescriptionId: 200, records: known, dates: [], now: at(2026, 11, 18) });

    expect(plan.cancelIds).toEqual(['followup-100-2026-11-25']);
  });

  it('a date written twice, or with a time, is one reminder; one it cannot read is none', () => {
    const plan = planFollowUpReminders({
      ...base,
      dates: ['2026-11-21', '2026-11-21T00:00:00', 'soon', ''],
      now: at(2026, 11, 18),
    });

    expect(plan.schedule.map(item => item.id)).toEqual(['followup-2639-2026-11-21']);
  });

  it('two dates on one prescription: one reminder each', () => {
    const plan = planFollowUpReminders({ ...base, dates: ['2026-11-21', '2026-12-18'], now: at(2026, 11, 18) });

    expect(plan.schedule.map(item => [item.id, item.at])).toEqual([
      ['followup-2639-2026-11-21', at(2026, 11, 20, 20)],
      ['followup-2639-2026-12-18', at(2026, 12, 17, 20)],
    ]);
  });

  it('copes with input of the wrong shape', () => {
    const plan = planFollowUpReminders({
      prescriptionId: 2639,
      dates: null as any,
      doctorName: undefined as any,
      patientName: null as any,
      records: [] as any,
      now: undefined as any,
    });

    expect(plan).toEqual({ schedule: [], keep: {}, drop: [], cancelIds: [] });
  });

  it('forgets the records of follow-up days already gone', () => {
    const known = {
      '1|2026-11-10': { at: 1, doctor: '', patient: '' },
      '2|2026-11-18': { at: 1, doctor: '', patient: '' },
      broken: { at: 1, doctor: '', patient: '' },
    };

    const plan = planFollowUpReminders({ ...base, records: known, dates: [], now: at(2026, 11, 18, 9) });

    expect(plan.drop).toEqual(['1|2026-11-10', 'broken']);
    expect(plan.cancelIds).toEqual([]);
  });
});

describe('followUpReminderBody', () => {
  it('who to see again and on which day (in full), and whose follow-up it is', () => {
    expect(followUpReminderBody('2026-11-19', 'Aysha Akther', 'Karim Hossain')).toBe(
      'followUpReminder.visit(Dr. Aysha Akther|dayNames.4, 19 monthNames.10)\nfollowUpReminder.patient(Karim Hossain)',
    );
  });

  it('never doubles "Dr.", and leaves out the patient it does not know', () => {
    expect(followUpReminderBody('2026-11-19', 'Dr. Aysha Akther', '')).toBe(
      'followUpReminder.visit(Dr. Aysha Akther|dayNames.4, 19 monthNames.10)',
    );
  });

  it('no doctor name: "your doctor"', () => {
    expect(followUpReminderBody('2026-11-19', '', '')).toBe('followUpReminder.visitNoDoctor(dayNames.4, 19 monthNames.10)');
  });
});

describe('scheduleFollowUpReminders', () => {
  const input = { prescriptionId: 2639, dates: ['2026-11-21'], doctorName: 'Aysha Akther', patientName: 'Karim' };

  beforeEach(() => {
    mockStore.clear();
    mockStore.set(OWNER_KEY, '7');
    Object.values(mockNotifications).forEach(fn => fn.mockReset());
    Object.values(mockStorage).forEach(fn => fn.mockClear());
    mockNotifications.scheduleReminder.mockResolvedValue(true);
    mockNotifications.requestNotificationPermission.mockResolvedValue('granted');
    setAppState('active');
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(at(2026, 11, 18, 15));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('sets it, keeps a record under the account, and carries what a late showing needs', async () => {
    await scheduleFollowUpReminders(input);

    expect(mockNotifications.scheduleReminder).toHaveBeenCalledTimes(1);
    expect(mockNotifications.scheduleReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'followup-2639-2026-11-21',
        at: at(2026, 11, 20, 20),
        title: 'followUpReminder.title',
        dismissLabel: 'followUpReminder.ok',
        channel: { id: 'follow-up-reminder', name: 'followUpReminder.channelName' },
        removeAt: at(2026, 11, 22),
        data: { followUpDate: '2026-11-21' },
      }),
    );
    expect(records(7)).toEqual({
      '2639|2026-11-21': {
        at: at(2026, 11, 20, 20).getTime(),
        doctor: 'Aysha Akther',
        patient: 'Karim',
        id: 'followup-2639-2026-11-21',
      },
    });
  });

  it('opened five times: one reminder, at the one time, asked once', async () => {
    for (let i = 0; i < 5; i += 1) await scheduleFollowUpReminders(input);

    expect(new Set(setCalls()).size).toBe(1);
    expect(mockNotifications.requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(Object.keys(records(7))).toEqual(['2639|2026-11-21']);
  });

  it('after it has shown, opening again sets nothing', async () => {
    await scheduleFollowUpReminders(input);
    mockNotifications.scheduleReminder.mockClear();
    jest.setSystemTime(at(2026, 11, 20, 21));

    await scheduleFollowUpReminders(input);

    expect(mockNotifications.scheduleReminder).not.toHaveBeenCalled();
  });

  it('one the phone could not set is tried again at the next open', async () => {
    mockNotifications.scheduleReminder.mockResolvedValueOnce(false);

    await scheduleFollowUpReminders(input);
    expect(records(7)).toEqual({});

    await scheduleFollowUpReminders(input);
    expect(Object.keys(records(7))).toEqual(['2639|2026-11-21']);
  });

  it('a changed date takes the old reminder away', async () => {
    await scheduleFollowUpReminders(input);

    await scheduleFollowUpReminders({ ...input, dates: ['2026-11-25'] });

    expect(mockNotifications.cancelReminder).toHaveBeenCalledWith('followup-2639-2026-11-21');
    expect(Object.keys(records(7))).toEqual(['2639|2026-11-25']);
  });

  it('the same visit on two prescriptions, then one moved: the other keeps its reminder (reviewer case 1)', async () => {
    await scheduleFollowUpReminders({ ...input, prescriptionId: 100, dates: ['2026-11-25'] });
    await scheduleFollowUpReminders({ ...input, prescriptionId: 200, dates: ['2026-11-25'] });
    // Only one notification for the visit.
    expect(new Set(setCalls().map(call => call.split('@')[0]))).toEqual(new Set(['followup-100-2026-11-25']));

    await scheduleFollowUpReminders({ ...input, prescriptionId: 100, dates: ['2026-11-28'] });

    expect(mockNotifications.cancelReminder).not.toHaveBeenCalledWith('followup-100-2026-11-25');
    expect(records(7)['200|2026-11-25'].id).toBe('followup-100-2026-11-25');
  });

  it('unreadable records: every follow-up reminder is taken away first, then it starts over (reviewer case 3)', async () => {
    mockStore.set(recordsOf(7), '{not json');

    await scheduleFollowUpReminders(input);

    expect(mockNotifications.cancelReminders).toHaveBeenCalledWith('followup-');
    expect(Object.keys(records(7))).toEqual(['2639|2026-11-21']);
  });

  it('asks for notifications only with the app in front, and counts only an answer (reviewer case 6)', async () => {
    setAppState('background');
    await scheduleFollowUpReminders(input);
    expect(mockNotifications.requestNotificationPermission).not.toHaveBeenCalled();

    setAppState('active');
    mockNotifications.requestNotificationPermission.mockResolvedValueOnce('unavailable');
    await scheduleFollowUpReminders({ ...input, dates: ['2026-11-26'] });
    expect(mockStore.get('reminder_permission_asked')).toBeUndefined();

    await scheduleFollowUpReminders({ ...input, dates: ['2026-11-27'] });
    expect(mockStore.get('reminder_permission_asked')).toBe(true);
    expect(mockNotifications.requestNotificationPermission).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a prescription, or without dates', async () => {
    await scheduleFollowUpReminders({ ...input, prescriptionId: 0 });
    await scheduleFollowUpReminders({ ...input, dates: [] });
    await scheduleFollowUpReminders({ ...input, dates: null as any });

    expect(mockNotifications.scheduleReminder).not.toHaveBeenCalled();
    expect(mockNotifications.requestNotificationPermission).not.toHaveBeenCalled();
  });

  it('never throws', async () => {
    mockStorage.getString.mockImplementationOnce(() => {
      throw new Error('storage gone');
    });
    mockNotifications.scheduleReminder.mockRejectedValueOnce(new Error('native gone'));

    await expect(scheduleFollowUpReminders(input)).resolves.toBeUndefined();
    await expect(scheduleFollowUpReminders(undefined as any)).resolves.toBeUndefined();
  });
});

describe('Logout and signing in', () => {
  const input = { prescriptionId: 2639, dates: ['2026-11-25'], doctorName: 'Aysha Akther', patientName: 'Karim' };

  beforeEach(() => {
    mockStore.clear();
    Object.values(mockNotifications).forEach(fn => fn.mockReset());
    mockNotifications.scheduleReminder.mockResolvedValue(true);
    mockNotifications.cancelReminders.mockResolvedValue(undefined);
    mockNotifications.requestNotificationPermission.mockResolvedValue('granted');
    setAppState('active');
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(at(2026, 11, 18, 15));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('Logout takes every follow-up reminder off the phone', async () => {
    mockStore.set(OWNER_KEY, '7');

    await clearFollowUpReminders();

    expect(mockNotifications.cancelReminders).toHaveBeenCalledWith('followup-');
    expect(mockStore.has(OWNER_KEY)).toBe(false);
  });

  it('the same account signing in again brings back only those still to come — never a second (reviewer case 2)', async () => {
    claimFollowUpReminders(7);
    await flush();
    await scheduleFollowUpReminders(input); // 24 Nov, 8 PM
    await scheduleFollowUpReminders({ ...input, prescriptionId: 3000, dates: ['2026-11-30'] }); // 29 Nov, 8 PM

    // The 24th's has shown; the patient logs out at 8:30 PM and back in.
    jest.setSystemTime(at(2026, 11, 24, 20, 30));
    await clearFollowUpReminders();
    mockNotifications.scheduleReminder.mockClear();
    claimFollowUpReminders(7);
    await flush();

    expect(setCalls()).toEqual([`followup-3000-2026-11-30@${at(2026, 11, 29, 20).getTime()}`]);

    // Opening the prescription again: still nothing new for the 25th.
    mockNotifications.scheduleReminder.mockClear();
    await scheduleFollowUpReminders(input);
    expect(mockNotifications.scheduleReminder).not.toHaveBeenCalled();
  });

  it("another account signing in: the last one's are taken away, and its own come back", async () => {
    claimFollowUpReminders(7);
    await flush();
    await scheduleFollowUpReminders(input);

    mockNotifications.scheduleReminder.mockClear();
    mockNotifications.cancelReminders.mockClear();
    claimFollowUpReminders(8);
    await flush();

    expect(mockNotifications.cancelReminders).toHaveBeenCalledWith('followup-');
    expect(mockNotifications.scheduleReminder).not.toHaveBeenCalled(); // 8 has none
    expect(mockStore.get(OWNER_KEY)).toBe('8');

    // Back to 7: its reminder returns, the same one.
    claimFollowUpReminders(7);
    await flush();
    expect(setCalls()).toEqual([`followup-2639-2026-11-25@${at(2026, 11, 24, 20).getTime()}`]);
  });

  it('the same account staying signed in (a relaunch) changes nothing', async () => {
    mockStore.set(OWNER_KEY, '7');

    claimFollowUpReminders(7);
    await flush();

    expect(mockNotifications.cancelReminders).not.toHaveBeenCalled();
    expect(mockNotifications.scheduleReminder).not.toHaveBeenCalled();
  });

  it('an unknown account (id 0) changes nothing', async () => {
    mockStore.set(OWNER_KEY, '7');

    claimFollowUpReminders(0);
    await flush();

    expect(mockStore.get(OWNER_KEY)).toBe('7');
    expect(mockNotifications.cancelReminders).not.toHaveBeenCalled();
  });
});

describe('handleFollowUpEvent — only ever the day before (reviewer case 4)', () => {
  const delivered = (data: Record<string, string>, id = 'followup-2639-2026-11-25', type = 3) => ({
    type,
    detail: { notification: { id, title: 'Follow-up visit tomorrow', data } },
  });
  const data = { followUpDate: '2026-11-25' };

  beforeEach(() => {
    Object.values(mockNotifications).forEach(fn => fn.mockReset());
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  });

  afterEach(() => jest.useRealTimers());

  it('on time, the day before (even late that night): left as it is', async () => {
    jest.setSystemTime(at(2026, 11, 24, 20));
    await handleFollowUpEvent(delivered(data) as any);
    jest.setSystemTime(at(2026, 11, 24, 23, 59));
    await handleFollowUpEvent(delivered(data) as any);

    expect(mockNotifications.cancelReminder).not.toHaveBeenCalled();
  });

  it('put up on the follow-up day (the phone was off the evening before): taken away at once', async () => {
    jest.setSystemTime(at(2026, 11, 25, 0, 0));
    await handleFollowUpEvent(delivered(data) as any);
    jest.setSystemTime(at(2026, 11, 25, 8));
    await handleFollowUpEvent(delivered(data) as any);

    expect(mockNotifications.cancelReminder.mock.calls).toEqual([
      ['followup-2639-2026-11-25'],
      ['followup-2639-2026-11-25'],
    ]);
  });

  it('put up after the follow-up day: taken away at once', async () => {
    jest.setSystemTime(at(2026, 11, 27, 9));

    await handleFollowUpEvent(delivered(data) as any);

    expect(mockNotifications.cancelReminder).toHaveBeenCalledWith('followup-2639-2026-11-25');
  });

  it('leaves other notifications, other events and odd data alone', async () => {
    jest.setSystemTime(at(2026, 11, 26, 8));

    await handleFollowUpEvent(delivered(data, 'alarm-xyz') as any);
    await handleFollowUpEvent(delivered(data, undefined, 1) as any);
    await handleFollowUpEvent(delivered({ followUpDate: 'soon' }) as any);
    await handleFollowUpEvent(delivered({}) as any);
    await handleFollowUpEvent(undefined as any);

    expect(mockNotifications.cancelReminder).not.toHaveBeenCalled();
  });
});
