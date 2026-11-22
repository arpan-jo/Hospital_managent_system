const mockStore = new Map<string, any>();
const mockStorage = {
  getString: jest.fn((key: string) => mockStore.get(key)),
  getBoolean: jest.fn((key: string) => mockStore.get(key)),
  set: jest.fn((key: string, value: any) => {
    mockStore.set(key, value);
  }),
  remove: jest.fn((key: string) => mockStore.delete(key)),
  getAllKeys: jest.fn(() => Array.from(mockStore.keys())),
};
const mockNotifications = {
  scheduleReminder: jest.fn(),
  cancelReminder: jest.fn(),
  cancelReminders: jest.fn(),
  getTriggerNotifications: jest.fn(),
};

// Read when called, not when the module loads — the mocks are set up after the imports run.
jest.mock('./secureStorage', () => ({
  get storage() {
    return mockStorage;
  },
}));
jest.mock('./localNotifications', () => ({
  loadNotifee: () => ({
    default: { getTriggerNotifications: (...args: any[]) => mockNotifications.getTriggerNotifications(...args) },
    EventType: { DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3 },
  }),
  scheduleReminder: (...args: any[]) => mockNotifications.scheduleReminder(...args),
  cancelReminder: (...args: any[]) => mockNotifications.cancelReminder(...args),
  cancelReminders: (...args: any[]) => mockNotifications.cancelReminders(...args),
}));
jest.mock('./i18n', () => ({
  __esModule: true,
  // A recognisable stand-in for every text: 'tx:key' or 'tx:key(values)'.
  default: {
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `tx:${key}(${Object.values(options).join('|')})` : `tx:${key}`,
  },
}));

import {
  MEDICINE_REMINDER_LATE_MS,
  ReminderMedicine,
  claimMedicineReminders,
  clearMedicineReminders,
  handleMedicineReminderEvent,
  isAlternateDayMedicine,
  isMedicineDueOn,
  isMedicineWithoutReminder,
  isWeeklyMedicine,
  medicineCourseDays,
  medicineReminderBody,
  planMedicineReminders,
  rebuildMedicineReminders,
  setMedicineReminderSource,
  setMedicineReminderTimes,
} from './medicineReminder';
import { markTakenDoses, readTakenLog } from './medicineTakenLog';

/** A local time — months 1-based, as written. */
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);
const DEFAULT_TIMES = { morning: '08:00', afternoon: '14:00', evening: '18:00', night: '21:00' };
const SUNDAY_MORNING = at(2026, 11, 22, 9, 0); // Sun 2026-11-22, 9 AM

const medicine = (overrides: Partial<ReminderMedicine> = {}): ReminderMedicine => ({
  id: 3047,
  medicine: 'Monas [10 mg]',
  dosage: 'Montelukast Sodium',
  frequency: '0+0+1',
  duration: '3 Months',
  instructions: 'After meal',
  startDate: '2026-11-17',
  patientCode: 'P1',
  patientName: 'Md.Jahed Al Hasan',
  ...overrides,
});

/** Jahed's live prescription of 2026-11-17, as the API answered on 2026-11-22. */
const JAHED = [
  medicine({ id: 3046, medicine: 'D-Cap [40000 IU]', dosage: 'Cholecalciferol Vitamin D3', frequency: 'ONCEWKLY', duration: '6 Months', instructions: 'After heavy meal at day time' }),
  medicine({ id: 3047 }),
  medicine({ id: 3048, medicine: 'Filfresh [3 mg]', dosage: 'Melatonin', duration: '1 Months' }),
];

/** The same lines as the API hands them over (`TodayMedicine`). */
const api = (list: ReminderMedicine[]) =>
  list.map(item => ({
    prescriptionId: item.id,
    medicine: item.medicine,
    dosage: item.dosage,
    formType: '',
    frequency: item.frequency,
    duration: item.duration,
    instructions: item.instructions,
    doctorName: '',
    patientCode: item.patientCode,
    patientName: item.patientName,
    startDate: item.startDate,
  }));

const sourceOf = (medicines: ReminderMedicine[], extra: Record<string, any> = {}) => ({
  userId: 5,
  savedAt: SUNDAY_MORNING.getTime(),
  times: DEFAULT_TIMES,
  medicines,
  ...extra,
});

const ids = (plan: { schedule: { id: string }[] }) => plan.schedule.map(item => item.id);

