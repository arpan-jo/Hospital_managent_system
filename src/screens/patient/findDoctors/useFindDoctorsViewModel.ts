import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DoctorFilterResponse,
  DoctorGender,
  DoctorListQuery,
  DoctorSummary,
  FindDoctorsRepository,
  TopDoctor,
} from '@app/core';

export const ALL_SPECIALTIES = 'All';

export interface RequestState<T> {
  isLoading: boolean;
  data: T;
  error: string | null;
}

const EMPTY_FILTER_OPTIONS: DoctorFilterResponse = {
  specialties: [],
  locations: [],
};

export const AVAILABILITY_TODAY = 'Available Today';
export const AVAILABILITY_THIS_WEEK = 'Available This Week';

export type AvailabilityFilter =
  | ''
  | typeof AVAILABILITY_TODAY
  | typeof AVAILABILITY_THIS_WEEK;

const SEARCH_DEBOUNCE_MS = 500;

export interface DoctorFilters {
  specialty: string;
  location: string;
  availability: AvailabilityFilter;
  gender: DoctorGender | '';
}

export const DEFAULT_FILTERS: DoctorFilters = {
  specialty: '',
  location: '',
  availability: '',
  gender: '',
};

export const useFindDoctorsViewModel = (initialSpecialty?: string) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const [appliedFilters, setAppliedFilters] = useState<DoctorFilters>({
    ...DEFAULT_FILTERS,
    specialty: initialSpecialty ?? '',
  });

  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

  const [doctorListRequest, setDoctorListRequest] = useState<
    RequestState<DoctorSummary[]>
  >({ isLoading: true, data: [], error: null });

  const [topDoctorsRequest, setTopDoctorsRequest] = useState<
    RequestState<TopDoctor[]>
  >({ isLoading: true, data: [], error: null });

  const [filterOptionsRequest, setFilterOptionsRequest] = useState<
    RequestState<DoctorFilterResponse>
  >({ isLoading: true, data: EMPTY_FILTER_OPTIONS, error: null });

  const fetchFilterOptions = useCallback(async () => {
    setFilterOptionsRequest(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await FindDoctorsRepository.getFilters();
      setFilterOptionsRequest({
        isLoading: false,
        error: null,
        data: {
          ...response,
          specialties: [ALL_SPECIALTIES, ...(response?.specialties ?? [])],
          locations: response?.locations ?? [],
        },
      });
    } catch (error: any) {
      console.log('fetchFilterOptions error ==>', error?.message);
      setFilterOptionsRequest({
        isLoading: false,
        data: EMPTY_FILTER_OPTIONS,
        error: error?.message ?? null,
      });
    }
  }, []);

  const fetchDoctorList = useCallback(async (query?: DoctorListQuery) => {
    setDoctorListRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await FindDoctorsRepository.getDoctors(query);
      setDoctorListRequest({
        isLoading: false,
        data: response ?? [],
        error: null,
      });
    } catch (error: any) {
      console.log('fetchDoctorList error ==>', error?.message);
      setDoctorListRequest({
        isLoading: false,
        data: [],
        error: error?.message ?? null,
      });
    }
  }, []);

  const fetchTopDoctors = useCallback(async () => {
    setTopDoctorsRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await FindDoctorsRepository.getTopDoctors();
      // Only doctors with an actual track record qualify — the API ranks by
      // completed-appointment count but doesn't drop zero-count doctors when
      // there aren't enough others to fill the limit.
      const withTrackRecord =
        response?.filter(item => (item?.completedAppointments ?? 0) > 0) ?? [];
      setTopDoctorsRequest({
        isLoading: false,
        data: withTrackRecord,
        error: null,
      });
    } catch (error: any) {
      console.log('fetchTopDoctors error ==>', error?.message);
      setTopDoctorsRequest({
        isLoading: false,
        data: [],
        error: error?.message ?? null,
      });
    }
  }, []);

  useEffect(() => {
    fetchFilterOptions();
    fetchTopDoctors();
  }, [fetchFilterOptions, fetchTopDoctors]);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearchQuery(searchQuery),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchDoctorList({
      specialty: appliedFilters?.specialty,
      location: appliedFilters?.location,
      gender: appliedFilters?.gender,
      availability: appliedFilters?.availability,
      search: debouncedSearchQuery,
    });
  }, [fetchDoctorList, appliedFilters, debouncedSearchQuery]);

  useEffect(() => {
    if (!initialSpecialty) return;

    setAppliedFilters(prev =>
      prev?.specialty === initialSpecialty
        ? prev
        : { ...prev, specialty: initialSpecialty },
    );
  }, [initialSpecialty]);

  const setSpecialtyFilter = useCallback((specialty: string) => {
    setAppliedFilters(prev => ({
      ...prev,
      specialty: prev?.specialty === specialty ? '' : specialty,
    }));
  }, []);

  const applyFilters = useCallback((next: DoctorFilters) => {
    setAppliedFilters(next);
    setIsFilterSheetVisible(false);
  }, []);

  const resetFilters = useCallback(
    () => setAppliedFilters(DEFAULT_FILTERS),
    [],
  );

  const openFilter = useCallback(() => setIsFilterSheetVisible(true), []);
  const closeFilter = useCallback(() => setIsFilterSheetVisible(false), []);

  const activeFilterCount = useMemo(
    () =>
      [
        appliedFilters?.location,
        appliedFilters?.gender,
        appliedFilters?.availability,
      ]?.filter(Boolean)?.length ?? 0,
    [appliedFilters],
  );

  return {
    doctorListRequest,
    topDoctorsRequest,
    filterOptionsRequest,
    fetchDoctorList,
    fetchTopDoctors,
    fetchFilterOptions,
    searchQuery,
    setSearchQuery,
    appliedFilters,
    setSpecialtyFilter,
    applyFilters,
    resetFilters,
    activeFilterCount,
    isFilterSheetVisible,
    openFilter,
    closeFilter,
  };
};

export default useFindDoctorsViewModel;
