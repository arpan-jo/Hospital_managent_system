/**
 * Reminders the phone shows by itself at a set time — whether the app is open,
 * in the background or closed. Any module can set one (a follow-up today; an
 * appointment or a medicine later): Notifee keeps it on the phone and puts it
 * back after a reboot.
 *
 * A reminder never opens the app: "OK", a tap on it or a swipe only clears it.
 * Opening a screen would need a live session, and by the time a reminder shows
 * the login may well have expired.
 *
 * Nothing here throws. A reminder is a convenience; failing to set one must
 * never break the screen that asked for it.
 *
 * Notifee is loaded lazily: its module throws on import when the native side is
 * missing (an install built before it was added), and that must leave
 * reminders unavailable rather than crash the app at launch.
 */
import { Platform } from 'react-native';
import type * as NotifeeModule from '@notifee/react-native';

let notifeeModule: typeof NotifeeModule | null | undefined;

/** Notifee, or null when this build has no native side for it. */
export const loadNotifee = (): typeof NotifeeModule | null => {
  if (notifeeModule === undefined) {
    try {
      notifeeModule = require('@notifee/react-native') as typeof NotifeeModule;
    } catch (error: any) {
      console.log('notifee unavailable ==>', error?.message);
      notifeeModule = null;
    }
  }
  return notifeeModule;
};

/** The "OK" button on a reminder. */
const DISMISS_ACTION_ID = 'reminder-dismiss';
/**
 * A tap on the reminder itself. Any id but 'default' leaves out Notifee's
 * launchActivity, so the tap opens nothing; autoCancel takes the reminder away.
 */
const PRESS_ID = 'reminder-press';

/** Status-bar icon — res/drawable/ic_stat_alarm; the launcher icon reads as a blank circle there. */
const SMALL_ICON = 'ic_stat_alarm';
const ACCENT = '#2F45E5';

export interface ReminderChannel {
  /** One per kind of reminder, so the patient can silence one kind in the phone's settings. */
  id: string;
  /** The name the phone's notification settings show. */
  name: string;
}

export interface ReminderInput {
  /** Setting the same id again replaces the earlier reminder — never a second copy. */
  id: string;
  /** When it shows. A time already past sets nothing. */
  at: Date;
  title: string;
  body: string;
  channel: ReminderChannel;
  /** The label of the button that clears it ("OK"). */
  dismissLabel: string;
  /** It leaves the notification shade by itself at this time, read or not. */
  removeAt?: Date;
  /** Carried with the notification and handed back in its events — strings only. */
  data?: Record<string, string>;
}

/**
 * Notifee's own values for the enums used here (types/Trigger, Notification,
 * NotificationAndroid in @notifee/react-native 9.1.8), read through `?.` with
 * these behind them — so a module that somehow lacks one can never leave
 * Notifee to its default alarm type, the exact one it drops without permission.
 */
const ALARM_INEXACT = 1; // AlarmType.SET_AND_ALLOW_WHILE_IDLE
const ALARM_EXACT = 3; // AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE
const IMPORTANCE_HIGH = 4; // AndroidImportance.HIGH
const STYLE_BIGTEXT = 1; // AndroidStyle.BIGTEXT
const TRIGGER_TIMESTAMP = 0; // TriggerType.TIMESTAMP
const SETTING_ENABLED = 1; // AndroidNotificationSetting.ENABLED
const STATUS_DENIED = 0; // AuthorizationStatus.DENIED
const STATUS_AUTHORIZED = 1; // AuthorizationStatus.AUTHORIZED
const STATUS_PROVISIONAL = 2; // AuthorizationStatus.PROVISIONAL (iOS)
const EVENT_PRESS = 1; // EventType.PRESS
const EVENT_ACTION_PRESS = 2; // EventType.ACTION_PRESS

/**
 * Text as Notifee shows it. On Android it reads the title, the body and a
 * button's label as HTML (HtmlCompat.fromHtml), so a name with "&" or "<"
 * would be taken for markup and a "\n" would show as a space: the text is
 * escaped, and each line break becomes <br>. Elsewhere it is plain text.
 */