/** Reminders set on the phone and not shown yet, as Notifee lists them. */
const pendingOnPhone = (list: [string, Date][]) =>
  list.map(([id, when]) => ({
    notification: { id, data: { at: String(when.getTime()) } },
    trigger: { type: 0, timestamp: when.getTime() },
  }));

beforeEach(() => {
  mockStore.clear();
  Object.values(mockStorage).forEach(fn => fn.mockClear());
  Object.values(mockNotifications).forEach(fn => fn.mockReset());
  mockNotifications.scheduleReminder.mockResolvedValue(true);
  mockNotifications.cancelReminder.mockResolvedValue(undefined);
  mockNotifications.cancelReminders.mockResolvedValue(undefined);
  mockNotifications.getTriggerNotifications.mockResolvedValue([]);
});

describe('medicineCourseDays — the server’s own count', () => {
  it('counts days, weeks, months and years, rounded up', () => {
    expect(medicineCourseDays('7 Days')).toBe(7);
    expect(medicineCourseDays('1 Day')).toBe(1);
    expect(medicineCourseDays('2 Weeks')).toBe(14);
    expect(medicineCourseDays('1 Months')).toBe(30);
    expect(medicineCourseDays('3 Months')).toBe(90);
    expect(medicineCourseDays('1 Years')).toBe(365);
    expect(medicineCourseDays('1.5 Weeks')).toBe(11);
    expect(medicineCourseDays('10')).toBe(10);
  });

  it('"Continue" never ends', () => {
    expect(medicineCourseDays('Continue')).toBeNull();
    expect(medicineCourseDays(' continue ')).toBeNull();
  });

  it('anything it cannot read counts as 7 days, as the server counts it', () => {
    expect(medicineCourseDays('')).toBe(7);
    expect(medicineCourseDays('Days')).toBe(7);
    expect(medicineCourseDays('0 Days')).toBe(7);
    expect(medicineCourseDays('-3 Days')).toBe(7);
    expect(medicineCourseDays('৭ দিন')).toBe(7);
    expect(medicineCourseDays(undefined as any)).toBe(7);
  });
});

// The doses as the server sends them: the doctor's Dose list (tblDoseLookups)
// with the spaces stripped — "Use once weekly" comes as "Useonceweekly".
const DAILY = ['0+0+1', '1+0+1', '½+0+½', 'BD', 'TDS', 'twicedaily', 'OD', 'Useoncedaily', 'nocte', '1Tab', 'Applythinlayer', '', '1+0+1for2weeks', '1+0+1for1month', 'onceadayfor1week'];

describe('isMedicineWithoutReminder', () => {
  it('as needed, once only, and a few days a week or a month not named', () => {
    [
      'Useasneeded', 'Applyasneeded', 'SOS', '1+0+1SOS', '1TabSOS', 'PRN', 'whenrequired', 'প্রয়োজনে', 'প্র\u09DFোজনমতো',
      'STAT', '1TabSTAT',
      'Usetwiceweekly', 'Usethreetimesweekly', 'twice a week', '2timesaweek', '3x/week', 'সপ্তাহে২বার', 'সপ্তাহেদুইবার', 'সপ্তাহেতিনবার', 'সপ্তাহেছ\u09DFবার', 'সপ্তাহেছয়বার',
      'biweekly', 'fortnightly', 'every2weeks', 'monthly', 'onceamonth', 'মাসে১বার',
    ].forEach(text => expect([text, isMedicineWithoutReminder(text)]).toEqual([text, true]));
  });

  it('leaves daily doses, once a week and alternate days alone', () => {
    [...DAILY, 'ONCEWKLY', 'Useonceweekly', 'Useonalternatedays', 'Statin', 'Prostate'].forEach(text =>
      expect([text, isMedicineWithoutReminder(text)]).toEqual([text, false]),
    );
  });
});

describe('isWeeklyMedicine', () => {
  it('knows a once-a-week dose, however it is run together', () => {
    [
      'ONCEWKLY', 'Useonceweekly', 'weekly', 'Weekly', 'onceaweek', 'once a week', 'onceeveryweek', 'everyweek',
      '1/week', '1timeperweek', '1 time a week', '1xweek', 'সপ্তাহে১বার', 'সপ্তাহে একবার',
    ].forEach(text => expect([text, isWeeklyMedicine(text)]).toEqual([text, true]));
  });

  it('leaves daily doses, and more or less than once a week, alone', () => {
    [...DAILY, 'Usetwiceweekly', 'Usethreetimesweekly', '2timesaweek', 'সপ্তাহে২বার', 'biweekly', '1+0+1weeks'].forEach(
      text => expect([text, isWeeklyMedicine(text)]).toEqual([text, false]),
    );
  });
});

