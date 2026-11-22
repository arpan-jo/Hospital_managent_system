import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  TodayMedicinesRepository,
  claimMedicineReminders,
  onTakenLogChange,
  rebuildMedicineReminders,
  setMedicineReminderSource,
} from '@app/core';

/** Back in the app, the list is read again at most this often. */
const READ_EVERY_MS = 10 * 60 * 1000;

let lastReadAt = 0;

/**
 * Reads the account's medicines (everyone's: the patient's and the family's)
 * and the reminder times from the server, and sets the reminders from them.
 * A read that fails, or a session already over, leaves the reminders set from
 * the last list that came. Never throws.
 */
const readAndSet = async (userId: number, force: boolean) => {
  if (!force && Date.now() - lastReadAt < READ_EVERY_MS) return;
  lastReadAt = Date.now();
  try {
    const [medicines, times] = await Promise.all([
      TodayMedicinesRepository.getTodayMedicines(null),
      TodayMedicinesRepository.getSchedule(),
    ]);
    await setMedicineReminderSource?.({ userId, medicines, times });
  } catch (error: any) {
    console.log('medicine reminders read error ==>', error?.message);
    // Try again next time back in the app.
    lastReadAt = 0;
    await rebuildMedicineReminders?.();
  }
};

/**
 * Keeps the medicine reminders in step with the account, from the top of the
 * app:
 *   - signed in: claimed for the account and read from the server;
 *   - back in the app while signed in: read again (every ten minutes at most);
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
    readAndSet(userId, true);
  }, [signedIn, userId]);

  useEffect(() => {
    const subscription = AppState?.addEventListener?.('change', state => {
      const current = signedInRef.current;
      if (state === 'active' && current?.signedIn) readAndSet(current.userId, false);
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
