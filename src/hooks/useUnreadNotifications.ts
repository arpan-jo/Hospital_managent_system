import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { INotificationStore, NotificationRepository, useStores } from '@app/core';

/** How often the badge is re-read while the app is open — as often as the portal's bell. */
export const UNREAD_POLL_MS = 30_000;

/** Bumped on sign-out, so a read that left before it does not land on the next account's badge. */
let session = 0;
/**
 * One read at a time per signed-in account: a call made while one is on its
 * way shares it — but never one the previous account left on its way.
 */
let inFlight: { session: number; read: Promise<void> } | null = null;

/** The sign-in a count belongs to; a count read under an older one is dropped. */
export const unreadSession = (): number => session;

export const readUnreadCount = (store: INotificationStore): Promise<void> => {
  if (inFlight?.session === session) return inFlight.read;
  const entry: { session: number; read: Promise<void> } = { session, read: Promise.resolve() };
  inFlight = entry;
  entry.read = (async () => {
    try {
      const count = await NotificationRepository.getUnreadCount();
      if (entry.session === session) store.setUnreadCount(count);
    } catch (e: any) {
      // The badge keeps its last count; the next moment it is read tries again.
      console.log('getUnreadCount error ==>', e?.message);
    } finally {
      if (inFlight === entry) inFlight = null;
    }
  })();
  return entry.read;
};

/** Signing out: whatever is still on its way belongs to the account that left. */
export const endUnreadSession = (store: INotificationStore): void => {
  session += 1;
  store.reset();
};

/**
 * Re-reads the unread count behind the bell's badge — called when the bell's
 * screen comes into view; `useUnreadNotificationsSync` also calls it on a timer.
 */
export const useRefreshUnreadNotifications = () => {
  const { notificationStore } = useStores();
  return useCallback(() => readUnreadCount(notificationStore), [notificationStore]);
};

/**
 * Reads the badge on sign-in, then keeps it fresh as the portal's bell does:
 * every 30 s while the app is open, and at once on coming back to it — never in
 * the background, where it would only spend the battery. Mount it once, under
 * the signed-in navigator — leaving it (signing out) stops the timer and clears
 * the count.
 */
export const useUnreadNotificationsSync = () => {
  const { notificationStore } = useStores();
  const refresh = useRefreshUnreadNotifications();

  useEffect(() => {
    refresh();
    return () => endUnreadSession(notificationStore);
  }, [refresh, notificationStore]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        refresh();
      }, UNREAD_POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    if (AppState?.currentState === 'active') start();
    const subscription = AppState?.addEventListener?.('change', state => {
      if (state === 'active') {
        refresh();
        start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      subscription?.remove?.();
    };
  }, [refresh]);
};
