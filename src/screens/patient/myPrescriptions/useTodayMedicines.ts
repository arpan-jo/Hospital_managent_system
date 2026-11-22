import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_SLOT_TIMES,
  MEDICINE_SLOTS,
  MedicineSlot,
  MedicineSlotTimes,
  TodayMedicine,
  TodayMedicinesRepository,
  medicineDoseKey,
  onTakenLogChange,
  readTakenLog,
  serverMessageOf,
  setMedicineReminderTimes,
  slotsOfFrequency,
  takenLogDay,
  toggleTakenDose,
  useStores,
} from '@app/core';

export const doseKey = (prescriptionId: number, slot: MedicineSlot) =>
  medicineDoseKey(prescriptionId, slot);

/** As the portal's query: the list is read again once it is older than this. */
const STALE_MS = 5 * 60 * 1000;

const sameTimes = (a?: MedicineSlotTimes, b?: MedicineSlotTimes) =>
  MEDICINE_SLOTS.every(slot => a?.[slot] === b?.[slot]);

const toMinutes = (hhmm: string) => {
  const [h, m] = String(hhmm ?? '').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/**
 * Today's Medicines, as the portal's panel works: the day's doses grouped by
 * slot, ticked off on the phone, and the reminder time of each slot kept on
 * the server. A failed first read shows the empty panel, as there.
 *
 * Back on screen, or back in the app, it reads the ticks again (the other
 * panel may have ticked since) and, once the list is five minutes old or the
 * day has turned, the list and the times as well — quietly, with no spinner.
 */
export const useTodayMedicines = (patientCode?: string | null) => {
  const { t } = useTranslation();
  const { toastStore } = useStores();

  const [medicines, setMedicines] = useState<TodayMedicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [log, setLog] = useState<Record<string, boolean>>(() => readTakenLog());
  const [slotTimes, setSlotTimes] = useState<MedicineSlotTimes>(DEFAULT_SLOT_TIMES);
  const [draftTimes, setDraftTimes] = useState<MedicineSlotTimes>(DEFAULT_SLOT_TIMES);
  const [isScheduling, setIsScheduling] = useState(false);

  const mountedRef = useRef(true);
  /** Only the latest read of the list may land. */
  const readIdRef = useRef(0);
  /** When the list was last asked for, and on which day — null when that read failed. */
  const fetchedRef = useRef<{ at: number; day: string } | null>(null);
  const focusedRef = useRef(false);
  /** The saved times, for telling an untouched draft from one being edited. */
  const savedTimesRef = useRef<MedicineSlotTimes>(DEFAULT_SLOT_TIMES);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadMedicines = useCallback(
    async (withSpinner: boolean) => {
      const readId = ++readIdRef.current;
      const isLatest = () => mountedRef.current && readId === readIdRef.current;
      fetchedRef.current = { at: Date.now(), day: takenLogDay() };
      if (withSpinner) setIsLoading(true);
      try {
        const response = await TodayMedicinesRepository?.getTodayMedicines?.(patientCode);
        if (isLatest()) setMedicines(Array.isArray(response) ? response : []);
      } catch (error: any) {
        console.log('getTodayMedicines error ==>', error?.message);
        if (isLatest()) {
          // Read again next time round. A quiet refresh that fails keeps the
          // list on screen, as the portal does; a first read shows the empty panel.
          fetchedRef.current = null;
          if (withSpinner) setMedicines([]);
        }
      } finally {
        if (isLatest()) setIsLoading(false);
      }
    },
    [patientCode],
  );

  /** The saved times in place. A draft the patient has not touched follows them. */
  const applySavedTimes = useCallback((times: MedicineSlotTimes) => {
    const before = savedTimesRef.current;
    savedTimesRef.current = times;
    setSlotTimes(times);
    setDraftTimes(prev => (sameTimes(prev, before) ? times : prev));
  }, []);

  // The saved reminder times; the defaults stand when there are none.
  const loadSchedule = useCallback(async () => {
    try {
      const times = await TodayMedicinesRepository?.getSchedule?.();
      if (mountedRef.current && times) applySavedTimes(times);
    } catch (error: any) {
      console.log('getMedicineSchedule error ==>', error?.message);
    }
  }, [applySavedTimes]);

  // The day's list, and again for another family member.
  useEffect(() => {
    loadMedicines(true);
  }, [loadMedicines]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  /** Today's ticks again, and the list and times too once stale or the day has turned. */
  const refresh = useCallback(() => {
    setLog(readTakenLog());
    const fetched = fetchedRef.current;
    const isStale =
      !fetched || fetched.day !== takenLogDay() || Date.now() - fetched.at >= STALE_MS;
    if (isStale) {
      loadMedicines(false);
      loadSchedule();
    }
  }, [loadMedicines, loadSchedule]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      refresh();
      return () => {
        focusedRef.current = false;
      };
    }, [refresh]),
  );

  // Back in the app (unlocking the phone included): only the panel on screen reads again.
  useEffect(() => {
    const subscription = AppState?.addEventListener?.('change', state => {
      if (state === 'active' && focusedRef.current) refresh();
    });
    return () => subscription?.remove?.();
  }, [refresh]);

  const toggleTaken = useCallback((prescriptionId: number, slot: MedicineSlot) => {
    setLog(toggleTakenDose(doseKey(prescriptionId, slot)));
  }, []);

  // A tick made anywhere else shows here at once: the other panel, or "Taken"
  // on a medicine reminder pressed while the app is open.
  useEffect(
    () =>
      onTakenLogChange?.(() => {
        if (mountedRef.current) setLog(readTakenLog());
      }),
    [],
  );

  const groups = useMemo(
    () =>
      MEDICINE_SLOTS.map(slot => ({
        slot,
        medicines: (medicines ?? []).filter(item =>
          slotsOfFrequency(item?.frequency)?.includes?.(slot),
        ),
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
        if (mountedRef.current) {
          savedTimesRef.current = times;
          setSlotTimes(times);
          setDraftTimes(times);
        }
        // The medicine reminders move to the new times.
        setMedicineReminderTimes?.(times);
        toastStore.show(t(successKey), 'success');
        return true;
      } catch (error: any) {
        console.log('saveMedicineSchedule error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t(failureKey), 'error');
        return false;
      } finally {
        if (mountedRef.current) setIsScheduling(false);
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
