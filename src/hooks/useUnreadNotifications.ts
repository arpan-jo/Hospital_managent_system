import { useCallback, useEffect } from 'react';
import { INotificationStore, NotificationRepository, useStores } from '@app/core';

/** One read at a time: a call made while one is on its way shares it. */
let inFlight: Promise<void> | null = null;
/** Bumped on sign-out, so a read that left before it does not land on the next account's badge. */
let session = 0;

const readUnreadCount = (store: INotificationStore): Promise<void> => {
  if (inFlight) return inFlight;
  const readSession = session;
  inFlight = (async () => {
    try {
      const count = await NotificationRepository.getUnreadCount();
      if (readSession === session) store.setUnreadCount(count);
    } catch (e: any) {
      // The badge keeps its last count; the next moment it is read tries again.
      console.log('getUnreadCount error ==>', e?.message);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
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
    return () => {
      session += 1;
      notificationStore.reset();
    };
  }, [refresh, notificationStore]);
};
