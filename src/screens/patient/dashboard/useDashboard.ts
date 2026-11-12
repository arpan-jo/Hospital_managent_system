import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  AppointmentRepository,
  AppointmentSummary,
  BillsRepository,
  FailureKind,
  LabTest,
  MedicalRecordRepository,
  MessageRepository,
  PortalBill,
  failureKindOf,
  toISODate,
  totalDueOf,
  useStores,
} from '@app/core';
import { applyUnreadMessages, unreadMessagesSession } from '../../../hooks/useUnreadMessages';
import { nextAppointmentOf, reportCountsOf } from './dashboardUi';

interface DashboardLists {
  appointments: AppointmentSummary[];
  pathology: LabTest[];
  radiology: LabTest[];
  bills: PortalBill[];
}

const EMPTY: DashboardLists = { appointments: [], pathology: [], radiology: [], bills: [] };

/** A list as read, or — when its read failed — the one already shown (nothing at first), as the portal keeps it. */
const settled = <T>(result: PromiseSettledResult<T[]>, previous: T[], label: string): T[] => {
  if (result.status === 'fulfilled') return result.value ?? [];
  console.log(`dashboard ${label} error ==>`, (result.reason as any)?.message);
  return previous ?? [];
};

/**
 * The home screen's figures, read as the portal's dashboard reads them: the
 * appointments, both kinds of tests, the bills and the message threads, side by
 * side. A list that fails counts as empty, as there — the rest still show.
 * Read again each time the screen comes into view, quietly, and on a pull.
 */
export const useDashboard = () => {
  const { notificationStore } = useStores();
  const [lists, setLists] = useState<DashboardLists>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Every read failed — the screen says why and offers a way on. */
  const [allFailed, setAllFailed] = useState(false);
  /**
   * Why they failed: an ended session (log out and sign in again) wins, then a
   * phone with no connection, else just a failure. Null while not all failed.
   */
  const [failure, setFailure] = useState<FailureKind | null>(null);
  const isMountedRef = useRef(true);
  /** Only the newest read may land. */
  const readRef = useRef(0);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (pulled = false) => {
      const read = ++readRef.current;
      const session = unreadMessagesSession();
      if (pulled) setIsRefreshing(true);
      else if (!hasLoadedRef.current) setIsLoading(true);

      const [appointments, pathology, radiology, bills, threads] = await Promise.allSettled([
        AppointmentRepository.getAppointments(),
        MedicalRecordRepository.getLabTests('pathology'),
        MedicalRecordRepository.getLabTests('radiology'),
        BillsRepository.getBills(),
        MessageRepository.getThreads(),
      ]);
      if (!isMountedRef.current || read !== readRef.current) return;

      setLists(previous => ({
        appointments: settled(appointments, previous?.appointments, 'appointments'),
        pathology: settled(pathology, previous?.pathology, 'pathology'),
        radiology: settled(radiology, previous?.radiology, 'radiology'),
        bills: settled(bills, previous?.bills, 'bills'),
      }));
      // The threads only feed the unread count, which the Messages badge shares.
      if (threads.status === 'fulfilled') applyUnreadMessages(notificationStore, threads.value, session);
      else console.log('dashboard threads error ==>', (threads.reason as any)?.message);

      const results = [appointments, pathology, radiology, bills, threads];
      const everyFailed = results.every(result => result?.status === 'rejected');
      const kinds = results.map(result =>
        result?.status === 'rejected' ? failureKindOf((result as PromiseRejectedResult)?.reason) : null,
      );
      setAllFailed(everyFailed);
      setFailure(
        !everyFailed
          ? null
          : kinds.includes('session')
            ? 'session'
            : kinds.every(kind => kind === 'offline')
              ? 'offline'
              : 'other',
      );
      hasLoadedRef.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [notificationStore],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const today = toISODate(new Date());
  const next = useMemo(() => nextAppointmentOf(lists.appointments, today), [lists.appointments, today]);
  const reports = useMemo(
    () => reportCountsOf([...(lists.pathology ?? []), ...(lists.radiology ?? [])]),
    [lists.pathology, lists.radiology],
  );
  const dueTotal = useMemo(() => totalDueOf(lists.bills), [lists.bills]);

  return {
    isLoading,
    isRefreshing,
    allFailed,
    failure,
    next,
    pendingReports: reports.pending,
    readyReports: reports.ready,
    dueTotal,
    unreadMessages: notificationStore.unreadMessages,
    refresh: () => load(true),
    retry: () => load(),
  };
};

export type DashboardViewModel = ReturnType<typeof useDashboard>;