export const toNotificationText = (text: string): string => {
  const plain = String(text ?? '');
  if (Platform?.OS !== 'android') return plain;
  return plain
    ?.replace(/&/g, '&amp;')
    ?.replace(/</g, '&lt;')
    ?.replace(/>/g, '&gt;')
    ?.replace(/\r?\n/g, '<br>');
};

/**
 * Android 12+: whether "Alarms & reminders" is on for the app. Only then may a
 * reminder show on the minute — asked for otherwise, Notifee drops it without
 * a word. Never true off Android, where the alarm type does not apply.
 */
const canShowOnTime = async (lib: typeof NotifeeModule | null): Promise<boolean> => {
  if (Platform?.OS !== 'android') return false;
  try {
    const settings = await lib?.default?.getNotificationSettings?.();
    const enabled = lib?.AndroidNotificationSetting?.ENABLED ?? SETTING_ENABLED;
    return settings?.android?.alarm === enabled;
  } catch (error: any) {
    console.log('notification settings error ==>', error?.message);
    return false;
  }
};

/**
 * Sets one reminder. True when it is set; false when it could not be — the
 * time is past, or the phone or this build cannot show it.
 */
export const scheduleReminder = async (input: ReminderInput): Promise<boolean> => {
  const lib = loadNotifee();
  const notifee = lib?.default;
  const id = String(input?.id ?? '').trim();
  const at = input?.at?.getTime?.() ?? NaN;
  // Notifee refuses a time already past, so it is never asked to.
  if (!notifee || !id || !Number.isFinite(at) || at <= Date.now()) return false;

  try {
    const importance = lib?.AndroidImportance?.HIGH ?? IMPORTANCE_HIGH;
    const category = lib?.AndroidCategory?.REMINDER;
    const channelId = await notifee?.createChannel?.({
      id: input?.channel?.id ?? '',
      name: input?.channel?.name || input?.channel?.id || '',
      importance,
      sound: 'default',
      vibration: true,
    });
    // Only Android has channels: on iOS Notifee answers '' and that is fine.
    if (Platform?.OS === 'android' && !channelId) return false;

    // On the minute when the phone allows it; otherwise Android shows it a
    // little late (on Android 12+ within about an hour) but never drops it.
    const alarmType = (await canShowOnTime(lib))
      ? lib?.AlarmType?.SET_EXACT_AND_ALLOW_WHILE_IDLE ?? ALARM_EXACT
      : lib?.AlarmType?.SET_AND_ALLOW_WHILE_IDLE ?? ALARM_INEXACT;

    const removeAt = input?.removeAt?.getTime?.() ?? NaN;
    const timeoutAfter = Number.isFinite(removeAt) && removeAt > at ? removeAt - at : undefined;

    const body = toNotificationText(input?.body ?? '');
    await notifee?.createTriggerNotification?.(
      {
        id,
        title: toNotificationText(input?.title ?? ''),
        body,
        ...(input?.data ? { data: input.data } : {}),
        android: {
          channelId,
          smallIcon: SMALL_ICON,
          color: ACCENT,
          // Left out rather than sent empty, which Notifee would refuse.
          ...(category ? { category } : {}),
          importance,
          // Every line of the body when it is pulled open, not just the first.
          style: { type: lib?.AndroidStyle?.BIGTEXT ?? STYLE_BIGTEXT, text: body },
          autoCancel: true,
          pressAction: { id: PRESS_ID },
          actions: [
            { title: toNotificationText(input?.dismissLabel || 'OK'), pressAction: { id: DISMISS_ACTION_ID } },
          ],
          ...(timeoutAfter ? { timeoutAfter } : {}),
        },
        ios: { sound: 'default' },
      },
      {
        type: lib?.TriggerType?.TIMESTAMP ?? TRIGGER_TIMESTAMP,
        timestamp: at,
        alarmManager: { type: alarmType },
      },
    );
    return true;
  } catch (error: any) {
    console.log('scheduleReminder error ==>', error?.message);
    return false;
  }
};

/** Takes one reminder away — still to show, or showing now. */
export const cancelReminder = async (id: string) => {
  const notifee = loadNotifee()?.default;
  if (!notifee || !id) return;
  try {
    await notifee?.cancelNotification?.(id);
  } catch (error: any) {
    console.log('cancelReminder error ==>', error?.message);
  }
};

