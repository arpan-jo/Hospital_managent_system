import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MessageRepository, PortalMessageThread, serverMessageOf, useStores } from '@app/core';
import { applyUnreadMessages, unreadMessagesSession } from '../../../hooks/useUnreadMessages';

/** As often as the portal's list — a doctor's reply shows up without a pull. */
export const THREADS_POLL_MS = 30_000;

/**
 * Every conversation on the account, latest first, as the portal's Messages
 * page reads them — again whenever the screen comes into view and every 30 s
 * while it stays open and the app is in front. Each read also sets the menu's
 * unread badge. A failed re-read keeps what is shown.
 */
export const useMessageThreads = () => {
  const { notificationStore } = useStores();
  const [threads, setThreads] = useState<PortalMessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Null once read; the server's words ('' for none) while nothing could be read. */
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const readRef = useRef(0);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (pulled = false) => {
      const read = ++readRef.current;
      const session = unreadMessagesSession();
      if (pulled) setIsRefreshing(true);
      else if (!hasLoadedRef.current) setIsLoading(true);
      try {
        const rows = await MessageRepository.getThreads();
        if (!isMountedRef.current || read !== readRef.current) return;
        setThreads(rows ?? []);
        setError(null);
        hasLoadedRef.current = true;
        applyUnreadMessages(notificationStore, rows, session);
      } catch (e: any) {
        if (!isMountedRef.current || read !== readRef.current) return;
        console.log('getThreads error ==>', e?.message);
        // Over a list already shown, a failed re-read changes nothing.
        if (!hasLoadedRef.current) setError(serverMessageOf(e));
      } finally {
        if (isMountedRef.current && read === readRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [notificationStore],
  );

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null;
      const start = () => {
        if (timer) return;
        timer = setInterval(() => {
          load();
        }, THREADS_POLL_MS);
      };
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };

      load();
      if (AppState?.currentState === 'active') start();
      const subscription = AppState?.addEventListener?.('change', state => {
        if (state === 'active') {
          load();
          start();
        } else {
          stop();
        }
      });

      return () => {
        stop();
        subscription?.remove?.();
      };
    }, [load]),
  );

  return {
    threads,
    isLoading,
    isRefreshing,
    error,
    refresh: () => load(true),
    retry: () => {
      hasLoadedRef.current = false;
      return load();
    },
  };
};

export type MessageThreadsViewModel = ReturnType<typeof useMessageThreads>;
