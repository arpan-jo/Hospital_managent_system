/**
 * The follow-up reminder: the evening before a follow-up the doctor wrote on a
 * prescription, the phone says so — set when the patient opens that
 * prescription, shown whether the app is open, in the background or closed.
 *
 *   - The day before the follow-up, at 8 PM.
 *   - Set after 8 PM that evening (seen by the doctor late, follow-up
 *     tomorrow): at 10 PM.
 *   - Set after 10 PM that evening, or the follow-up is today or past: nothing.
 *
 * The same rule however far off the follow-up is and whenever the prescription
 * is first opened — 8 PM unless that has already passed.
 *
 * One reminder per follow-up visit, ever: opening the prescription again never
 * sets a second one, nor moves one already set, nor sets one again after it
 * showed — and the same visit written on two prescriptions is one reminder.
 * That is kept on the phone (MMKV), per account, so it holds across launches
 * and across signing out and in.
 *
 * A session that expires keeps its reminders — the patient still has the
 * follow-up. Logout takes them off the phone; they come back when the same
 * account signs in again. A different account signing in never sees them.
 *
 * It only ever shows the day before. If the phone could not show it then (it
 * was off at 8 or 10 PM and puts it up when it comes back on, on the follow-up
 * day or later), it is taken away at once — nothing is shown late.
 */
import type * as NotifeeModule from '@notifee/react-native';
import i18next from './i18n';
import { withDoctorTitle } from './format';
import { storage } from './secureStorage';
import {
  cancelReminder,
  cancelReminders,
  loadNotifee,
  scheduleReminder,
} from './localNotifications';
import { askNotificationPermissionOnce } from './notificationPermission';

/** The reminder shows the day before the follow-up at this hour. */
export const DAY_BEFORE_REMINDER_HOUR = 20;
/** …or at this hour that same evening, when it is set after 8 PM. */
export const LATE_REMINDER_HOUR = 22;

const ID_PREFIX = 'followup-';
const CHANNEL_ID = 'follow-up-reminder';
/**
 * One account's records: `${RECORDS_PREFIX}${userId}` →
 * `${prescriptionId}|${YYYY-MM-DD}` → FollowUpReminderRecord.
 */
const RECORDS_PREFIX = 'reminder_followup_records_';
/** The account signed in on this phone — whose reminders are set. */
const OWNER_KEY = 'reminder_followup_owner';

/** The follow-up day a reminder is for, carried with it (notification.data — strings only). */
const DATA_DATE = 'followUpDate';
/** Notifee's EventType.DELIVERED. */
const EVENT_DELIVERED = 3;

/** 'YYYY-MM-DD', with anything after the day (a time) ignored. */
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/;

const pad2 = (value: number) => String(value ?? 0)?.padStart?.(2, '0') ?? '00';
const isoDay = (day: Date) =>
  `${day?.getFullYear?.()}-${pad2((day?.getMonth?.() ?? 0) + 1)}-${pad2(
    day?.getDate?.() ?? 0,
  )}`;

/** A real moment, or now — a missing or broken Date never reaches the arithmetic. */
const validDate = (value: Date | null | undefined): Date =>
  value instanceof Date && Number.isFinite(value?.getTime?.())
    ? value
    : new Date();

/** The translation, or '' — never "undefined" on the phone. */
const tr = (key: string, options?: Record<string, unknown>): string => {
  const text = i18next?.t?.(key, options as any);
  return typeof text === 'string' ? text : '';
};

/**
 * A follow-up date → that day's midnight on the phone's own clock. Null for
 * anything that is not a real 'YYYY-MM-DD' day ("2026-02-30", "", "21/11/2026").
 * Never `new Date('YYYY-MM-DD')`, which reads the day as UTC.
 */
export const parseFollowUpDay = (value: string): Date | null => {
  const match = ISO_DAY.exec(String(value ?? '')?.trim?.() ?? '');
  if (!match) return null;
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const day = Number(match?.[3]);
  const date = new Date(year, month - 1, day);
  return date?.getFullYear?.() === year &&
    date?.getMonth?.() === month - 1 &&
    date?.getDate?.() === day
    ? date
    : null;
};