/** Takes away every reminder whose id starts with `idPrefix` — still to show, or showing now. */
export const cancelReminders = async (idPrefix: string) => {
  const notifee = loadNotifee()?.default;
  if (!notifee || !idPrefix) return;
  try {
    const scheduled = await notifee?.getTriggerNotificationIds?.();
    const scheduledIds = (Array.isArray(scheduled) ? scheduled : [])
      ?.map(id => String(id ?? ''))
      ?.filter(id => id?.startsWith?.(idPrefix));
    if (scheduledIds?.length) await notifee?.cancelTriggerNotifications?.(scheduledIds);

    const shown = await notifee?.getDisplayedNotifications?.();
    const shownIds = (Array.isArray(shown) ? shown : [])
      ?.map(item => String(item?.id ?? item?.notification?.id ?? ''))
      ?.filter(id => id?.startsWith?.(idPrefix));
    if (shownIds?.length) await notifee?.cancelDisplayedNotifications?.(shownIds);
  } catch (error: any) {
    console.log('cancelReminders error ==>', error?.message);
  }
};

export type NotificationPermission = 'granted' | 'denied' | 'unavailable';

/**
 * Asks to show notifications (Android 13+ asks the patient; older phones allow
 * them already) and gives the phone's answer — 'unavailable' when it could not
 * be asked (no native side, or no screen to ask on).
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  const lib = loadNotifee();
  if (!lib?.default) return 'unavailable';
  try {
    const settings = await lib?.default?.requestPermission?.();
    const status = settings?.authorizationStatus;
    if (status === (lib?.AuthorizationStatus?.DENIED ?? STATUS_DENIED)) return 'denied';
    if (
      status === (lib?.AuthorizationStatus?.AUTHORIZED ?? STATUS_AUTHORIZED) ||
      status === (lib?.AuthorizationStatus?.PROVISIONAL ?? STATUS_PROVISIONAL)
    ) {
      return 'granted';
    }
    return 'unavailable';
  } catch (error: any) {
    console.log('requestNotificationPermission error ==>', error?.message);
    return 'unavailable';
  }
};

export type NotificationEventHandler = (event: NotifeeModule.Event) => Promise<void> | void;

/** "OK" or a tap on a reminder takes it away. */
const handleReminderEvent = async (event: NotifeeModule.Event) => {
  const lib = loadNotifee();
  const id = event?.detail?.notification?.id;
  const pressId = event?.detail?.pressAction?.id;
  if (!lib || !id) return;
  const isDismiss =
    (event?.type === (lib?.EventType?.ACTION_PRESS ?? EVENT_ACTION_PRESS) && pressId === DISMISS_ACTION_ID) ||
    (event?.type === (lib?.EventType?.PRESS ?? EVENT_PRESS) && pressId === PRESS_ID);
  if (!isDismiss) return;
  await cancelReminder(id);
};

/**
 * Notifee keeps only one background handler for the whole app, so every kind
 * of notification answers through this one: the reminders' own, then each of
 * `others` in turn (a handler ignores events that are not its own). Called once
 * from index.js, before the app registers, so the buttons work while the app
 * is closed too.
 */
export const registerNotificationHandlers = (...others: NotificationEventHandler[]) => {
  const notifee = loadNotifee()?.default;
  if (!notifee) return;
  // Only real functions: one left undefined (a module that failed to load) is skipped, not called.
  const handlers = [handleReminderEvent, ...(others ?? [])]?.filter(
    (handle): handle is NotificationEventHandler => typeof handle === 'function',
  );
  const dispatch = async (event: NotifeeModule.Event) => {
    for (const handle of handlers) {
      try {
        await handle?.(event);
      } catch (error: any) {
        console.log('notification event error ==>', error?.message);
      }
    }
  };
  try {
    notifee?.onBackgroundEvent?.(dispatch);
    notifee?.onForegroundEvent?.(dispatch);
  } catch (error: any) {
    console.log('registerNotificationHandlers error ==>', error?.message);
  }
};
