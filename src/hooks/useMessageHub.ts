import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { HubConnection } from '@microsoft/signalr';
import { MESSAGE_RECEIVED, createMessageHub, useStores } from '@app/core';
import { useRefreshUnreadMessages } from './useUnreadMessages';
import { useRefreshUnreadNotifications } from './useUnreadNotifications';

/**
 * When the hub cannot be reached, how long before it is tried afresh — a minute,
 * doubling each time up to ten, so a server without a working socket costs
 * almost nothing. Polling covers meanwhile.
 */
const RETRY_FIRST_MS = 60_000;
const RETRY_MAX_MS = 10 * 60_000;

type Listener = () => void;

/** The screens that read again when a doctor replies — the open conversation, the list. */
const listeners = new Set<Listener>();

/** Listen for a doctor's reply; answers the way to stop listening. */
export const onMessageReceived = (listener: Listener): (() => void) => {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = () => {
  listeners.forEach(listener => {
    try {
      listener?.();
    } catch (e: any) {
      console.log('message hub listener error ==>', e?.message);
    }
  });
};

/**
 * Keeps the portal's real-time message channel open while signed in, as the
 * portal does: when a doctor replies, the menu's badge, the bell, and any
 * message screen in view read again at once. Polling stays on underneath, so a
 * socket that cannot connect only costs a few seconds. Unlike a browser tab, a
 * phone closes the socket while the app is in the background and opens it again
 * on return — an open socket there would only spend the battery. Mount once,
 * under the signed-in navigator; leaving it (signing out) closes the socket.
 */
export const useMessageHub = () => {
  const { authStore } = useStores();
  const refreshBadge = useRefreshUnreadMessages();
  const refreshBell = useRefreshUnreadNotifications();
  // The latest callbacks, so the connection is not rebuilt when they change.
  const onReplyRef = useRef<() => void>(() => {});
  onReplyRef.current = () => {
    refreshBadge();
    refreshBell();
    notifyListeners();
  };

  useEffect(() => {
    let connection: HubConnection | null = null;
    let starting: Promise<void> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = RETRY_FIRST_MS;
    let disposed = false;

    const clearRetry = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
    };

    /** Another try later, while the app is still in front — each wait twice the last. */
    const scheduleRetry = () => {
      if (disposed || AppState?.currentState !== 'active') return;
      clearRetry();
      retryTimer = setTimeout(start, retryDelay);
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    };

    const start = () => {
      clearRetry();
      if (disposed || connection || !authStore?.authToken) return;
      const hub = createMessageHub(() => authStore?.authToken);
      if (!hub) return;
      hub.on(MESSAGE_RECEIVED, () => onReplyRef.current?.());
      // Reconnecting gave up: try again in a while.
      hub.onclose(() => {
        if (connection !== hub) return;
        connection = null;
        starting = null;
        scheduleRetry();
      });
      connection = hub;
      starting = hub
        .start()
        .then(() => {
          retryDelay = RETRY_FIRST_MS;
        })
        .catch((e: any) => {
          // Polling is the fallback; nothing to show. A start that failed never
          // closes, so it is let go here, or no later start would be made.
          console.log('message hub start error ==>', e?.message);
          if (connection === hub) {
            connection = null;
            starting = null;
            scheduleRetry();
          }
        });
    };

    const stop = () => {
      clearRetry();
      const hub = connection;
      const started = starting;
      connection = null;
      starting = null;
      if (!hub) return;
      // Stopped only once its start has settled — stopping mid-negotiation only logs an error.
      (started ?? Promise.resolve())
        .then(() => hub.stop())
        .catch(() => undefined);
    };

    if (AppState?.currentState === 'active') start();
    const subscription = AppState?.addEventListener?.('change', state => {
      if (state === 'active') start();
      else stop();
    });

    return () => {
      disposed = true;
      stop();
      subscription?.remove?.();
    };
  }, [authStore]);
};

export default useMessageHub;