describe('isAlternateDayMedicine', () => {
  it('knows every other day', () => {
    ['Useonalternatedays', 'Use on alternate days', 'Alternateday', 'everyotherday', 'একদিনপরপর', 'একদিন পর পর'].forEach(text =>
      expect([text, isAlternateDayMedicine(text)]).toEqual([text, true]),
    );
  });

  it('leaves the rest alone', () => {
    [...DAILY, 'ONCEWKLY', 'Useasneeded'].forEach(text =>
      expect([text, isAlternateDayMedicine(text)]).toEqual([text, false]),
    );
  });
});

describe('isMedicineDueOn', () => {
  const listed = SUNDAY_MORNING;

  it('from the start day for the length of the course, and not a day more', () => {
    const week = medicine({ startDate: '2026-11-22', duration: '7 Days' });
    expect(isMedicineDueOn(week, at(2026, 11, 21), listed)).toBe(false);
    expect(isMedicineDueOn(week, at(2026, 11, 22, 23, 0), listed)).toBe(true);
    expect(isMedicineDueOn(week, at(2026, 11, 28), listed)).toBe(true);
    expect(isMedicineDueOn(week, at(2026, 11, 29), listed)).toBe(false);
  });

  it('"Continue" carries on, a year after its start and more', () => {
    // The server keeps listing it: its one-year read goes by the day the
    // prescription was saved, and an uploaded paper can be dated far older.
    const always = medicine({ startDate: '2025-11-22', duration: 'Continue' });
    expect(isMedicineDueOn(always, at(2026, 11, 22), listed)).toBe(true); // 365 days
    expect(isMedicineDueOn(always, at(2026, 11, 23), listed)).toBe(true); // 366 days
    expect(isMedicineDueOn(medicine({ startDate: '2023-01-05', duration: 'Continue' }), at(2026, 11, 23), listed)).toBe(true);
  });

  it('a once-a-week medicine only on its own weekday', () => {
    const weekly = JAHED[0]; // from Tue 2026-11-17
    expect(isMedicineDueOn(weekly, at(2026, 11, 17), listed)).toBe(true);
    expect(isMedicineDueOn(weekly, at(2026, 11, 22), listed)).toBe(false);
    expect(isMedicineDueOn(weekly, at(2026, 11, 24), listed)).toBe(true);
    expect(isMedicineDueOn(weekly, at(2026, 12, 1), listed)).toBe(true);
  });

  it('an alternate-day medicine every other day from its start', () => {
    const everyOther = medicine({ frequency: 'Useonalternatedays', startDate: '2026-11-17' }); // Tue
    expect(isMedicineDueOn(everyOther, at(2026, 11, 17), listed)).toBe(true);
    expect(isMedicineDueOn(everyOther, at(2026, 11, 18), listed)).toBe(false);
    expect(isMedicineDueOn(everyOther, at(2026, 11, 19), listed)).toBe(true);
    expect(isMedicineDueOn(everyOther, at(2026, 11, 22), listed)).toBe(false);
    expect(isMedicineDueOn(everyOther, at(2026, 11, 23), listed)).toBe(true);
  });

  it('as needed, STAT, twice weekly: never, though the course runs', () => {
    ['Useasneeded', 'SOS', 'STAT', 'Usetwiceweekly', 'Usethreetimesweekly'].forEach(frequency => {
      const line = medicine({ frequency, startDate: '2026-11-22', duration: 'Continue' });
      expect([frequency, isMedicineDueOn(line, at(2026, 11, 22), listed)]).toEqual([frequency, false]);
      expect([frequency, isMedicineDueOn({ ...line, startDate: '' }, at(2026, 11, 22), listed)]).toEqual([frequency, false]);
    });
  });

  it('a line with no start day only on the day the server listed it', () => {
    const unknown = medicine({ startDate: '' });
    expect(isMedicineDueOn(unknown, at(2026, 11, 22, 21, 0), listed)).toBe(true);
    expect(isMedicineDueOn(unknown, at(2026, 11, 23), listed)).toBe(false);
    expect(isMedicineDueOn(medicine({ startDate: '2026-02-30' }), at(2026, 11, 23), listed)).toBe(false);
  });
});

