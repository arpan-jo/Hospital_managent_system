import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  AppointmentRepository,
  AppointmentStatus,
  AppointmentSummary,
  serverMessageOf,
} from '@app/core';

export type AppointmentTab = 'upcoming' | 'completed' | 'cancelled' | 'absent';

export const APPOINTMENT_TABS: AppointmentTab[] = ['upcoming', 'completed', 'cancelled', 'absent'];

/** The portal's grouping — by status alone: pending and confirmed are both still to come. */
export const tabOfStatus = (status: AppointmentStatus): AppointmentTab => {
  if (status === 'pending' || status === 'confirmed') return 'upcoming';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'absent';
};

const EMPTY_COUNTS: Record<AppointmentTab, number> = {
  upcoming: 0,
  completed: 0,
  cancelled: 0,
  absent: 0,
};

/**
 * My Appointments, as the portal lists them: every booking, newest first,
 * split into Upcoming / Completed / Cancelled / Absent by status. Read again
 * each time the screen comes into view, so a booking or a cancel made
 * elsewhere shows at once.
 */
export const useAppointmentsViewModel = () => {
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Null once read; otherwise the server's words, '' when it sent none. */
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppointmentTab>('upcoming');

  const load = useCallback(async (mode: 'initial' | 'quiet' | 'refresh' = 'initial') => {
    if (mode === 'initial') setIsLoading(true);
    if (mode === 'refresh') setIsRefreshing(true);
    try {
      const response = await AppointmentRepository.getAppointments();
      setAppointments(response ?? []);
      setError(null);
    } catch (e: any) {
      console.log('getAppointments error ==>', e?.message);
      // A quiet re-read that fails keeps what is already on screen.
      if (mode !== 'quiet') {
        setAppointments([]);
        setError(serverMessageOf(e));
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // The first visit shows a loader; coming back re-reads behind what is shown.
  const hasLoadedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      load(hasLoadedRef.current ? 'quiet' : 'initial');
      hasLoadedRef.current = true;
    }, [load]),
  );

  const counts = useMemo(
    () =>
      appointments?.reduce(
        (acc, item) => {
          const tab = tabOfStatus(item?.status);
          acc[tab] = (acc[tab] ?? 0) + 1;
          return acc;
        },
        { ...EMPTY_COUNTS },
      ) ?? EMPTY_COUNTS,
    [appointments],
  );

  const visible = useMemo(
    () => appointments?.filter(item => tabOfStatus(item?.status) === activeTab) ?? [],
    [appointments, activeTab],
  );

  return {
    appointments: visible,
    total: appointments?.length ?? 0,
    counts,
    activeTab,
    setActiveTab,
    isLoading,
    isRefreshing,
    error,
    retry: () => load('initial'),
    refresh: () => load('refresh'),
  };
};

export default useAppointmentsViewModel;
