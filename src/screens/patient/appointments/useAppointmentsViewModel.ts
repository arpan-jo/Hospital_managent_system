import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Appointment, AppointmentRepository, toISODate } from '@app/core';
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';

/** The four tabs on the list — not the same set as the API's five statuses. */
export type AppointmentTab = 'upcoming' | 'completed' | 'cancelled' | 'absent';

export const APPOINTMENT_TABS: AppointmentTab[] = [
  'upcoming',
  'completed',
  'cancelled',
  'absent',
];

/**
 * The tab an appointment belongs to. Status alone does not decide it: a pending
 * or confirmed row whose date has already gone by was never attended, so the
 * web counts it under "Absent" alongside `no_show` — only rows still dated today
 * or later stay in "Upcoming". The comparison is date-only, like the web, so
 * this morning's 9:00 slot keeps showing as upcoming for the rest of the day.
 */
export const getAppointmentTab = (
  appointment?: Appointment,
): AppointmentTab | null => {
  switch (appointment?.status) {
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'no_show':
      return 'absent';
    case 'pending':
    case 'confirmed': {
      const date = appointment?.date ?? '';
      // A blank date cannot be judged past, so it stays with the upcoming rows.
      return date && date < toISODate(new Date()) ? 'absent' : 'upcoming';
    }
    default:
      return null;
  }
};

const EMPTY_REQUEST: RequestState<Appointment[]> = {
  isLoading: false,
  data: [],
  error: null,
};

export const useAppointmentsViewModel = () => {
  const [appointmentsRequest, setAppointmentsRequest] =
    useState<RequestState<Appointment[]>>(EMPTY_REQUEST);
  const [activeTab, setActiveTab] = useState<AppointmentTab>('upcoming');

  const fetchAppointments = useCallback(async () => {
    setAppointmentsRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await AppointmentRepository.getAppointments();
      // console.log('appontment response app', JSON.stringify(response, null, 2));
      setAppointmentsRequest({
        isLoading: false,
        data: response ?? [],
        error: null,
      });
    } catch (error: any) {
      console.log('getAppointments error ==>', error?.message);
      setAppointmentsRequest({
        isLoading: false,
        data: [],
        error: error?.message ?? null,
      });
    }
  }, []);

  // Re-reads on focus so an appointment booked from the Home tab shows up when
  // the patient comes back here, without a pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      fetchAppointments();
    }, [fetchAppointments]),
  );

  const appointments = useMemo(
    () => appointmentsRequest?.data ?? [],
    [appointmentsRequest],
  );

  const counts = useMemo(
    () =>
      APPOINTMENT_TABS.reduce(
        (acc, tab) => ({
          ...acc,
          [tab]:
            appointments?.filter(item => getAppointmentTab(item) === tab)
              ?.length ?? 0,
        }),
        {} as Record<AppointmentTab, number>,
      ),
    [appointments],
  );

  const filteredAppointments = useMemo(
    () =>
      appointments?.filter(item => getAppointmentTab(item) === activeTab) ?? [],
    [appointments, activeTab],
  );

  return {
    appointments: filteredAppointments,
    counts,
    activeTab,
    setActiveTab,
    isLoading: appointmentsRequest?.isLoading ?? false,
    error: appointmentsRequest?.error ?? null,
    refetch: fetchAppointments,
  };
};

export default useAppointmentsViewModel;
