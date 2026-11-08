import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import {
  INotificationStore,
  MessageRepository,
  PortalMessageThread,
  unreadMessagesOf,
  useStores,
} from '@app/core';

/** How often the Messages badge is re-read while the app is open — as often as the portal's menu. */
export const UNREAD_MESSAGES_POLL_MS = 60_000;

/** Bumped on sign-out, so a read that left before it does not land on the next account's badge. */
let session = 0;
/** One read at a time per signed-in account; a call made meanwhile shares it. */
let inFlight: { session: number; read: Promise<void> } | null = null;

/** The sign-in a count belongs to; a count read under an older one is dropped. */
export const unreadMessagesSession = (): number => session;

/**
 * Sets the badge from threads a screen has just read — the Messages list and
 * the home screen read them anyway, so the badge needs no second read. A list
 * read before a sign-out is ignored.
 */
export const applyUnreadMessages = (
  store: INotificationStore,
  threads: PortalMessageThread[] | null | undefined,
  readInSession: number,
): void => {
  if (readInSession === session) store.setUnreadMessages(unreadMessagesOf(threads));
};

export const readUnreadMessages = (store: INotificationStore): Promise<void> => {
  if (inFlight?.session === session) return inFlight.read;
  const entry: { session: number; read: Promise<void> } = { session, read: Promise.resolve() };
  inFlight = entry;
  entry.read = (async () => {
    try {
      const threads = await MessageRepository.getThreads();
      applyUnreadMessages(store, threads, entry.session);
    } catch (e: any) {
      // The badge keeps its last count; the next read tries again.
      console.log('getThreads (badge) error ==>', e?.message);
    } finally {
      if (inFlight === entry) inFlight = null;
    }
  })();
  return entry.read;
};

/** Signing out: whatever is still on its way belongs to the account that left. */
export const endUnreadMessagesSession = (store: INotificationStore): void => {
  session += 1;
  store.resetMessages();
};

/** Re-reads the Messages badge — after a thread is opened, its unread messages are read. */
export const useRefreshUnreadMessages = () => {
  const { notificationStore } = useStores();
  return useCallback(() => readUnreadMessages(notificationStore), [notificationStore]);
};

/**
 * Reads the Messages badge on sign-in, then every 60 s while the app is open,
 * and at once on coming back to it — never in the background. Mount it once,
 * under the signed-in navigator; leaving it (signing out) clears the count.
 */
export const useUnreadMessagesSync = () => {
  const { notificationStore } = useStores();
  const refresh = useRefreshUnreadMessages();

  useEffect(() => {
    refresh();
    return () => endUnreadMessagesSession(notificationStore);
  }, [refresh, notificationStore]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        refresh();
      }, UNREAD_MESSAGES_POLL_MS);
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
