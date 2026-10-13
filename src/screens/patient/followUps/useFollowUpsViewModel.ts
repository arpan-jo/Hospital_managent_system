import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  FOLLOW_UP_BUCKETS,
  FollowUp,
  FollowUpBucket,
  followUpBucket,
  PatientFollowUpRepository,
} from '@app/core';
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';

const EMPTY_REQUEST: RequestState<FollowUp[]> = {
  isLoading: false,
  data: [],
  error: null,
};

export const useFollowUpsViewModel = () => {
  const [followUpsRequest, setFollowUpsRequest] =
    useState<RequestState<FollowUp[]>>(EMPTY_REQUEST);
  const [activeTab, setActiveTab] = useState<FollowUpBucket>('pending');

  const fetchFollowUps = useCallback(async () => {
    setFollowUpsRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await PatientFollowUpRepository.getFollowUps();
      setFollowUpsRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('getFollowUps error ==>', error?.message);
      setFollowUpsRequest({
        isLoading: false,
        data: [],
        error: error?.message ?? null,
      });
    }
  }, []);

  // Re-reads on focus so a visit the doctor just scheduled shows up when the
  // patient opens the screen again, without a pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      fetchFollowUps();
    }, [fetchFollowUps]),
  );

  const followUps = useMemo(
    () => followUpsRequest?.data ?? [],
    [followUpsRequest],
  );

  const counts = useMemo(
    () =>
      FOLLOW_UP_BUCKETS.reduce(
        (acc, bucket) => ({
          ...acc,
          [bucket]:
            followUps?.filter(item => followUpBucket(item) === bucket)?.length ??
            0,
        }),
        {} as Record<FollowUpBucket, number>,
      ),
    [followUps],
  );

  const filteredFollowUps = useMemo(
    () => followUps?.filter(item => followUpBucket(item) === activeTab) ?? [],
    [followUps, activeTab],
  );

  return {
    followUps: filteredFollowUps,
    counts,
    activeTab,
    setActiveTab,
    isLoading: followUpsRequest?.isLoading ?? false,
    error: followUpsRequest?.error ?? null,
    refresh: fetchFollowUps,
  };
};

export default useFollowUpsViewModel;
