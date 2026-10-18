/**
 * A one-off alarm the patient sets: at the chosen time the phone rings with
 * their own message, whether the app is open or not, until they tap the stop
 * action or `ALARM_RING_MS` runs out. Notifee keeps the scheduled alarm on the
 * phone (and puts it back after a reboot), so nothing is stored here.
 *
 * Notifee is loaded lazily: its module throws on import when the native side
 * is missing (an install built before it was added), and that must leave the
 * alarm unavailable rather than crash the app at launch.
 */
import { Platform } from 'react-native';
import type * as NotifeeModule from '@notifee/react-native';

/** How long an alarm rings before it stops by itself. */
export const ALARM_RING_MS = 30_000;

const CHANNEL_ID = 'patient-alarm';
const STOP_ACTION_ID = 'stop-alarm';

let notifeeModule: typeof NotifeeModule | null | undefined;

const loadNotifee = (): typeof NotifeeModule | null => {
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

/**
 * The next time the clock shows `time`'s hour and minute: today while that is
 * still ahead, otherwise tomorrow.
 */
export const nextAlarmTime = (time: Date, now: Date = new Date()): Date => {
  const at = new Date(now);
  at.setHours(time?.getHours?.() ?? 0, time?.getMinutes?.() ?? 0, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at;
};

export type AlarmPermission =
  | 'granted'
  /** Notifications are off for the app. */
  | 'notificationsBlocked'
  /** Android 12+: "Alarms & reminders" is off, so no alarm can be scheduled. */
  | 'exactAlarmBlocked'
  /** The native side is missing from this build. */
  | 'unavailable';

/** Asks for notifications (the system prompt shows once) and reports what still blocks an alarm. */
export const requestAlarmPermission = async (): Promise<AlarmPermission> => {
  const lib = loadNotifee();
  if (!lib) return 'unavailable';

  const settings = await lib.default.requestPermission();
  if (settings?.authorizationStatus === lib.AuthorizationStatus.DENIED) {
    return 'notificationsBlocked';
  }
  if (
    Platform.OS === 'android' &&
    settings?.android?.alarm !== lib.AndroidNotificationSetting.ENABLED
  ) {
    return 'exactAlarmBlocked';
  }
  return 'granted';
};

/** Opens the system page that fixes `permission`. */
export const openAlarmPermissionSettings = async (
  permission: AlarmPermission,
) => {
  const lib = loadNotifee();
  if (!lib) return;
  try {
    if (permission === 'exactAlarmBlocked') {
      await lib.default.openAlarmPermissionSettings();
    } else if (permission === 'notificationsBlocked') {
      await lib.default.openNotificationSettings();
    }
  } catch (error: any) {
    console.log('openAlarmPermissionSettings error ==>', error?.message);
  }
};

export interface AlarmInput {
  /** When it rings — see `nextAlarmTime`. */
  at: Date;
  /** The patient's own words, shown as the alarm. */
  message: string;
  /** The stop action's label. */
  stopLabel: string;
  /** The channel's name in the phone's notification settings. */
  channelName: string;
}

/** Schedules one alarm. Throws when it could not be scheduled. */
export const scheduleAlarm = async ({
  at,
  message,
  stopLabel,
  channelName,
}: AlarmInput) => {
  const lib = loadNotifee();
  if (!lib) throw new Error('Alarms are not available in this build');

  const notifee = lib.default;
  const channelId = await notifee.createChannel({
    id: CHANNEL_ID,
    name: channelName,
    importance: lib.AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

  await notifee.createTriggerNotification(
    {
      title: message,
      android: {
        channelId,
        // res/drawable/ic_stat_alarm — the launcher icon reads as a blank circle in the status bar.
        smallIcon: 'ic_stat_alarm',
        color: '#2F45E5',
        category: lib.AndroidCategory.ALARM,
        importance: lib.AndroidImportance.HIGH,
        // Rings on until stopped, but never past ALARM_RING_MS.
        loopSound: true,
        timeoutAfter: ALARM_RING_MS,
        autoCancel: true,
        pressAction: { id: 'default' },
        actions: [{ title: stopLabel, pressAction: { id: STOP_ACTION_ID } }],
      },
      ios: { sound: 'default' },
    },
    {
      type: lib.TriggerType.TIMESTAMP,
      timestamp: at.getTime(),
      // Rings on time even while the phone dozes.
      alarmManager: { allowWhileIdle: true },
    },
  );
};

/** The stop action silences the alarm by taking it away. */
const handleAlarmEvent = async (event: NotifeeModule.Event) => {
  const lib = loadNotifee();
  const notificationId = event?.detail?.notification?.id;
  if (
    !lib ||
    !notificationId ||
    event?.type !== lib.EventType.ACTION_PRESS ||
    event?.detail?.pressAction?.id !== STOP_ACTION_ID
  ) {
    return;
  }
  try {
    await lib.default.cancelNotification(notificationId);
  } catch (error: any) {
    console.log('stop alarm error ==>', error?.message);
  }
};

/**
 * Hooks the stop action up, for an open app and for one that is closed —
 * called once from index.js, before the app registers.
 */
export const registerAlarmHandlers = () => {
  const lib = loadNotifee();
  if (!lib) return;
  try {
    lib.default.onBackgroundEvent(handleAlarmEvent);
    lib.default.onForegroundEvent(handleAlarmEvent);
  } catch (error: any) {
    console.log('registerAlarmHandlers error ==>', error?.message);
  }
};
