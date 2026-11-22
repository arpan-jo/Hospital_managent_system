/**
 * Medicine reminders. At each dose time of the day (morning, afternoon,
 * evening, night, at the patient's own times kept on the server) the phone
 * shows one notification listing the medicines still to take then.
 *
 * Everything is set on the phone itself, so the reminders come with the app
 * closed, with no network, and with the login expired. A session ends within
 * the hour and cannot be renewed, so nothing here may depend on it.
 *
 *   - Built from the last list read from the server (Today's Medicines), with
 *     the server's own course rule (start day + duration), for today and the
 *     six days after it. Read again whenever the app is open and signed in,
 *     and set again from the phone each time the app opens or comes back,
 *     signed in or not. A week without the app opened at all, and they stop
 *     until it is.
 *   - A dose ticked off (in the app, or with "Taken" on the reminder) leaves
 *     its slot's reminder. Once a slot is all taken, its reminder goes.
 *   - "Taken" ticks the listed medicines without opening the app. A tap on the
 *     reminder, or a swipe, only clears it.
 *   - A once-a-week medicine is reminded on its own weekday only, an
 *     alternate-day one every other day. One taken as needed, once only
 *     (STAT), or on a few days a week or a month not named gets none.
 *   - A reminder shown more than three hours late (the phone was off) is taken
 *     away.
 *   - Logout takes every reminder off the phone. An expired session keeps
 *     them. Another account signing in never sees them.
 *
 * Nothing here throws, and nothing here waits on the network.
 */
import type * as NotifeeModule from '@notifee/react-native';
import type { TodayMedicine } from '../repositories/TodayMedicinesRepository';
import i18next from './i18n';
import { toISODate } from './format';
import { storage } from './secureStorage';
import {
  DEFAULT_SLOT_TIMES,
  MEDICINE_SLOTS,
  MedicineSlot,
  MedicineSlotTimes,
  slotsOfFrequency,
} from './medicineSlots';
import { markTakenDoses, medicineDoseKey, readTakenLog } from './medicineTakenLog';
import {
  cancelReminder,
  cancelReminders,
  loadNotifee,
  scheduleReminder,
} from './localNotifications';

const ID_PREFIX = 'med-';
export const MEDICINE_REMINDER_CHANNEL_ID = 'medicine-reminder';
const TAKEN_ACTION_ID = 'medicine-taken';
/** The account's list and times, as last read from the server. */
const SOURCE_KEY = 'reminder_medicine_source';
/** The account signed in on this phone, whose reminders are set. */
const OWNER_KEY = 'reminder_medicine_owner';

/** Today and the six days after it. */
export const MEDICINE_REMINDER_DAYS = 7;
/** Shown for this long at most; put up later than this (the phone was off), it goes at once. */
export const MEDICINE_REMINDER_LATE_MS = 3 * 60 * 60 * 1000;
/** Medicines listed one by one; past this the rest are counted ("+3 more"). */
const MAX_LINES = 6;

const EVENT_PRESS_ACTION = 2; // EventType.ACTION_PRESS
const EVENT_DELIVERED = 3; // EventType.DELIVERED

/** One medicine line as the reminders keep it, the fields they need and no more. */
export interface ReminderMedicine {
  /** The line's id (`prescriptionId` in the API): the ticks are keyed on it. */
  id: number;
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  /** 'YYYY-MM-DD', or '' when the server sent none. */
  startDate: string;
  patientCode: string;
  patientName: string;
}

export interface MedicineReminderSource {
  userId: number;
  /** When the list was read (ms). A line with no start day counts on that day only. */
  savedAt: number;
  times: MedicineSlotTimes;
  medicines: ReminderMedicine[];
}

// ── Days and times ───────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 'YYYY-MM-DD' → that day's midnight on the phone's clock; null for anything else. */
const parseDay = (value: string): Date | null => {
  const match = ISO_DAY.exec(String(value ?? '').trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
};

const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
/** Whole days from `from` to `to` (both midnights). */
const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

/** The slot's time on `day`; null when the time is not 'HH:mm'. */
const slotTimeOn = (day: Date, hhmm: string): Date | null => {
  const match = HH_MM.exec(String(hhmm ?? '').trim());
  if (!match) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(match[1]), Number(match[2]), 0, 0);
};