/** `day` moved by `days`, at `hour` o'clock. */
const dayAt = (day: Date, days: number, hour: number) =>
  new Date(
    day?.getFullYear?.(),
    day?.getMonth?.(),
    (day?.getDate?.() ?? 0) + days,
    hour,
    0,
    0,
    0,
  );

/** When the reminder for a follow-up on `followUpDate` shows; null when it should not. */
export const followUpReminderTime = (
  followUpDate: string,
  now?: Date,
): Date | null => {
  const day = parseFollowUpDay(followUpDate);
  if (!day) return null;

  const nowMs = validDate(now)?.getTime?.() ?? Date.now();

  // The day before at 8 PM; past that, 10 PM the same evening; past that, nothing.
  for (const hour of [DAY_BEFORE_REMINDER_HOUR, LATE_REMINDER_HOUR]) {
    const at = dayAt(day, -1, hour);
    if ((at?.getTime?.() ?? 0) > nowMs) return at;
  }
  return null;
};

export interface FollowUpReminderRecord {
  /** When it was set to show (ms). */
  at: number;
  doctor: string;
  patient: string;
  /**
   * The notification this follow-up relies on: its own, or the one another
   * prescription set for the same visit. Older records have none — their own.
   */
  id?: string;
}
export type FollowUpReminderRecords = Record<string, FollowUpReminderRecord>;

export interface FollowUpReminderPlanItem {
  key: string;
  /** The notification's id — setting the same id again replaces it, never a second copy. */
  id: string;
  date: string;
  at: Date;
  /** True for a reminder set for the first time; false for one set again as it was. */
  isNew: boolean;
}

export interface FollowUpReminderPlan {
  /** Notifications to set: new ones, and ones already set and still ahead, set again as they were. */
  schedule: FollowUpReminderPlanItem[];
  /** Records to store as given: this prescription relying on another's reminder for the same visit. */
  keep: FollowUpReminderRecords;
  /** Records to drop: this prescription's days no longer on it (the doctor changed them) and days gone. */
  drop: string[];
  /** Notifications to take away: those of dropped days that no record left relies on. */
  cancelIds: string[];
}

const recordKey = (prescriptionId: number | string, date: string) =>
  `${prescriptionId}|${date}`;
const reminderId = (prescriptionId: number | string, date: string) =>
  `${ID_PREFIX}${prescriptionId}-${date}`;
const dateOfKey = (key: string) => String(key ?? '')?.split?.('|')?.[1] ?? '';
/** The notification a record relies on. */
const idOf = (key: string, record?: FollowUpReminderRecord) => {
  if (record?.id) return String(record.id);
  const [prescriptionId = '', date = ''] =
    String(key ?? '')?.split?.('|') ?? [];
  return reminderId(prescriptionId, date);
};
const sameName = (a: string | undefined, b: string | undefined) =>
  String(a ?? '')
    ?.trim?.()
    ?.toLowerCase?.() ===
  String(b ?? '')
    ?.trim?.()
    ?.toLowerCase?.();

/**
 * What to do for one prescription's follow-up dates, given what is already set.
 * Pure — no phone, no storage — so every case can be tested.
 */
