import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppointmentRepository, TodayQueueEntry } from '@app/core';

/** As often as the portal's queue card — the board moves as the doctor calls patients in. */
export const QUEUE_POLL_MS = 20_000;

/** Seen, missed or called off: nothing left to wait for. */
const FINISHED = ['completed', 'no_show', 'cancelled'];

/** The ones still waiting today — what the queue card shows. */
export const waitingToday = (entries?: TodayQueueEntry[] | null): TodayQueueEntry[] =>
  (entries ?? []).filter(entry => !FINISHED.includes(entry?.status ?? ''));

/**
 * Today's queue for the patient's own appointments — read when the screen comes
 * into view, then every 20 s while it stays in view and the app is open; never
 * in the background. A failed read keeps the last rows; the next one tries again.
 */
export const useTodayQueue = () => {
  const [entries, setEntries] = useState<TodayQueueEntry[]>([]);
  // Refs, not state: a timer tick and a pull-to-refresh can meet mid-read.
  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const load = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      const rows = await AppointmentRepository.getTodayQueue();
      if (isMountedRef.current) setEntries(waitingToday(rows));
    } catch (error: any) {
      console.log('getTodayQueue error ==>', error?.message);
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null;
      const start = () => {
        if (timer) return;
        timer = setInterval(() => {
          load();
        }, QUEUE_POLL_MS);
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

  return { entries, refresh: load };
};

export default useTodayQueue;