const toTimes = (times?: Partial<MedicineSlotTimes> | null): MedicineSlotTimes =>
  MEDICINE_SLOTS.reduce((all, slot) => {
    const value = String(times?.[slot] ?? '').slice(0, 5);
    return { ...all, [slot]: HH_MM.test(value) ? value : DEFAULT_SLOT_TIMES[slot] };
  }, {} as MedicineSlotTimes);

// ── The course rule, as the server applies it (PortalMedicineController.IsActiveOn) ──

/**
 * How many days a course lasts, counted as the server counts them: weeks ×7,
 * months ×30, years ×365, rounded up. Null when it never ends ("Continue").
 * A duration that cannot be read counts as 7 days.
 */
export const medicineCourseDays = (duration: string): number | null => {
  const text = String(duration ?? '').trim();
  if (/^continue$/i.test(text)) return null;
  const [amount = '', ...unitWords] = text.split(/\s+/);
  const quantity = Number(amount);
  if (!amount || !Number.isFinite(quantity) || quantity <= 0) return 7;
  const unit = unitWords.join(' ').trim().toLowerCase().replace(/s+$/, '');
  const days =
    unit === 'week' ? quantity * 7 : unit === 'month' ? quantity * 30 : unit === 'year' ? quantity * 365 : quantity;
  return Math.ceil(days);
};

// The dose as the doctor chose it (the server's `frequency`, its spaces
// stripped). The server lists every line every day of its course, whatever
// the dose says; these rules keep a reminder from asking for a dose on a day
// it is not to be taken. Each reads the text with or without the spaces.

/** As needed: "SOS", "PRN", "Use as needed", "প্রয়োজনে" (য় written as one letter or two). */
const AS_NEEDED =
  /(^|[^a-z])(sos|prn)|(sos|prn)$|as\s*(needed|required)|when\s*(needed|required)|if\s*(needed|required|necessary)|প্র(?:\u09DF|\u09AF\u09BC)োজনে|প্র(?:\u09DF|\u09AF\u09BC)োজন\s*(মত|মতো|হলে)/i;
/** Once only, at once: "STAT". */
const ONCE_ONLY = /(^|[^a-z])stat([^a-z]|$)|stat$/i;
/** Some days of the week, not named: "Use twice weekly", "Use three times weekly", "3x/week", "সপ্তাহে ২ বার". */
const SOME_DAYS_A_WEEK =
  /(twice|thrice|(two|three|four|five|six|[2-6])\s*(times|x))\s*(a|per|every|\/)?\s*w(ee)?k|সপ্তাহে\s*([২-৬]|[2-6]|দুই|তিন|চার|পাঁচ|ছ(?:\u09DF|\u09AF\u09BC))/i;
/** Less often than weekly: "biweekly", "fortnightly", "every 2 weeks", "monthly", "মাসে ১ বার". */
const LESS_THAN_WEEKLY =
  /bi\s*-?\s*w(ee)?kly|fortnight|every\s*(2|two|other)\s*w(ee)?ks?|monthly|every\s*month|once\s*(a|per|every)?\s*month|1\s*(times?|x)?\s*(a|per|every|\/)\s*month|মাসে\s*(১|1|এক)\s*(বার|দিন)/i;
/** Once a week: "ONCEWKLY", "Use once weekly", "every week", "1/week", "1 time per week", "সপ্তাহে ১ বার". */
const ONCE_A_WEEK =
  /w(ee)?kly|once\s*(a|per|every)?\s*w(ee)?k|every\s*w(ee)?k|1\s*(times?|x)\s*(a|per|every|\/)?\s*w(ee)?k|1\s*(a|per|every|\/)\s*w(ee)?k|সপ্তাহে\s*(১|1|এক)\s*(বার|দিন)?/i;