export const planFollowUpReminders = ({
  prescriptionId,
  dates,
  doctorName,
  patientName,
  records,
  now,
}: {
  prescriptionId: number;
  dates: string[];
  doctorName: string;
  patientName: string;
  records: FollowUpReminderRecords;
  now: Date;
}): FollowUpReminderPlan => {
  const prefix = `${prescriptionId}|`;
  const clock = validDate(now);
  const nowMs = clock?.getTime?.() ?? Date.now();
  const doctor = String(doctorName ?? '')?.trim?.() ?? '';
  const patient = String(patientName ?? '')?.trim?.() ?? '';
  const known: FollowUpReminderRecords =
    records && typeof records === 'object' && !Array.isArray(records)
      ? records
      : {};
  const knownKeys = Object.keys(known ?? {});
  const days = [
    ...new Set(
      (Array.isArray(dates) ? dates : [])
        ?.map(date => parseFollowUpDay(date))
        ?.filter((day): day is Date => day !== null)
        ?.map(isoDay) ?? [],
    ),
  ];
  const today = isoDay(clock);

  const drop = new Set<string>();
  // Follow-up days already gone.
  knownKeys?.forEach(key => {
    if (dateOfKey(key) < today) drop.add(key);
  });
  // This prescription's days no longer on it: the doctor changed or removed them.
  const dropped: string[] = [];
  knownKeys?.forEach(key => {
    if (
      key?.startsWith?.(prefix) &&
      !days?.includes?.(key?.slice?.(prefix.length))
    ) {
      drop.add(key);
      dropped.push(idOf(key, known?.[key]));
    }
  });

  const keep: FollowUpReminderRecords = {};
  const schedule: FollowUpReminderPlanItem[] = [];
  for (const date of days) {
    const key = recordKey(prescriptionId, date);
    const record = known?.[key];

    if (record) {
      // Set once: never moved, and never set again once it has shown. One still
      // ahead is set again as it was — the same id replaces it, so a phone that
      // lost it (Force stop) gets it back, never a second copy.
      const at = Number(record?.at);
      if (Number.isFinite(at) && at > nowMs) {
        schedule.push({
          key,
          id: idOf(key, record),
          date,
          at: new Date(at),
          isNew: false,
        });
      }
      continue;
    }

    // The same visit written on another prescription (same doctor, patient and
    // day): this one relies on that reminder — never a second one, and it stays
    // as long as either prescription still has the visit.
    const visit = doctor
      ? Object.entries(known ?? {})?.find(
          ([other, set]) =>
            !other?.startsWith?.(prefix) &&
            !drop.has(other) &&
            dateOfKey(other) === date &&
            sameName(set?.doctor, doctor) &&
            sameName(set?.patient, patient),
        )
      : undefined;
    if (visit) {
      const [otherKey, set] = visit;
      const at = Number(set?.at);
      if (!Number.isFinite(at)) continue;
      const id = idOf(otherKey, set);
      keep[key] = { at, doctor, patient, id };
      if (at > nowMs) {
        schedule.push({ key, id, date, at: new Date(at), isNew: false });
      }
      continue;
    }

    const at = followUpReminderTime(date, clock);
    if (!at) continue;
    schedule.push({
      key,
      id: reminderId(prescriptionId, date),
      date,
      at,
      isNew: true,
    });
  }

  // A dropped day's reminder goes only when nothing left relies on it.
  const reliedOn = new Set<string>();
  knownKeys?.forEach(key => {
    if (!drop.has(key)) reliedOn.add(idOf(key, known?.[key]));
  });
  Object.entries(keep)?.forEach(([key, set]) => reliedOn.add(idOf(key, set)));
  schedule?.forEach(item => reliedOn.add(item?.id));
  const cancelIds = [...new Set(dropped)]?.filter(id => !reliedOn.has(id));

  return { schedule, keep, drop: [...drop], cancelIds };
};

/**
 * The reminder's lines, for a patient (or a family member) glancing at the
 * phone at night: who to see again and on which day — the day in full, so it
 * still reads right the next morning — and whose follow-up it is.
 *
 *   See Dr. Aysha Akther again on Thursday, 19 November
 *   Patient: Karim Hossain
 *
 * Worded for whoever holds the phone, so it fits a family member's follow-up too.
 */
export const followUpReminderBody = (
  date: string,
  doctorName: string,
  patientName: string,
): string => {
  const day = parseFollowUpDay(date);
  const dayText = day
    ? `${tr(`dayNames.${day?.getDay?.()}`)}, ${day?.getDate?.()} ${tr(
        `monthNames.${day?.getMonth?.()}`,
      )}`
    : '';
  const doctor = withDoctorTitle(doctorName);
  const visit = dayText
    ? doctor
      ? tr('followUpReminder.visit', { doctor, day: dayText })
      : tr('followUpReminder.visitNoDoctor', { day: dayText })
    : doctor;
  const name = String(patientName ?? '')?.trim?.() ?? '';
  const patient = name ? tr('followUpReminder.patient', { name }) : '';
  return [visit, patient]?.filter(Boolean)?.join('\n') ?? '';
};

