import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  nextAlarmTime,
  openAlarmPermissionSettings,
  requestAlarmPermission,
  scheduleAlarm,
  useStores,
} from '@app/core';

const formatAlarmTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * Sets the patient's one-off alarm: asks for what the phone needs first, and
 * on a missing permission sends them to the setting that grants it.
 */
export const useAlarmSheetViewModel = () => {
  const { t } = useTranslation();
  const { toastStore } = useStores();
  const [isSaving, setIsSaving] = useState(false);

  /** True once the alarm is set. */
  const save = useCallback(
    async (time: Date, message: string): Promise<boolean> => {
      setIsSaving(true);
      try {
        const permission = await requestAlarmPermission();
        if (permission !== 'granted') {
          toastStore.show(t(`alarm.${permission}`), 'error', 5000);
          await openAlarmPermissionSettings(permission);
          return false;
        }

        const at = nextAlarmTime(time);
        await scheduleAlarm({
          at,
          message,
          stopLabel: t('alarm.stop'),
          channelName: t('alarm.channelName'),
        });

        const isToday = at.toDateString() === new Date().toDateString();
        toastStore.show(
          t(isToday ? 'alarm.setToday' : 'alarm.setTomorrow', {
            time: formatAlarmTime(at),
          }),
          'success',
        );
        return true;
      } catch (error: any) {
        console.log('scheduleAlarm error ==>', error?.message);
        toastStore.show(t('alarm.failed'), 'error');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [t, toastStore],
  );

  return { save, isSaving };
};

export default useAlarmSheetViewModel;
