import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  MESSAGE_MAX_LENGTH,
  MessageRepository,
  PortalMessageThread,
  serverMessageOf,
  useStores,
} from '@app/core';
import { onMessageReceived } from '../../../hooks/useMessageHub';
import { useRefreshUnreadMessages } from '../../../hooks/useUnreadMessages';

/** As often as the portal's conversation — a reply lands while the patient waits on it. */
export const THREAD_POLL_MS = 15_000;

/** The doctor's messages in a thread — a new one means the badge has something to drop. */
const doctorMessages = (thread: PortalMessageThread | null): number =>
  (thread?.messages ?? []).filter(message => message?.senderType === 'doctor').length;

/**
 * One conversation, as the portal's thread view runs it: read when it opens
 * (which marks the doctor's messages read) and every 15 s while it stays open
 * and the app is in front; a message is sent, then the conversation is read
 * again. Opening it — and each reply that lands — sets the menu's badge afresh.
 */
export const useMessageThread = (patientRegistrationId: number, doctorEmployeeId: number) => {
  const { t } = useTranslation();
  const { toastStore } = useStores();
  const refreshBadge = useRefreshUnreadMessages();
  const regId = Number(patientRegistrationId ?? 0) || 0;
  const doctorId = Number(doctorEmployeeId ?? 0) || 0;

  const [thread, setThread] = useState<PortalMessageThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** Null once read; the server's words ('' for none) while nothing could be read. */
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const isMountedRef = useRef(true);
  const readRef = useRef(0);
  const threadRef = useRef<PortalMessageThread | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!regId || !doctorId) {
      setIsLoading(false);
      setError('');
      return;
    }
    const read = ++readRef.current;
    try {
      const response = await MessageRepository.getThread(regId, doctorId);
      if (!isMountedRef.current || read !== readRef.current) return;
      const before = threadRef.current;
      threadRef.current = response;
      setThread(response);
      setError(null);
      // The read marked the doctor's messages read: the badge drops by what was new.
      if (!before || doctorMessages(response) > doctorMessages(before)) refreshBadge();
    } catch (e: any) {
      if (!isMountedRef.current || read !== readRef.current) return;
      console.log('getThread error ==>', e?.message);
      // Over a conversation already shown, a failed re-read changes nothing.
      if (!threadRef.current) setError(serverMessageOf(e));
    } finally {
      if (isMountedRef.current && read === readRef.current) setIsLoading(false);
    }
  }, [regId, doctorId, refreshBadge]);

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null;
      const start = () => {
        if (timer) return;
        timer = setInterval(() => {
          load();
        }, THREAD_POLL_MS);
      };
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };

      load();
      if (AppState?.currentState === 'active') start();
      // A doctor's reply pushed over the hub: read again at once, not at the next tick.
      const stopListening = onMessageReceived(() => {
        load();
      });
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
        stopListening?.();
        subscription?.remove?.();
      };
    }, [load]),
  );

  /** True once sent; the caller clears its box then. */
  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const message = String(text ?? '').trim();
      if (!message || message.length > MESSAGE_MAX_LENGTH || !regId || !doctorId || isSending) return false;
      setIsSending(true);
      try {
        const sent = await MessageRepository.send({
          patientRegistrationId: regId,
          doctorEmployeeId: doctorId,
          message,
        });
        if (isMountedRef.current && sent?.messageId) {
          // Shown at once; the read that follows brings the conversation as the server holds it.
          setThread(previous => {
            const next = previous
              ? { ...previous, messages: [...(previous.messages ?? []), sent] }
              : previous;
            threadRef.current = next;
            return next;
          });
        }
        load();
        return true;
      } catch (e: any) {
        console.log('sendMessage error ==>', e?.message);
        toastStore.show(serverMessageOf(e) || t('common.somethingWentWrong'), 'error');
        return false;
      } finally {
        if (isMountedRef.current) setIsSending(false);
      }
    },
    [regId, doctorId, isSending, load, toastStore, t],
  );

  return {
    thread,
    isLoading,
    error,
    retry: () => {
      setIsLoading(true);
      return load();
    },
    isSending,
    send,
  };
};

export type MessageThreadViewModel = ReturnType<typeof useMessageThread>;