describe('planMedicineReminders', () => {
  const plan = (medicines: ReminderMedicine[], options: Record<string, any> = {}) =>
    planMedicineReminders({
      source: sourceOf(medicines, options.source),
      now: options.now ?? SUNDAY_MORNING,
      takenOn: options.takenOn ?? (() => ({})),
    });

  it("Jahed's medicines: every night for a week, and the weekly one on Tuesday morning only", () => {
    expect(ids(plan(JAHED))).toEqual([
      'med-2026-11-22-night',
      'med-2026-11-23-night',
      'med-2026-11-24-morning',
      'med-2026-11-24-night',
      'med-2026-11-25-night',
      'med-2026-11-26-night',
      'med-2026-11-27-night',
      'med-2026-11-28-night',
    ]);
    const tonight = plan(JAHED).schedule[0];
    expect(tonight.at).toEqual(at(2026, 11, 22, 21, 0));
    expect(tonight.medicines.map(item => item.id)).toEqual([3047, 3048]);
  });

  it('a time already past today is not set — tomorrow’s is', () => {
    const late = plan([medicine()], { now: at(2026, 11, 22, 21, 0) });
    expect(ids(late)[0]).toBe('med-2026-11-23-night');
    expect(late.cancelIds).toEqual([]);
  });

  it('the patient’s own times, and the default for a time that cannot be read', () => {
    const own = plan([medicine({ frequency: '1+0+1' })], {
      source: { times: { morning: '07:15', afternoon: '14:00', evening: '18:00', night: '22:30' } },
      now: at(2026, 11, 22, 6, 0),
    });
    expect(own.schedule[0].at).toEqual(at(2026, 11, 22, 7, 15));
    expect(own.schedule[1].at).toEqual(at(2026, 11, 22, 22, 30));
    const broken = plan([medicine()], { source: { times: { night: '9pm' } } });
    expect(broken.schedule[0].at).toEqual(at(2026, 11, 22, 21, 0));
  });

  it('a course over leaves its slot; a slot with nothing left in it gets no reminder', () => {
    // 1 Months from 2026-10-25: the last day is 2026-11-23.
    const ending = plan([medicine({ startDate: '2026-10-25', duration: '1 Months' })]);
    expect(ids(ending)).toEqual(['med-2026-11-22-night', 'med-2026-11-23-night']);
  });

  it('ticks: a ticked dose leaves the list; a slot all ticked goes, set or showing', () => {
    const someTaken = plan(JAHED, { takenOn: (day: string) => (day === '2026-11-22' ? { '3047_night': true } : {}) });
    expect(someTaken.schedule[0].medicines.map(item => item.id)).toEqual([3048]);

    const allTaken = plan(JAHED, {
      takenOn: (day: string) => (day === '2026-11-22' ? { '3047_night': true, '3048_night': true } : {}),
    });
    expect(ids(allTaken)).not.toContain('med-2026-11-22-night');
    expect(allTaken.cancelIds).toEqual(['med-2026-11-22-night']);
    // Tomorrow is a new day: its reminder stands.
    expect(ids(allTaken)).toContain('med-2026-11-23-night');
  });

  it('a slot all ticked after its time is still taken away', () => {
    const afterTime = plan([medicine()], {
      now: at(2026, 11, 22, 22, 0),
      takenOn: (day: string) => (day === '2026-11-22' ? { '3047_night': true } : {}),
    });
    expect(afterTime.cancelIds).toEqual(['med-2026-11-22-night']);
  });

  it('reads Bangla-digit doses into the right slot', () => {
    expect(ids(plan([medicine({ frequency: '০+০+১', duration: '1 Days', startDate: '2026-11-22' })]))).toEqual([
      'med-2026-11-22-night',
    ]);
  });

  it('nothing for no list, an empty list, or lines with no id', () => {
    expect(planMedicineReminders({ source: null, now: SUNDAY_MORNING }).schedule).toEqual([]);
    expect(plan([]).schedule).toEqual([]);
    expect(plan([medicine({ id: 0 })]).schedule).toEqual([]);
  });

  it('never further than seven days ahead', () => {
    const always = plan([medicine({ duration: 'Continue' })]);
    expect(always.schedule).toHaveLength(7);
    expect(ids(always).at(-1)).toBe('med-2026-11-28-night');
  });
});

