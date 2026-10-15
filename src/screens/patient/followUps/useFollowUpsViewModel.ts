import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  FOLLOW_UP_BUCKETS,
  FollowUp,
  FollowUpBucket,
  PatientFollowUpRepository,
  followUpBucket,
  isServerUnreachable,
  serverMessageOf,
  toISODate,
} from '@app/core';

/**
 * Why the list could not be read: the server's words ('' when none), its status
 * (0 when it gave none) and whether no answer came back at all.
 */
export type FollowUpsError = { message: string; status: number; unreachable: boolean };

const EMPTY_COUNTS: Record<FollowUpBucket, number> = {
  upcoming: 0,
  overdue: 0,
  completed: 0,
  cancelled: 0,
};

/**
 * My Follow-ups, as the portal shows them: every follow-up a doctor ordered,
 * split into Upcoming / Overdue / Completed / Cancelled. Read again each time
 * the screen comes into view, so one ordered at a visit shows at once.
 */
export const useFollowUpsViewModel = () => {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<FollowUpsError | null>(null);
  const [activeTab, setActiveTab] = useState<FollowUpBucket>('upcoming');

  const load = useCallback(async (mode: 'initial' | 'quiet' | 'refresh' = 'initial') => {
    if (mode === 'initial') setIsLoading(true);
    if (mode === 'refresh') setIsRefreshing(true);
    try {
      const response = await PatientFollowUpRepository.getFollowUps();
      setFollowUps(response ?? []);
      setError(null);
    } catch (e: any) {
      console.log('getFollowUps error ==>', e?.message);
      // A quiet re-read that fails keeps what is already on screen.
      if (mode !== 'quiet') {
        setFollowUps([]);
        setError({
          message: serverMessageOf(e),
          status: Number(e?.status ?? 0) || 0,
          unreachable: isServerUnreachable(e),
        });
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

  // "Overdue" is judged against today on the phone's calendar, read once per list.
  const bucketed = useMemo(() => {
    const today = toISODate(new Date());
    return followUps?.map(item => ({ item, bucket: followUpBucket(item, today) })) ?? [];
  }, [followUps]);

  const counts = useMemo(
    () =>
      bucketed.reduce(
        (acc, entry) => {
          acc[entry.bucket] = (acc[entry.bucket] ?? 0) + 1;
          return acc;
        },
        { ...EMPTY_COUNTS },
      ),
    [bucketed],
  );

  const visible = useMemo(
    () => bucketed.filter(entry => entry.bucket === activeTab),
    [bucketed, activeTab],
  );

  return {
    tabs: FOLLOW_UP_BUCKETS,
    followUps: visible,
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

export default useFollowUpsViewModel;