/** The signed-in account's records key (0 when none is known). */
const recordsKey = (userId?: number) => {
  const owner =
    Math.trunc(Number(userId ?? storage?.getString?.(OWNER_KEY) ?? 0)) || 0;
  return `${RECORDS_PREFIX}${owner > 0 ? owner : 0}`;
};

/** The records, {} when there are none, null when they cannot be read. */
const readRecords = (key: string): FollowUpReminderRecords | null => {
  try {
    const parsed = JSON.parse(storage?.getString?.(key) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch (error: any) {
    console.log('follow-up reminder records error ==>', error?.message);
    return null;
  }
};

/** Applied onto what is stored now, so a call running alongside loses nothing. */
const updateRecords = (
  key: string,
  remove: string[],
  add: FollowUpReminderRecords,
) => {
  try {
    const records = readRecords(key) ?? {};
    (remove ?? [])?.forEach(item => delete records?.[item]);
    Object.assign(records, add ?? {});
    storage?.set?.(key, JSON.stringify(records));
  } catch (error: any) {
    console.log('follow-up reminder save error ==>', error?.message);
  }
};

/** Sets one follow-up reminder on the phone; true when it is set. */
const setFollowUpReminder = async (
  id: string,
  at: Date,
  date: string,
  doctorName: string,
  patientName: string,
): Promise<boolean> => {
  const day = parseFollowUpDay(date);
  const set = await scheduleReminder?.({
    id,
    at,
    title: tr('followUpReminder.title'),
    body: followUpReminderBody(date, doctorName, patientName),
    channel: {
      id: CHANNEL_ID,
      name: tr('followUpReminder.channelName') || 'Follow-up reminders',
    },
    dismissLabel: tr('followUpReminder.ok'),
    // Gone by itself once the follow-up day is over.
    removeAt: day ? dayAt(day, 1, 0) : undefined,
    // So a late showing can tell it is late (handleFollowUpEvent).
    data: { [DATA_DATE]: date },
  });
  return set === true;
};

export interface FollowUpReminderInput {
  prescriptionId: number;
  /** The prescription's follow-up dates — the print data's `followUpDates`. */
  dates: string[];
  doctorName?: string;
  patientName?: string;
}

/**
 * Sets the reminders for one opened prescription's follow-up dates, takes away
 * those for a date the doctor has since changed, and leaves the rest alone.
 * Never throws and never blocks: call it and move on.
 */
export const scheduleFollowUpReminders = async (
  input: FollowUpReminderInput,
): Promise<void> => {
  try {
    const prescriptionId = Math.trunc(Number(input?.prescriptionId) || 0);
    if (prescriptionId <= 0) return;
    const doctorName = String(input?.doctorName ?? '')?.trim?.() ?? '';
    const patientName = String(input?.patientName ?? '')?.trim?.() ?? '';
    const key = recordsKey();

    let records = readRecords(key);
    if (records === null) {
      // Unreadable: start over, and take away what was set from it first, so an
      // old date can never show beside the new one.
      await cancelReminders?.(ID_PREFIX);
      storage?.set?.(key, '{}');
      records = {};
    }

    const plan = planFollowUpReminders({
      prescriptionId,
      dates: Array.isArray(input?.dates) ? input?.dates : [],
      doctorName,
      patientName,
      records,
      now: new Date(),
    });

    for (const id of plan?.cancelIds ?? []) {
      await cancelReminder?.(id);
    }

    const toSchedule = plan?.schedule ?? [];
    // Normally asked at sign-in already; this covers a patient who never was.
    if (toSchedule?.some(item => item?.isNew)) await askNotificationPermissionOnce?.();

    const set: FollowUpReminderRecords = {};
    for (const item of toSchedule) {
      const ok = await setFollowUpReminder(
        item?.id,
        item?.at,
        item?.date,
        doctorName,
        patientName,
      );
      const at = item?.at?.getTime?.();
      if (ok && item?.key && Number.isFinite(at) && !plan?.keep?.[item.key]) {
        set[item.key] = {
          at: at as number,
          doctor: doctorName,
          patient: patientName,
          id: item?.id,
        };
      }
    }

    updateRecords(key, plan?.drop ?? [], { ...(plan?.keep ?? {}), ...set });
  } catch (error: any) {
    console.log('scheduleFollowUpReminders error ==>', error?.message);
  }
};

/**
 * Puts back the account's reminders still to come — after the phone's set ones
 * were taken away. Each notification once, even when two prescriptions rely on it.
 */
const restoreFollowUpReminders = async (userId: number) => {
  try {
    const records = readRecords(recordsKey(userId)) ?? {};
    const nowMs = Date.now();
    const done = new Set<string>();
    for (const [key, set] of Object.entries(records)) {
      const at = Number(set?.at);
      const id = idOf(key, set);
      if (!Number.isFinite(at) || at <= nowMs || done.has(id)) continue;
      done.add(id);
      await setFollowUpReminder(
        id,
        new Date(at),
        dateOfKey(key),
        set?.doctor ?? '',
        set?.patient ?? '',
      );
    }
  } catch (error: any) {
    console.log('restoreFollowUpReminders error ==>', error?.message);
  }
};

/**
 * Logout: takes every follow-up reminder off the phone, so the next person on
 * it never sees them. What was set and what has shown stays recorded for the
 * account, so signing in again brings back only those still to come — never a
 * second one. Never throws.
 */
export const clearFollowUpReminders = async (): Promise<void> => {
  try {
    storage?.remove?.(OWNER_KEY);
  } catch (error: any) {
    console.log('clearFollowUpReminders error ==>', error?.message);
  }
  await cancelReminders?.(ID_PREFIX);
};

/**
 * Sign-in: marks the phone's reminders as `userId`'s. When they were another
 * account's (or nobody's), the set ones are taken away and this account's own
 * still to come are put back — no one sees someone else's doctor.
 */
export const claimFollowUpReminders = (userId: number) => {
  const id = Math.trunc(Number(userId) || 0);
  if (id <= 0) return;
  try {
    const owner = Number(storage?.getString?.(OWNER_KEY) ?? '') || 0;
    if (owner === id) return;
    // The owner is written before anything waits, so a prescription opened
    // right after sign-in already records under this account.
    storage?.set?.(OWNER_KEY, String(id));
    (async () => {
      await cancelReminders?.(ID_PREFIX);
      await restoreFollowUpReminders(id);
    })().catch((error: any) => {
      console.log('claimFollowUpReminders error ==>', error?.message);
    });
  } catch (error: any) {
    console.log('claimFollowUpReminders error ==>', error?.message);
  }
};

/**
 * A reminder only ever shows the day before. One the phone puts up late — it
 * was off at 8 or 10 PM and Notifee shows the missed one when it comes back
 * on, on the follow-up day or after — is taken away at once: if it could not
 * show the day before, nothing shows. On time it is left as it is. Hooked up
 * through `registerNotificationHandlers` in index.js.
 */
export const handleFollowUpEvent = async (event: NotifeeModule.Event) => {
  const notification = event?.detail?.notification;
  const id = String(notification?.id ?? '');
  const delivered = loadNotifee()?.EventType?.DELIVERED ?? EVENT_DELIVERED;
  if (event?.type !== delivered || !id?.startsWith?.(ID_PREFIX)) return;

  const day = parseFollowUpDay(String(notification?.data?.[DATA_DATE] ?? ''));
  if (!day) return;
  // From the follow-up day's midnight on, it is no longer the day before.
  if (Date.now() >= (day?.getTime?.() ?? Infinity)) {
    await cancelReminder?.(id);
  }
};