/** Every other day: "Use on alternate days", "every other day", "একদিন পর পর". */
const ALTERNATE_DAYS = /alternate\s*days?|every\s*(other|2nd|second|alternate)\s*day|এক\s*দিন\s*(পর\s*পর|অন্তর)/i;

/**
 * No reminder at all: as needed, once only (STAT), or a few days a week or a
 * month that the dose does not name. A reminder every day would ask for a
 * dose every day. The panel still lists them, as the portal does.
 */
export const isMedicineWithoutReminder = (frequency: string): boolean => {
  const text = String(frequency ?? '');
  return AS_NEEDED.test(text) || ONCE_ONLY.test(text) || SOME_DAYS_A_WEEK.test(text) || LESS_THAN_WEEKLY.test(text);
};

/** Once a week: reminded on the course's own weekday only. */
export const isWeeklyMedicine = (frequency: string): boolean =>
  !isMedicineWithoutReminder(frequency) && ONCE_A_WEEK.test(String(frequency ?? ''));

/** Every other day: reminded on the course's first day, the third, the fifth… */
export const isAlternateDayMedicine = (frequency: string): boolean =>
  !isMedicineWithoutReminder(frequency) &&
  !isWeeklyMedicine(frequency) &&
  ALTERNATE_DAYS.test(String(frequency ?? ''));

/**
 * Whether `medicine` is reminded on `day`: its dose is one a reminder can be
 * set for, its course covers the day (start ≤ day < start + duration), and the
 * day is one of its days (its weekday, once a week; every other day, on
 * alternate days). A line with no start day counts on `listedDay` only, the
 * day the server listed it.
 *
 * There is no one-year limit here. The server reads a year of prescriptions
 * back by the day each was saved, while `startDate` can be the date on an
 * uploaded paper, far older. It has just listed the line, so the line counts.
 */
export const isMedicineDueOn = (medicine: ReminderMedicine, day: Date, listedDay: Date): boolean => {
  if (isMedicineWithoutReminder(medicine?.frequency)) return false;
  const start = parseDay(medicine?.startDate);
  if (!start) return daysBetween(midnight(listedDay), midnight(day)) === 0;
  const today = midnight(day);
  const sinceStart = daysBetween(start, today);
  if (sinceStart < 0) return false;
  const days = medicineCourseDays(medicine?.duration);
  if (days !== null && sinceStart >= days) return false;
  if (isWeeklyMedicine(medicine?.frequency)) return sinceStart % 7 === 0;
  if (isAlternateDayMedicine(medicine?.frequency)) return sinceStart % 2 === 0;
  return true;
};

// ── The plan: pure, so every case can be tested ─────────────────────────────

export interface MedicineReminderPlanItem {
  /** `med-YYYY-MM-DD-slot`: setting it again replaces it, never a second copy. */
  id: string;
  day: string;
  slot: MedicineSlot;
  at: Date;
  /** The medicines still to take in that slot. */
  medicines: ReminderMedicine[];
}

export interface MedicineReminderPlan {
  /** Reminders to set, in time order. */
  schedule: MedicineReminderPlanItem[];
  /** Slots whose every dose is ticked: their reminder goes, set or already showing. */
  cancelIds: string[];
}

export const medicineReminderId = (day: string, slot: MedicineSlot) => `${ID_PREFIX}${day}-${slot}`;

