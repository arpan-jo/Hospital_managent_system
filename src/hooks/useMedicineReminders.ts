import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  TodayMedicinesRepository,
  claimMedicineReminders,
  onTakenLogChange,
  rebuildMedicineReminders,
  setMedicineReminderSource,
  setMedicineReminderTimes,
} from '@app/core';

/** Back in the app, the list is read again at most this often. */
const READ_EVERY_MS = 10 * 60 * 1000;

let lastReadAt = 0;

/** A clock set back counts as due too, so the reads never wait for it to catch up. */
const readIsDue = () => {
  const since = Date.now() - lastReadAt;
  return since < 0 || since >= READ_EVERY_MS;
};

/**
 * Reads the account's medicines (everyone's: the patient's and the family's)
 * and the reminder times from the server, and sets the reminders from them.
 * The two reads stand apart: when one fails, what the other brought is still
 * used, and the phone keeps the rest from the last read (the times, or the
 * list). After any failure it reads again next time back in the app. Never
 * throws.
 */
const readAndSet = async (userId: number) => {
  lastReadAt = Date.now();
  try {
    const [medicines, times] = await Promise.allSettled([
      TodayMedicinesRepository.getTodayMedicines(null),
      TodayMedicinesRepository.getSchedule(),
    ]);
    const timesRead = times?.status === 'fulfilled' ? times.value : null;
    if (medicines?.status === 'fulfilled') {
      await setMedicineReminderSource?.({ userId, medicines: medicines.value, times: timesRead });
    } else if (timesRead) {
      await setMedicineReminderTimes?.(timesRead, userId);
    } else {
      await rebuildMedicineReminders?.();
    }
    if (medicines?.status === 'rejected' || times?.status === 'rejected') {
      const reason =
        medicines?.status === 'rejected' ? medicines.reason : times?.status === 'rejected' ? times.reason : null;
      console.log('medicine reminders read error ==>', reason?.message);
      lastReadAt = 0;
    }
  } catch (error: any) {
    console.log('medicine reminders read error ==>', error?.message);
    lastReadAt = 0;
    await rebuildMedicineReminders?.();
  }
};

/**
 * Keeps the medicine reminders in step with the account, from the top of the
 * app:
 *   - signed in: claimed for the account and read from the server;
 *   - back in the app while signed in: read again (every ten minutes at most);
 *   - back in the app otherwise, or between those reads, and on a launch
 *     with no session: set again from what the phone holds, so an alarm or
 *     notification permission just allowed in Settings counts at once, and
 *     the seven days ahead move on, a session over too;
 *   - a dose ticked (in the app, or with "Taken" while it is open): set again;
 *   - the app's language changed: set again, so they speak it.
 * Logout is handled in useSignOut.
 */
export const useMedicineReminders = (isAuthenticated: boolean, userId: number) => {
  const { i18n } = useTranslation();
  const signedIn = Boolean(isAuthenticated) && userId > 0;

  const signedInRef = useRef({ signedIn, userId });
  useEffect(() => {
    signedInRef.current = { signedIn, userId };
  }, [signedIn, userId]);

  useEffect(() => {
    if (!signedIn) return;
    claimMedicineReminders?.(userId);
    readAndSet(userId);
  }, [signedIn, userId]);

  // A launch with no session: nothing above runs, so set them from the phone.
  useEffect(() => {
    if (!signedInRef.current?.signedIn) rebuildMedicineReminders?.();
  }, []);

  useEffect(() => {
    const subscription = AppState?.addEventListener?.('change', state => {
      if (state !== 'active') return;
      const current = signedInRef.current;
      if (current?.signedIn && readIsDue()) {
        readAndSet(current.userId);
        return;
      }
      rebuildMedicineReminders?.();
    });
    return () => subscription?.remove?.();
  }, []);

  useEffect(
    () =>
      onTakenLogChange?.(() => {
        rebuildMedicineReminders?.();
      }),
    [],
  );

  // Not on the first render: the sign-in read above sets them then.
  const language = i18n?.language;
  const languageRef = useRef(language);
  useEffect(() => {
    if (languageRef.current === language) return;
    languageRef.current = language;
    rebuildMedicineReminders?.();
  }, [language]);
};

export default useMedicineReminders;
