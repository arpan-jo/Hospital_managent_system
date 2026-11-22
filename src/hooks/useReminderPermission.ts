import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  ReminderPermissionState,
  openReminderSettings,
  readReminderPermission,
} from '@app/core';

const UNKNOWN: ReminderPermissionState = { notifications: 'unknown', onTime: 'n/a' };

/**
 * What stands between the reminders on `channelId` and the patient: the app's
 * notifications (or that channel) turned off, or Android 12+'s "Alarms &
 * reminders" not allowed. Read again whenever the screen comes back into view
 * or the patient comes back from the phone's settings, so a setting just turned
 * on clears its note. Never throws.
 */
export const useReminderPermission = (channelId?: string) => {
  const [state, setState] = useState<ReminderPermissionState>(UNKNOWN);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await readReminderPermission?.(channelId);
    if (mountedRef.current && next) setState(next);
  }, [channelId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const subscription = AppState?.addEventListener?.('change', next => {
      if (next === 'active') refresh();
    });
    return () => subscription?.remove?.();
  }, [refresh]);

  /** The settings page that turns notifications on: the channel's own when only it is off. */
  const openNotificationSettings = useCallback(
    () => openReminderSettings?.('notifications', state?.offAt === 'channel' ? channelId : undefined),
    [state?.offAt, channelId],
  );
  const openOnTimeSettings = useCallback(() => openReminderSettings?.('onTime'), []);

  return { state, openNotificationSettings, openOnTimeSettings };
};

export default useReminderPermission;