describe('medicineReminderBody', () => {
  it('one line each, with how to take it', () => {
    expect(medicineReminderBody([JAHED[1], JAHED[2]])).toBe(
      '• Monas [10 mg] · After meal\n• Filfresh [3 mg] · After meal',
    );
  });

  it("the patient's name only when the list covers more than one person", () => {
    expect(
      medicineReminderBody([
        medicine({ id: 1, medicine: 'Napa', instructions: '', patientCode: 'P1', patientName: 'Jahed' }),
        medicine({ id: 2, medicine: 'Napa', instructions: '', patientCode: 'P2', patientName: 'Karim' }),
      ]),
    ).toBe('• Napa — Jahed\n• Napa — Karim');
  });

  it('the generic name when there is no brand; past six lines the rest are counted', () => {
    expect(medicineReminderBody([medicine({ medicine: '', dosage: 'Paracetamol', instructions: '' })])).toBe(
      '• Paracetamol',
    );
    const many = Array.from({ length: 8 }, (_, index) =>
      medicine({ id: index + 1, medicine: `M${index + 1}`, instructions: '' }),
    );
    expect(medicineReminderBody(many).split('\n')).toEqual([
      '• M1',
      '• M2',
      '• M3',
      '• M4',
      '• M5',
      'tx:medicineReminder.more(3)',
    ]);
  });
});