export const planMedicineReminders = ({
  source,
  now,
  days = MEDICINE_REMINDER_DAYS,
  takenOn = readTakenLog,
}: {
  source: MedicineReminderSource | null;
  now: Date;
  days?: number;
  /** The ticks of one day ('YYYY-MM-DD'). */
  takenOn?: (day: string) => Record<string, boolean>;
}): MedicineReminderPlan => {
  const plan: MedicineReminderPlan = { schedule: [], cancelIds: [] };
  const medicines = (Array.isArray(source?.medicines) ? source!.medicines : [])?.filter(
    medicine => (medicine?.id ?? 0) > 0,
  );
  if (!medicines?.length) return plan;

  const clock = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const today = midnight(clock);
  const savedAt = Number(source?.savedAt) || 0;
  const listedDay = savedAt > 0 ? new Date(savedAt) : clock;
  const times = toTimes(source?.times);
  const span = Math.max(0, Math.min(31, Math.trunc(Number(days) || 0)));

  for (let offset = 0; offset < span; offset += 1) {
    const day = addDays(today, offset);
    const dayKey = toISODate(day);
    const taken = takenOn?.(dayKey) ?? {};
    for (const slot of MEDICINE_SLOTS) {
      const due = medicines.filter(
        medicine =>
          slotsOfFrequency(medicine?.frequency)?.includes?.(slot) && isMedicineDueOn(medicine, day, listedDay),
      );
      if (!due.length) continue;
      const id = medicineReminderId(dayKey, slot);
      const left = due.filter(medicine => !taken?.[medicineDoseKey(medicine.id, slot)]);
      if (!left.length) {
        plan.cancelIds.push(id);
        continue;
      }
      const at = slotTimeOn(day, times[slot]);
      if (!at || at.getTime() <= clock.getTime()) continue;
      plan.schedule.push({ id, day: dayKey, slot, at, medicines: left });
    }
  }
  plan.schedule.sort((a, b) => a.at.getTime() - b.at.getTime());
  return plan;
};

// ── The words ────────────────────────────────────────────────────────────────

/** The translation, or '' — never "undefined" on the phone. */
const tr = (key: string, options?: Record<string, unknown>): string => {
  const text = i18next?.t?.(key, options as any);
  return typeof text === 'string' && text !== key ? text : '';
};

const FALLBACK_TITLE: Record<MedicineSlot, string> = {
  morning: 'Time for your morning medicine',
  afternoon: 'Time for your afternoon medicine',
  evening: 'Time for your evening medicine',
  night: 'Time for your night medicine',
};

export const medicineReminderTitle = (slot: MedicineSlot): string =>
  tr(`medicineReminder.title.${slot}`) || FALLBACK_TITLE[slot] || FALLBACK_TITLE.morning;

/**
 * One line per medicine, with how to take it when the doctor wrote that:
 *
 *   • Monas [10 mg] · After meal
 *   • Filfresh [3 mg] · After meal — Karim
 *
 * The patient's name only when the list covers more than one person (a family
 * member's medicines with the patient's own). Past six lines, the rest are
 * counted.
 */
export const medicineReminderBody = (medicines: ReminderMedicine[]): string => {
  const list = Array.isArray(medicines) ? medicines : [];
  const people = new Set(
    list.map(medicine => medicine?.patientCode || medicine?.patientName).filter(Boolean),
  );
  const lines = list.map(medicine => {
    const name =
      medicine?.medicine || medicine?.dosage || tr('medicineReminder.unnamed') || 'Medicine';
    const how = medicine?.instructions ? ` · ${medicine.instructions}` : '';
    const who = people.size > 1 && medicine?.patientName ? ` — ${medicine.patientName}` : '';
    return `• ${name}${how}${who}`;
  });
  if (lines.length <= MAX_LINES) return lines.join('\n');
  const shown = lines.slice(0, MAX_LINES - 1);
  const rest = lines.length - shown.length;
  shown.push(tr('medicineReminder.more', { count: rest }) || `+${rest} more`);
  return shown.join('\n');
};

// ── What is kept on the phone ────────────────────────────────────────────────

const readOwner = (): number => {
  try {
    return Math.max(0, Math.trunc(Number(storage?.getString?.(OWNER_KEY) ?? 0) || 0));
  } catch {
    return 0;
  }
};

const toReminderMedicine = (medicine: Partial<TodayMedicine> | null | undefined): ReminderMedicine => ({
  id: Math.trunc(Number(medicine?.prescriptionId) || 0),
  medicine: String(medicine?.medicine ?? '').trim(),
  dosage: String(medicine?.dosage ?? '').trim(),
  frequency: String(medicine?.frequency ?? '').trim(),
  duration: String(medicine?.duration ?? '').trim(),
  instructions: String(medicine?.instructions ?? '').trim(),
  startDate: String(medicine?.startDate ?? '').trim(),
  patientCode: String(medicine?.patientCode ?? '').trim(),
  patientName: String(medicine?.patientName ?? '').trim(),
});

