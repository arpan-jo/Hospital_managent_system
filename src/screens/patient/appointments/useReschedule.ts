import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppointmentBookingRepository,
  AppointmentDetail,
  AppointmentRepository,
  AvailableSlot,
  serverMessageOf,
  toISODate,
  useStores,
} from '@app/core';

/** How many days from today the strip of dates offers; the calendar reaches further. */
export const RESCHEDULE_DAYS = 14;

/**
 * A window with no place left — the portal's Reschedule rule
 * (`availableSlots <= 0`). Unlike the booking page it caps a window with no
 * capacity too: the server answers "fully booked" for one, so it is never offered.
 */
export const isSlotFull = (slot?: AvailableSlot | null): boolean =>
  Boolean(slot) && (slot?.availableSlots ?? 0) <= 0;

/** Today, or the appointment's own day when that is still ahead — where the picker opens. */
export const startDateFor = (detail?: AppointmentDetail | null, today = toISODate(new Date())): string => {
  const own = String(detail?.date ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(own) && own >= today ? own : today;
};

/**
 * Moving one pending appointment, as the portal's Reschedule sheet does: a
 * date, one of that day's windows from the booking desk's slot lookup, and,
 * when the window has them, a time inside it — "Auto" leaves that to the server.
 */
export const useReschedule = (
  detail: AppointmentDetail | null,
  visible: boolean,
  onDone: (updated: AppointmentDetail | null) => void,
) => {
  const { t } = useTranslation();
  const { toastStore } = useStores();
  const [date, setDate] = useState(() => startDateFor(detail));
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [time, setTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isMountedRef = useRef(true);
  /** Bumped by every read, so an older day's windows never land over a newer one's. */
  const requestRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Each opening starts afresh, from the appointment as it stands.
  useEffect(() => {
    if (!visible) return;
    setDate(startDateFor(detail));
    setSlotId(null);
    setTime('');
  }, [visible, detail]);

  const loadSlots = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!visible || !detail?.doctorEmployeeId || !date) return;
    setIsSlotsLoading(true);
    setSlotsError(null);
    try {
      const response = await AppointmentBookingRepository.getAvailableSlots({
        employeeId: detail.doctorEmployeeId,
        accountId: detail?.accountId ?? 0,
        branchId: detail?.branchId ?? 0,
        appointmentDate: date,
        patientRegistrationId: detail?.patientRegistrationId ?? 0,
      });
      if (!isMountedRef.current || requestId !== requestRef.current) return;
      setSlots(response ?? []);
    } catch (e: any) {
      if (!isMountedRef.current || requestId !== requestRef.current) return;
      console.log('getAvailableSlots (reschedule) error ==>', e?.message);
      setSlots([]);
      setSlotsError(serverMessageOf(e));
    } finally {
      if (isMountedRef.current && requestId === requestRef.current) setIsSlotsLoading(false);
    }
  }, [visible, detail, date]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const pickDate = useCallback((next: string) => {
    setDate(next);
    setSlotId(null);
    setTime('');
  }, []);

  const pickSlot = useCallback((slot: AvailableSlot) => {
    if (!slot?.slotId || isSlotFull(slot)) return;
    setSlotId(slot.slotId);
    setTime('');
  }, []);

  const selectedSlot = useMemo(() => slots.find(slot => slot?.slotId === slotId) ?? null, [slots, slotId]);

  /** True once moved; the caller closes the sheet then. */
  const submit = useCallback(async (): Promise<boolean> => {
    if (!detail?.id || !slotId || isSaving) return false;
    setIsSaving(true);
    try {
      const updated = await AppointmentRepository.rescheduleAppointment({
        appointmentId: detail.id,
        appointmentDate: date,
        slotId,
        time,
      });
      // The backend answers with the appointment and no words of its own.
      toastStore.show(t('reschedule.done'), 'success');
      onDone(updated);
      return true;
    } catch (e: any) {
      console.log('rescheduleAppointment error ==>', e?.message);
      toastStore.show(serverMessageOf(e) || t('common.somethingWentWrong'), 'error');
      // A window may have filled meanwhile — show the day as it is now.
      loadSlots();
      return false;
    } finally {
      if (isMountedRef.current) setIsSaving(false);
    }
  }, [detail?.id, slotId, isSaving, date, time, toastStore, t, onDone, loadSlots]);

  return {
    date,
    pickDate,
    slots,
    isSlotsLoading,
    slotsError,
    retrySlots: loadSlots,
    slotId,
    selectedSlot,
    pickSlot,
    time,
    setTime,
    isSaving,
    canSubmit: !!slotId && !isSaving,
    submit,
  };
};

export type RescheduleViewModel = ReturnType<typeof useReschedule>;