describe('setting them on the phone', () => {
  const sign = (userId = 5) => {
    claimMedicineReminders(userId);
    return rebuildMedicineReminders();
  };
  const setIds = () => mockNotifications.scheduleReminder.mock.calls.map(([input]) => input.id);

  beforeEach(() => {
    jest.useFakeTimers({ now: SUNDAY_MORNING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('sets each reminder with its words, its "Taken" button, its removal and its data', async () => {
    await sign();
    await setMedicineReminderSource({ userId: 5, medicines: api(JAHED), times: DEFAULT_TIMES });

    expect(setIds()).toHaveLength(8);
    const [tonight] = mockNotifications.scheduleReminder.mock.calls[0];
    expect(tonight).toMatchObject({
      id: 'med-2026-11-22-night',
      at: at(2026, 11, 22, 21, 0),
      title: 'tx:medicineReminder.title.night',
      body: '• Monas [10 mg] · After meal\n• Filfresh [3 mg] · After meal',
      channel: { id: 'medicine-reminder', name: 'tx:medicineReminder.channelName' },
      actions: [{ id: 'medicine-taken', title: 'tx:medicineReminder.taken' }],
      removeAt: new Date(at(2026, 11, 22, 21, 0).getTime() + MEDICINE_REMINDER_LATE_MS),
      data: {
        kind: 'medicine',
        day: '2026-11-22',
        slot: 'night',
        items: '3047,3048',
        at: String(at(2026, 11, 22, 21, 0).getTime()),
      },
    });
  });

  it('takes away reminders set before and no longer wanted — and only medicine ones', async () => {
    await sign();
    mockNotifications.getTriggerNotifications.mockResolvedValue(
      pendingOnPhone([
        ['med-2026-11-23-morning', at(2026, 11, 23, 8, 0)],
        ['med-2026-11-22-night', at(2026, 11, 22, 21, 0)],
        ['followup-1-2026-11-30', at(2026, 11, 29, 20, 0)],
        ['abc', at(2026, 11, 22, 10, 0)],
      ]),
    );
    await setMedicineReminderSource({ userId: 5, medicines: api([JAHED[1]]), times: DEFAULT_TIMES });

    expect(mockNotifications.cancelReminder.mock.calls).toEqual([['med-2026-11-23-morning']]);
  });

  it('a reminder whose time has come but that Android has yet to show stays — the app opened in that hour', async () => {
    // Without exact alarms Android shows it up to an hour late. It is 9 AM:
    // the 8 AM one is still waiting; one from 5 AM is past the three hours.
    await sign();
    mockNotifications.getTriggerNotifications.mockResolvedValue(
      pendingOnPhone([
        ['med-2026-11-22-morning', at(2026, 11, 22, 8, 0)],
        ['med-2026-11-22-afternoon', at(2026, 11, 22, 5, 0)],
      ]),
    );
    const morning = medicine({ id: 3050, frequency: '1+0+0' });
    await setMedicineReminderSource({ userId: 5, medicines: api([morning]), times: DEFAULT_TIMES });
    expect(mockNotifications.cancelReminder.mock.calls).toEqual([['med-2026-11-22-afternoon']]);

    // Ticked, its reminder goes all the same, waiting or showing.
    mockNotifications.cancelReminder.mockClear();
    markTakenDoses('2026-11-22', 'morning', [3050]);
    await rebuildMedicineReminders();
    expect(mockNotifications.cancelReminder.mock.calls).toContainEqual(['med-2026-11-22-morning']);
  });

  it("a list read for an account that has since signed out, or another account's, is never kept", async () => {
    await sign(5);
    await setMedicineReminderSource({ userId: 9, medicines: api(JAHED), times: DEFAULT_TIMES });
    expect(mockNotifications.scheduleReminder).not.toHaveBeenCalled();
    expect(mockStore.has('reminder_medicine_source')).toBe(false);
  });

  it('moves with the times saved, from the list it already has', async () => {
    await sign();
    await setMedicineReminderSource({ userId: 5, medicines: api([JAHED[1]]), times: DEFAULT_TIMES });
    mockNotifications.scheduleReminder.mockClear();

    await setMedicineReminderTimes({ ...DEFAULT_TIMES, night: '21:30' });
    expect(mockNotifications.scheduleReminder.mock.calls[0][0].at).toEqual(at(2026, 11, 22, 21, 30));
  });

  it('a list read without its times (that read failed) keeps the times from before', async () => {
    await sign();
    await setMedicineReminderSource({ userId: 5, medicines: api([JAHED[1]]), times: { ...DEFAULT_TIMES, night: '22:15' } });
    mockNotifications.scheduleReminder.mockClear();

    await setMedicineReminderSource({ userId: 5, medicines: api([JAHED[1]]), times: null });
    expect(mockNotifications.scheduleReminder.mock.calls[0][0].at).toEqual(at(2026, 11, 22, 22, 15));
  });

  it('no times ever read: the default times', async () => {
    await sign();
    await setMedicineReminderSource({ userId: 5, medicines: api([JAHED[1]]) });
    expect(mockNotifications.scheduleReminder.mock.calls[0][0].at).toEqual(at(2026, 11, 22, 21, 0));
  });

  it("times read for another account, or with no list on the phone, change nothing", async () => {
    await sign();
    await setMedicineReminderTimes({ ...DEFAULT_TIMES, night: '21:30' }, 5); // no list yet
    expect(mockNotifications.scheduleReminder).not.toHaveBeenCalled();

    await setMedicineReminderSource({ userId: 5, medicines: api([JAHED[1]]), times: DEFAULT_TIMES });
    mockNotifications.scheduleReminder.mockClear();
    await setMedicineReminderTimes({ ...DEFAULT_TIMES, night: '23:00' }, 9);
    expect(mockNotifications.scheduleReminder).not.toHaveBeenCalled();

    await setMedicineReminderTimes({ ...DEFAULT_TIMES, night: '21:30' }, 5);
    expect(mockNotifications.scheduleReminder.mock.calls[0][0].at).toEqual(at(2026, 11, 22, 21, 30));
  });

  it('sets them again from what the phone holds — no network, no login', async () => {
    await sign();
    await setMedicineReminderSource({ userId: 5, medicines: api([JAHED[1]]), times: DEFAULT_TIMES });
    mockNotifications.scheduleReminder.mockClear();

    await rebuildMedicineReminders();
    expect(setIds()[0]).toBe('med-2026-11-22-night');
  });

  it('calls that come while one runs are folded into one more pass', async () => {
    await sign();
    await setMedicineReminderSource({ userId: 5, medicines: api([JAHED[1]]), times: DEFAULT_TIMES });
    mockNotifications.getTriggerNotifications.mockClear();

    await Promise.all([rebuildMedicineReminders(), rebuildMedicineReminders(), rebuildMedicineReminders()]);
    expect(mockNotifications.getTriggerNotifications.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('another account signing in: the last one’s reminders and list leave the phone first', async () => {
    await sign(5);
    await setMedicineReminderSource({ userId: 5, medicines: api(JAHED), times: DEFAULT_TIMES });
    mockNotifications.cancelReminders.mockClear();
    mockNotifications.scheduleReminder.mockClear();

    await sign(9);
    expect(mockNotifications.cancelReminders).toHaveBeenCalledWith('med-');
    expect(mockStore.has('reminder_medicine_source')).toBe(false);
    expect(mockNotifications.scheduleReminder).not.toHaveBeenCalled();
  });

  it('the same account again (an expired session, say) keeps its own', async () => {
    await sign(5);
    await setMedicineReminderSource({ userId: 5, medicines: api(JAHED), times: DEFAULT_TIMES });
    mockNotifications.cancelReminders.mockClear();

    await sign(5);
    expect(mockNotifications.cancelReminders).not.toHaveBeenCalled();
    expect(mockStore.has('reminder_medicine_source')).toBe(true);
  });

  it('logout takes every medicine reminder and the list away', async () => {
    await sign(5);
    await setMedicineReminderSource({ userId: 5, medicines: api(JAHED), times: DEFAULT_TIMES });
    mockNotifications.scheduleReminder.mockClear();

    await clearMedicineReminders();
    expect(mockNotifications.cancelReminders).toHaveBeenCalledWith('med-');
    expect(mockStore.has('reminder_medicine_source')).toBe(false);
    expect(mockStore.has('reminder_medicine_owner')).toBe(false);

    await rebuildMedicineReminders();
    expect(mockNotifications.scheduleReminder).not.toHaveBeenCalled();
  });

  it('never throws when the phone refuses', async () => {
    await sign();
    mockNotifications.getTriggerNotifications.mockRejectedValue(new Error('native gone'));
    mockNotifications.scheduleReminder.mockRejectedValue(new Error('bad trigger'));
    await expect(
      setMedicineReminderSource({ userId: 5, medicines: api(JAHED), times: DEFAULT_TIMES }),
    ).resolves.toBeUndefined();
    mockStore.set('reminder_medicine_source', 'not json');
    await expect(rebuildMedicineReminders()).resolves.toBeUndefined();
  });
});

describe('handleMedicineReminderEvent', () => {
  const event = (type: number, pressId: string, data: Record<string, string>, id = 'med-2026-11-22-night') => ({
    type,
    detail: { notification: { id, data }, pressAction: { id: pressId } },
  });
  const NIGHT = { kind: 'medicine', day: '2026-11-22', slot: 'night', items: '3047,3048', at: String(at(2026, 11, 22, 21, 0).getTime()) };

  it('"Taken" ticks the listed medicines for that slot and day, and clears the reminder', async () => {
    await handleMedicineReminderEvent(event(2, 'medicine-taken', NIGHT) as any);
    expect(readTakenLog('2026-11-22')).toEqual({ '3047_night': true, '3048_night': true });
    expect(mockNotifications.cancelReminder).toHaveBeenCalledWith('med-2026-11-22-night');
  });

  it('data it cannot trust ticks nothing — the reminder still clears', async () => {
    await handleMedicineReminderEvent(event(2, 'medicine-taken', { ...NIGHT, slot: 'midnight' }) as any);
    await handleMedicineReminderEvent(event(2, 'medicine-taken', { ...NIGHT, day: '22/11/2026' }) as any);
    await handleMedicineReminderEvent(event(2, 'medicine-taken', { ...NIGHT, items: 'x,,-1' }) as any);
    expect(readTakenLog('2026-11-22')).toEqual({});
    expect(mockNotifications.cancelReminder).toHaveBeenCalledTimes(3);
  });

  it('a reminder put up more than three hours late goes at once; on time, it stays', async () => {
    const due = at(2026, 11, 22, 21, 0).getTime();
    jest.spyOn(Date, 'now').mockReturnValue(due + MEDICINE_REMINDER_LATE_MS + 1000);
    await handleMedicineReminderEvent(event(3, '', NIGHT) as any);
    expect(mockNotifications.cancelReminder).toHaveBeenCalledWith('med-2026-11-22-night');

    mockNotifications.cancelReminder.mockClear();
    jest.spyOn(Date, 'now').mockReturnValue(due + 60 * 1000);
    await handleMedicineReminderEvent(event(3, '', NIGHT) as any);
    expect(mockNotifications.cancelReminder).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('leaves other notifications, a tap and other buttons to their own handlers', async () => {
    await handleMedicineReminderEvent(event(2, 'medicine-taken', NIGHT, 'followup-1-2026-11-30') as any);
    await handleMedicineReminderEvent(event(1, 'reminder-press', NIGHT) as any);
    await handleMedicineReminderEvent(event(2, 'stop-alarm', NIGHT) as any);
    await handleMedicineReminderEvent({} as any);
    expect(mockNotifications.cancelReminder).not.toHaveBeenCalled();
    expect(readTakenLog('2026-11-22')).toEqual({});
  });
});
