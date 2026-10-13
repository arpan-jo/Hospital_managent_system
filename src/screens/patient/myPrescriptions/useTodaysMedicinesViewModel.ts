import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_REMINDER_SCHEDULE,
  DoseSlot,
  DOSE_SLOTS,
  PatientPrescriptionRepository,
  ReminderSchedule,
  TodayMedicine,
} from '@app/core';
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';

/** A dose due today, as one card inside a slot tab. */
export type MedicineDose = TodayMedicine;

/** Doses are tracked per medicine *and* slot — the same pill twice a day is two doses. */
export const doseKey = (medicineId: string, slot: DoseSlot): string => `${medicineId}:${slot}`;

/** 'HH:mm' -> minutes since midnight. Unparseable input sorts last. */
const toMinutes = (time: string): number => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? '');
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
};

/** The slot the user is most likely looking for: the last one whose time has passed. */
const currentSlot = (schedule: ReminderSchedule): DoseSlot => {
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const passed = DOSE_SLOTS.filter(slot => toMinutes(schedule?.[slot] ?? '') <= minutesNow);
  return passed.length > 0 ? passed[passed.length - 1] : DOSE_SLOTS[0];
};

const EMPTY_DOSES: RequestState<MedicineDose[]> = {
  isLoading: false,
  data: [],
  error: null,
};

export const useTodaysMedicinesViewModel = () => {
  const [dosesRequest, setDosesRequest] = useState<RequestState<MedicineDose[]>>(EMPTY_DOSES);
  const [schedule, setSchedule] = useState<ReminderSchedule>(DEFAULT_REMINDER_SCHEDULE);
  const [activeSlot, setActiveSlot] = useState<DoseSlot>(DOSE_SLOTS[0]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [takenKeys, setTakenKeys] = useState<string[]>([]);
  const [isScheduleVisible, setScheduleVisible] = useState(false);

  const fetchDoses = useCallback(async () => {
    setDosesRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // No patient code: the account's whole family is due on the same screen.
      const response = await PatientPrescriptionRepository.getTodaysMedicines();
      setDosesRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('getTodaysMedicines error ==>', error?.message);
      setDosesRequest({ isLoading: false, data: [], error: error?.message ?? null });
    }
  }, []);

  /** The saved times also decide which tab opens first. */
  const fetchSchedule = useCallback(async () => {
    try {
      const response = await PatientPrescriptionRepository.getReminderSchedule();
      setSchedule(response ?? DEFAULT_REMINDER_SCHEDULE);
      setActiveSlot(currentSlot(response ?? DEFAULT_REMINDER_SCHEDULE));
    } catch (error: any) {
      console.log('getReminderSchedule error ==>', error?.message);
    }
  }, []);

  useEffect(() => {
    fetchDoses();
    fetchSchedule();
  }, [fetchDoses, fetchSchedule]);

  const doses = useMemo(() => dosesRequest?.data ?? [], [dosesRequest]);

  const countsBySlot = useMemo(
    () =>
      DOSE_SLOTS.reduce(
        (acc, slot) => ({
          ...acc,
          [slot]: doses.filter(dose => dose?.slots?.includes(slot)).length,
        }),
        {} as Record<DoseSlot, number>,
      ),
    [doses],
  );

  const visibleDoses = useMemo(
    () => doses.filter(dose => dose?.slots?.includes(activeSlot)),
    [doses, activeSlot],
  );

  /** Every dose scheduled across the whole day, not just the open tab. */
  const totalDoses = useMemo(
    () => doses.reduce((total, dose) => total + (dose?.slots?.length ?? 0), 0),
    [doses],
  );

  const takenCount = takenKeys.length;

  const isTaken = useCallback(
    (medicineId: string, slot: DoseSlot) => takenKeys.includes(doseKey(medicineId, slot)),
    [takenKeys],
  );

  /** Local only — the backend has no "mark as taken" endpoint yet. */
  const toggleTaken = useCallback((medicineId: string, slot: DoseSlot) => {
    const key = doseKey(medicineId, slot);
    setTakenKeys(prev =>
      prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key],
    );
  }, []);

  const openSchedule = useCallback(() => setScheduleVisible(true), []);
  const closeSchedule = useCallback(() => setScheduleVisible(false), []);

  const saveSchedule = useCallback(async (next: ReminderSchedule) => {
    try {
      const saved = await PatientPrescriptionRepository.saveReminderSchedule(next);
      setSchedule(saved ?? next);
    } catch (error: any) {
      console.log('saveReminderSchedule error ==>', error?.message);
    } finally {
      setScheduleVisible(false);
    }
  }, []);

  return {
    doses: visibleDoses,
    countsBySlot,
    totalDoses,
    takenCount,
    isLoading: dosesRequest?.isLoading ?? false,
    refresh: fetchDoses,
    activeSlot,
    setActiveSlot,
    alertsEnabled,
    setAlertsEnabled,
    isTaken,
    toggleTaken,
    schedule,
    isScheduleVisible,
    openSchedule,
    closeSchedule,
    saveSchedule,
  };
};

export default useTodaysMedicinesViewModel;
