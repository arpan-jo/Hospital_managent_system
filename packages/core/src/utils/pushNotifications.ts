/**
 * Push notifications from the server (FCM): every notification the backend saves
 * for the bell is pushed to the phones the patient is signed in on, so it
 * arrives while the app is closed.
 *
 * - Closed or in the background: FCM shows it itself, on PUSH_CHANNEL_ID.
 * - Open: FCM shows nothing, so it is shown here through Notifee.
 * - A tap on either opens what it is about, through `watchPush`'s `onOpen`.
 *
 * The phone's token goes to the backend on sign-in and whenever FCM changes it,
 * and is taken back on Logout — before the logout request, which ends the login.
 *
 * Nothing here throws, and Firebase is loaded lazily like Notifee: a build
 * without its native side (or without google-services.json) only goes without
 * push, never crashes.
 */
import { Platform } from 'react-native';
import type * as MessagingModule from '@react-native-firebase/messaging';
import type * as NotifeeModule from '@notifee/react-native';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { ACCENT, SMALL_ICON, loadNotifee, toNotificationText } from './localNotifications';
import { storage } from './secureStorage';

/** The backend's PushSender.AndroidChannelId — the two must match. */
export const PUSH_CHANNEL_ID = 'hms-notifications';
/** A tap on a push shown while the app was open. */
const PUSH_PRESS_ID = 'push-open';
/** The token last sent to the backend, so Logout can take it back without asking FCM. */
const TOKEN_KEY = 'push_device_token';

const EVENT_PRESS = 1; // EventType.PRESS
const IMPORTANCE_HIGH = 4; // AndroidImportance.HIGH
const STYLE_BIGTEXT = 1; // AndroidStyle.BIGTEXT

type RemoteMessage = NonNullable<Awaited<ReturnType<typeof MessagingModule.getInitialNotification>>>;
type Messaging = ReturnType<typeof MessagingModule.getMessaging>;

let messagingModule: typeof MessagingModule | null | undefined;

/** Firebase Messaging and its instance, or null when this build cannot push. */
const loadMessaging = (): { lib: typeof MessagingModule; messaging: Messaging } | null => {
  if (messagingModule === undefined) {
    try {
      messagingModule = require('@react-native-firebase/messaging') as typeof MessagingModule;
    } catch (error: any) {
      console.log('firebase messaging unavailable ==>', error?.message);
      messagingModule = null;
    }
  }
  if (!messagingModule) return null;
  try {
    // Throws when the app has no Firebase config.
    return { lib: messagingModule, messaging: messagingModule.getMessaging() };
  } catch (error: any) {
    console.log('firebase messaging unavailable ==>', error?.message);
    return null;
  }
};

/** What a tap on a push opens: the notification's portal link, and its id to mark read. */
export interface PushOpen {
  link: string;
  notificationId: number;
}

/** A push's data as the backend sends it — null when it names nothing to open. */
export const toPushOpen = (data?: Record<string, unknown> | null): PushOpen | null => {
  const link = typeof data?.link === 'string' ? data.link.trim() : '';
  const id = Number(data?.notificationId);
  const notificationId = Number.isInteger(id) && id > 0 ? id : 0;
  return link || notificationId ? { link, notificationId } : null;
};

// A tap can come before anything listens (the app launched by it, or signed
// out): kept until `watchPush` starts.
let pendingOpen: PushOpen | null = null;
let openListener: ((open: PushOpen) => void) | null = null;

const deliverOpen = (data?: Record<string, unknown> | null) => {
  const open = toPushOpen(data);
  if (!open) return;
  if (openListener) openListener(open);
  else pendingOpen = open;
};

/** The phone's own channel for pushes; FCM falls back to "Miscellaneous" until it exists. */
export const createPushChannel = async (name: string): Promise<void> => {
  const lib = loadNotifee();
  if (Platform?.OS !== 'android' || !lib?.default) return;
  try {
    await lib.default.createChannel?.({
      id: PUSH_CHANNEL_ID,
      name: name || PUSH_CHANNEL_ID,
      importance: lib?.AndroidImportance?.HIGH ?? IMPORTANCE_HIGH,
      sound: 'default',
      vibration: true,
    });
  } catch (error: any) {
    console.log('createPushChannel error ==>', error?.message);
  }
};

/** Sends this phone's token to the backend for the signed-in user. */
export const registerPushDevice = async (token?: string): Promise<void> => {
  const push = loadMessaging();
  if (!push) return;
  try {
    const fcmToken = token || (await push.lib.getToken(push.messaging));
    if (!fcmToken) return;
    await NotificationRepository.registerDevice(fcmToken, Platform?.OS ?? 'android');
    storage?.set?.(TOKEN_KEY, fcmToken);
  } catch (error: any) {
    console.log('registerPushDevice error ==>', error?.message);
  }
};