/** The owner's list and times; null when there are none, or they are another account's. */
const readSource = (): MedicineReminderSource | null => {
  try {
    const raw = storage?.getString?.(SOURCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const owner = readOwner();
    if (!parsed || typeof parsed !== 'object' || owner <= 0 || parsed?.userId !== owner) return null;
    return {
      userId: owner,
      savedAt: Number(parsed?.savedAt) || 0,
      times: toTimes(parsed?.times),
      medicines: (Array.isArray(parsed?.medicines) ? parsed.medicines : [])
        .map((medicine: any) => ({ ...toReminderMedicine(null), ...medicine, id: Math.trunc(Number(medicine?.id) || 0) }))
        .filter((medicine: ReminderMedicine) => medicine.id > 0),
    };
  } catch (error: any) {
    console.log('medicine reminder source read error ==>', error?.message);
    return null;
  }
};

const writeSource = (source: MedicineReminderSource) => {
  try {
    storage?.set?.(SOURCE_KEY, JSON.stringify(source));
  } catch (error: any) {
    console.log('medicine reminder source write error ==>', error?.message);
  }
};

// ── Setting them on the phone ────────────────────────────────────────────────

const setOne = async (item: MedicineReminderPlanItem) => {
  const at = item.at.getTime();
  await scheduleReminder?.({
    id: item.id,
    at: item.at,
    title: medicineReminderTitle(item.slot),
    body: medicineReminderBody(item.medicines),
    channel: {
      id: MEDICINE_REMINDER_CHANNEL_ID,
      name: tr('medicineReminder.channelName') || 'Medicine reminders',
    },
    actions: [{ id: TAKEN_ACTION_ID, title: tr('medicineReminder.taken') || 'Taken' }],
    removeAt: new Date(at + MEDICINE_REMINDER_LATE_MS),
    // Strings only: what "Taken" ticks, and when it was due (to tell a late one).
    data: {
      kind: 'medicine',
      day: item.day,
      slot: item.slot,
      items: item.medicines.map(medicine => medicine.id).join(','),
      at: String(at),
    },
  });
};

/** Set by sign-in as another account and by logout: the next pass first clears every medicine reminder. */
let purgeFirst = false;

/** One pass: sets what the plan wants, takes away what it no longer does. */
const applyPlan = async () => {
  if (purgeFirst) {
    purgeFirst = false;
    // Still to come and showing now alike: no one sees another account's medicines.
    await cancelReminders?.(ID_PREFIX);
  }
  const plan = planMedicineReminders({ source: readSource(), now: new Date() });
  const wanted = new Set(plan.schedule.map(item => item.id));

  // Set ahead but no longer wanted: a course over, a time moved, an account gone.
  const setIds = await loadNotifee()?.default?.getTriggerNotificationIds?.();
  for (const id of Array.isArray(setIds) ? setIds : []) {
    const key = String(id ?? '');
    if (key.startsWith(ID_PREFIX) && !wanted.has(key)) await cancelReminder?.(key);
  }
  // A slot ticked off in full: its reminder goes, still to come or showing now.
  for (const id of plan.cancelIds) await cancelReminder?.(id);
  // The same id replaces the one set before, so a phone that lost it gets it back.
  for (const item of plan.schedule) await setOne(item);
};

let running: Promise<void> | null = null;
let again = false;

/**
 * Sets the reminders again from what the phone holds: the last list, the
 * times and today's ticks. Calls that come while one runs are folded into one
 * more pass after it, never run side by side. Never throws.
 */
export const rebuildMedicineReminders = (): Promise<void> => {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      try {
        await applyPlan();
      } catch (error: any) {
        console.log('medicine reminders error ==>', error?.message);
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
};

/**
 * The list and times just read from the server for `userId`. Kept on the
 * phone (encrypted, as everything the app keeps) so the reminders can be set
 * again with no network and no login. Ignored when another account has signed
 * in since the read began. With no `times` (that read failed), the times kept
 * from before stand, and the defaults when there are none.
 */
export const setMedicineReminderSource = ({
  userId,
  medicines,
  times,
}: {
  userId: number;
  medicines: TodayMedicine[];
  times?: MedicineSlotTimes | null;
}): Promise<void> => {
  const owner = readOwner();
  if (owner <= 0 || Math.trunc(Number(userId) || 0) !== owner) return Promise.resolve();
  writeSource({
    userId: owner,
    savedAt: Date.now(),
    times: toTimes(times ?? readSource()?.times),
    medicines: (Array.isArray(medicines) ? medicines : [])
      .map(toReminderMedicine)
      .filter(medicine => medicine.id > 0),
  });
  return rebuildMedicineReminders();
};

/**
 * Times just saved on the server, or read from it: the reminders move to
 * them. With `userId` (a read that began earlier), ignored when another
 * account has signed in since.
 */
export const setMedicineReminderTimes = (times: MedicineSlotTimes, userId?: number): Promise<void> => {
  const source = readSource();
  if (!source) return Promise.resolve();
  if (userId !== undefined && Math.trunc(Number(userId) || 0) !== source.userId) return Promise.resolve();
  writeSource({ ...source, times: toTimes(times) });
  return rebuildMedicineReminders();
};

/**
 * Sign-in: marks the phone's medicine reminders as `userId`'s. When they were
 * another account's (or nobody's), that account's reminders and list leave
 * the phone first. The same account keeps its own, through an expired session
 * too.
 */
export const claimMedicineReminders = (userId: number) => {
  const id = Math.trunc(Number(userId) || 0);
  if (id <= 0) return;
  try {
    if (readOwner() === id) return;
    storage?.set?.(OWNER_KEY, String(id));
    storage?.remove?.(SOURCE_KEY);
  } catch (error: any) {
    console.log('claimMedicineReminders error ==>', error?.message);
  }
  // In the same line as every pass, so a pass already under way cannot set
  // the last account's reminders again after they are cleared.
  purgeFirst = true;
  rebuildMedicineReminders();
};

/** Logout: every medicine reminder, and the list behind them, leave the phone. Never throws. */
export const clearMedicineReminders = async (): Promise<void> => {
  try {
    storage?.remove?.(OWNER_KEY);
    storage?.remove?.(SOURCE_KEY);
  } catch (error: any) {
    console.log('clearMedicineReminders error ==>', error?.message);
  }
  purgeFirst = true;
  await rebuildMedicineReminders();
};

/**
 * "Taken" on a reminder ticks its medicines for that slot and day, then clears
 * it, without opening the app (it runs with the app closed too). A reminder
 * put up more than three hours late is cleared at once. Hooked up through
 * `registerNotificationHandlers` in index.js.
 */
export const handleMedicineReminderEvent = async (event: NotifeeModule.Event) => {
  const notification = event?.detail?.notification;
  const id = String(notification?.id ?? '');
  if (!id.startsWith(ID_PREFIX)) return;
  const lib = loadNotifee();
  const data = notification?.data ?? {};

  if (
    event?.type === (lib?.EventType?.ACTION_PRESS ?? EVENT_PRESS_ACTION) &&
    event?.detail?.pressAction?.id === TAKEN_ACTION_ID
  ) {
    const slot = String(data?.slot ?? '') as MedicineSlot;
    const items = String(data?.items ?? '')
      .split(',')
      .map(item => Math.trunc(Number(item) || 0))
      .filter(item => item > 0);
    if (MEDICINE_SLOTS.includes(slot) && items.length) {
      markTakenDoses(String(data?.day ?? ''), slot, items);
    }
    await cancelReminder?.(id);
    return;
  }

  if (event?.type === (lib?.EventType?.DELIVERED ?? EVENT_DELIVERED)) {
    const due = Number(data?.at);
    if (Number.isFinite(due) && Date.now() > due + MEDICINE_REMINDER_LATE_MS) await cancelReminder?.(id);
  }
};
