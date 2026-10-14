import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_SLOT_TIMES,
  MEDICINE_SLOTS,
  MedicineSlot,
  MedicineSlotTimes,
  TodayMedicine,
  TodayMedicinesRepository,
  serverMessageOf,
  slotsOfFrequency,
  storage,
  toISODate,
  useStores,
} from '@app/core';

/** "Taken" ticks live on the phone only, one record per day — as the portal keeps them in the browser. */
const logKeyOfToday = () => `med-log-${toISODate(new Date())}`;

const readLog = (): Record<string, boolean> => {
  try {
    const raw = storage.getString(logKeyOfToday());
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
};

const writeLog = (log: Record<string, boolean>) => {
  try {
    storage.set(logKeyOfToday(), JSON.stringify(log));
  } catch {
    // A tick that could not be kept is only lost for the day.
  }
};

export const doseKey = (prescriptionId: number, slot: MedicineSlot) => `${prescriptionId}_${slot}`;

const toMinutes = (hhmm: string) => {
  const [h, m] = String(hhmm ?? '').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/**
 * Today's Medicines, as the portal's panel works: the day's doses grouped by
 * slot, ticked off on the phone, and the reminder time of each slot kept on
 * the server. A failed read shows the empty panel, as there.
 */
export const useTodayMedicines = (patientCode?: string | null) => {
  const { t } = useTranslation();
  const { toastStore } = useStores();

  const [medicines, setMedicines] = useState<TodayMedicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [log, setLog] = useState<Record<string, boolean>>(readLog);
  const [slotTimes, setSlotTimes] = useState<MedicineSlotTimes>(DEFAULT_SLOT_TIMES);
  const [draftTimes, setDraftTimes] = useState<MedicineSlotTimes>(DEFAULT_SLOT_TIMES);
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    TodayMedicinesRepository.getTodayMedicines(patientCode)
      .then(response => {
        if (isCurrent) setMedicines(response ?? []);
      })
      .catch(error => {
        console.log('getTodayMedicines error ==>', error?.message);
        if (isCurrent) setMedicines([]);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [patientCode]);

  // The saved reminder times; the defaults stand when there are none.
  useEffect(() => {
    TodayMedicinesRepository.getSchedule()
      .then(times => {
        setSlotTimes(times);
        setDraftTimes(times);
      })
      .catch(error => console.log('getMedicineSchedule error ==>', error?.message));
  }, []);

  const toggleTaken = useCallback((prescriptionId: number, slot: MedicineSlot) => {
    setLog(prev => {
      const key = doseKey(prescriptionId, slot);
      const next = { ...prev, [key]: !prev?.[key] };
      writeLog(next);
      return next;
    });
  }, []);

  const groups = useMemo(
    () =>
      MEDICINE_SLOTS.map(slot => ({
        slot,
        medicines: medicines.filter(item => slotsOfFrequency(item?.frequency).includes(slot)),
      })).filter(group => group.medicines.length > 0),
    [medicines],
  );

  const totalDoses = groups.reduce((sum, group) => sum + group.medicines.length, 0);
  const takenDoses = groups.reduce(
    (sum, group) =>
      sum + group.medicines.filter(item => log?.[doseKey(item?.prescriptionId, group.slot)]).length,
    0,
  );

  const saveTimes = useCallback(
    async (times: MedicineSlotTimes, successKey: string, failureKey: string) => {
      setIsScheduling(true);
      try {
        await TodayMedicinesRepository.saveSchedule(times);
        setSlotTimes(times);
        setDraftTimes(times);
        toastStore.show(t(successKey), 'success');
        return true;
      } catch (error: any) {
        console.log('saveMedicineSchedule error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t(failureKey), 'error');
        return false;
      } finally {
        setIsScheduling(false);
      }
    },
    [toastStore, t],
  );

  const saveSchedule = useCallback(
    () => saveTimes(draftTimes, 'todayMedicines.scheduleSaved', 'todayMedicines.scheduleSaveFailed'),
    [saveTimes, draftTimes],
  );

  const resetSchedule = useCallback(() => {
    setDraftTimes(DEFAULT_SLOT_TIMES);
    return saveTimes(
      DEFAULT_SLOT_TIMES,
      'todayMedicines.scheduleReset',
      'todayMedicines.scheduleResetFailed',
    );
  }, [saveTimes]);

  /** Now / Past, as the portal marks a slot: half an hour before to an hour and a half after. */
  const slotState = useCallback(
    (slot: MedicineSlot): 'now' | 'past' | null => {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const at = toMinutes(slotTimes?.[slot]);
      if (nowMinutes >= at - 30 && nowMinutes < at + 90) return 'now';
      return nowMinutes > at + 30 ? 'past' : null;
    },
    [slotTimes],
  );

  return {
    medicines,
    isLoading,
    groups,
    log,
    toggleTaken,
    totalDoses,
    takenDoses,
    slotTimes,
    draftTimes,
    setDraftTime: (slot: MedicineSlot, hhmm: string) =>
      setDraftTimes(prev => ({ ...prev, [slot]: hhmm })),
    isScheduling,
    saveSchedule,
    resetSchedule,
    slotState,
  };
};

export default useTodayMedicines;
