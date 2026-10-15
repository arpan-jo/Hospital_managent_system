import { useCallback, useEffect } from 'react';
import { INotificationStore, NotificationRepository, useStores } from '@app/core';

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
 * screen comes into view, not on a timer.
 */
export const useRefreshUnreadNotifications = () => {
  const { notificationStore } = useStores();
  return useCallback(() => readUnreadCount(notificationStore), [notificationStore]);
};

/**
 * Reads the badge once on sign-in. Mount it once, under the signed-in
 * navigator — leaving it (signing out) clears the count.
 */
export const useUnreadNotificationsSync = () => {
  const { notificationStore } = useStores();
  const refresh = useRefreshUnreadNotifications();

  useEffect(() => {
    refresh();
    return () => endUnreadSession(notificationStore);
  }, [refresh, notificationStore]);
};