/**
 * Logout: the backend stops pushing to this phone. Takes the login because the
 * stores are already cleared; must finish before `AuthRepository.logout`, which
 * ends that login.
 */
export const unregisterPushDevice = async (authToken?: string | null): Promise<void> => {
  const fcmToken = storage?.getString?.(TOKEN_KEY);
  if (!fcmToken) return;
  storage?.remove?.(TOKEN_KEY);
  if (!authToken) return;
  try {
    await NotificationRepository.removeDevice(fcmToken, authToken);
  } catch (error: any) {
    console.log('unregisterPushDevice error ==>', error?.message);
  }
};

/** A push that came while the app was open, shown as FCM would have shown it. */
const showWhileOpen = async (message: RemoteMessage) => {
  const lib = loadNotifee();
  const title = message?.notification?.title ?? '';
  const body = toNotificationText(message?.notification?.body ?? '');
  if (!lib?.default || (!title && !body)) return;
  try {
    await lib.default.displayNotification?.({
      title: toNotificationText(title),
      body,
      data: { ...(message?.data ?? {}), kind: 'push' },
      android: {
        channelId: PUSH_CHANNEL_ID,
        smallIcon: SMALL_ICON,
        color: ACCENT,
        importance: lib?.AndroidImportance?.HIGH ?? IMPORTANCE_HIGH,
        style: { type: lib?.AndroidStyle?.BIGTEXT ?? STYLE_BIGTEXT, text: body },
        autoCancel: true,
        pressAction: { id: PUSH_PRESS_ID, launchActivity: 'default' },
      },
      ios: { sound: 'default' },
    });
  } catch (error: any) {
    console.log('show push error ==>', error?.message);
  }
};

/**
 * A tap on a push shown through Notifee — for `registerNotificationHandlers`
 * in index.js, so it is heard whether the app was open or not.
 */
export const handlePushEvent = async (event: NotifeeModule.Event) => {
  const lib = loadNotifee();
  if (event?.type !== (lib?.EventType?.PRESS ?? EVENT_PRESS)) return;
  if (event?.detail?.pressAction?.id !== PUSH_PRESS_ID) return;
  deliverOpen(event?.detail?.notification?.data);
};

/**
 * From index.js, before the app registers: FCM shows a push itself while the
 * app is closed, but warns without a handler for the message in the background.
 */
export const setPushBackgroundHandler = () => {
  const push = loadMessaging();
  if (!push) return;
  try {
    push.lib.setBackgroundMessageHandler(push.messaging, async () => undefined);
  } catch (error: any) {
    console.log('setPushBackgroundHandler error ==>', error?.message);
  }
};

export interface PushWatchers {
  /** A push came while the app was open — the bell reads again. */
  onMessage?: () => void;
  /** A push was tapped. */
  onOpen: (open: PushOpen) => void;
}

/**
 * While signed in: keeps the token registered, shows pushes while the app is
 * open, and hands over every tap — including the one that launched the app.
 * Answers the way to stop.
 */
export const watchPush = ({ onMessage, onOpen }: PushWatchers): (() => void) => {
  openListener = onOpen;
  if (pendingOpen) {
    const open = pendingOpen;
    pendingOpen = null;
    onOpen(open);
  }

  const push = loadMessaging();
  const stops: Array<() => void> = [];
  if (push) {
    try {
      stops.push(push.lib.onTokenRefresh(push.messaging, token => registerPushDevice(token)));
      stops.push(
        push.lib.onMessage(push.messaging, message => {
          onMessage?.();
          showWhileOpen(message);
        }),
      );
      stops.push(push.lib.onNotificationOpenedApp(push.messaging, message => deliverOpen(message?.data)));
      push.lib
        .getInitialNotification(push.messaging)
        .then(message => deliverOpen(message?.data))
        .catch((error: any) => console.log('push initial notification error ==>', error?.message));
    } catch (error: any) {
      console.log('watchPush error ==>', error?.message);
    }
  }
  // The app launched by a tap on a push shown through Notifee while it was open.
  loadNotifee()
    ?.default?.getInitialNotification?.()
    ?.then(initial => {
      if (initial?.pressAction?.id === PUSH_PRESS_ID) deliverOpen(initial?.notification?.data);
    })
    ?.catch((error: any) => console.log('push initial notification error ==>', error?.message));

  return () => {
    if (openListener === onOpen) openListener = null;
    stops.forEach(stop => {
      try {
        stop?.();
      } catch {
        // already stopped
      }
    });
  };
};
