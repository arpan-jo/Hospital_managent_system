import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FindDoctorsRepository,
  PORTAL_DOCTOR_PAGE_SIZE,
  PortalDoctor,
  PortalDoctorFilterOptions,
  serverMessageOf,
} from '@app/core';
import { todayAbbr } from './weekdays';

export interface RequestState<T> {
  isLoading: boolean;
  data: T;
  error: string | null;
}

/** Offered beside the weekdays in the day filter, and resolved to one before it is sent. */
export const TODAY_OPTION = 'Today';

/** What the gender filter offers until the API has said which genders exist. */
export const FALLBACK_GENDERS = ['Male', 'Female'];

const SEARCH_DEBOUNCE_MS = 400;

/** The strip above the list is a browse aid: the few longest-serving doctors. */
const TOP_RATED_COUNT = 4;

export interface DoctorFilters {
  /** One of the API's own department names; '' for all. */
  department: string;
  gender: string;
  /** '' for any day, `TODAY_OPTION`, or a weekday abbreviation. */
  day: string;
}

export const DEFAULT_FILTERS: DoctorFilters = {
  department: '',
  gender: '',
  day: '',
};

const EMPTY_FILTER_OPTIONS: PortalDoctorFilterOptions = {
  departments: [],
  specialties: [],
  genders: [],
};

/**
 * Find Doctors, as the portal runs it: a server-side search over the doctor
 * directory, one page of twelve at a time, narrowed by department, gender and
 * the weekday the doctor sits. Typing waits 400 ms before it searches; a filter
 * applies at once.
 *
 * The web keeps the department pills and the panel's department select as two
 * values that clear each other. Here they are one value, which sends the same
 * request and lets the pills always show what the list is filtered by.
 */
export const useFindDoctorsViewModel = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<DoctorFilters>(DEFAULT_FILTERS);
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

  const [doctors, setDoctors] = useState<PortalDoctor[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  /** True from the first request until any answer has arrived. */
  const [isLoading, setIsLoading] = useState(true);
  /** A new search or filter on its way, with the last results still on screen. */
  const [isFetching, setIsFetching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  /** Null while the list loaded; otherwise the server's words, '' when it sent none. */
  const [error, setError] = useState<string | null>(null);

  const [topRated, setTopRated] = useState<PortalDoctor[]>([]);
  const [filterOptionsRequest, setFilterOptionsRequest] = useState<
    RequestState<PortalDoctorFilterOptions>
  >({ isLoading: true, data: EMPTY_FILTER_OPTIONS, error: null });

  /** How many pages of the current search are on screen — the next `pageNo`. */
  const pagesLoadedRef = useRef(0);
  /** Bumped by every new search, so an answer it overtook is dropped. */
  const searchIdRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(searchQuery),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * What the search is narrowed by, built as each request goes out: "Today" is
   * the patient's today, so it is turned into a weekday at that moment and not
   * when the filter was set.
   */
  const toCriteria = useCallback(
    () => ({
      search: debouncedSearch,
      department: filters?.department ?? '',
      gender: filters?.gender ?? '',
      availableDay:
        filters?.day === TODAY_OPTION ? todayAbbr() : filters?.day ?? '',
    }),
    [debouncedSearch, filters],
  );

  const fetchFirstPage = useCallback(async () => {
    const searchId = ++searchIdRef.current;
    setIsFetching(true);
    setError(null);

    try {
      const page = await FindDoctorsRepository.searchDoctors({
        ...toCriteria(),
        pageNo: 0,
        pageSize: PORTAL_DOCTOR_PAGE_SIZE,
      });
      if (searchId !== searchIdRef.current) return;

      pagesLoadedRef.current = 1;
      setDoctors(page?.data ?? []);
      setTotalCount(page?.totalCount ?? 0);
    } catch (e: any) {
      if (searchId !== searchIdRef.current) return;

      console.log('fetchDoctors error ==>', e?.message);
      pagesLoadedRef.current = 0;
      setDoctors([]);
      setTotalCount(0);
      setError(serverMessageOf(e));
    } finally {
      if (searchId === searchIdRef.current) {
        setIsFetching(false);
        setIsLoading(false);
      }
    }
  }, [toCriteria]);

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  const hasMore = (doctors?.length ?? 0) < totalCount;

  /** The next page of the same search, added under what is already listed. */
  const loadMore = useCallback(async () => {
    if (isFetching || isLoadingMore || !hasMore) return;

    const searchId = searchIdRef.current;
    setIsLoadingMore(true);

    try {
      const page = await FindDoctorsRepository.searchDoctors({
        ...toCriteria(),
        pageNo: pagesLoadedRef.current,
        pageSize: PORTAL_DOCTOR_PAGE_SIZE,
      });
      if (searchId !== searchIdRef.current) return;

      const rows = page?.data ?? [];
      pagesLoadedRef.current += 1;
      setDoctors(prev => [...(prev ?? []), ...rows]);
      // A page with nothing in it means there is no more, whatever the count says.
      setTotalCount(prev =>
        rows.length > 0 ? page?.totalCount ?? prev : doctors?.length ?? 0,
      );
    } catch (e: any) {
      console.log('loadMoreDoctors error ==>', e?.message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [toCriteria, doctors?.length, hasMore, isFetching, isLoadingMore]);

  const fetchFilterOptions = useCallback(async () => {
    setFilterOptionsRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await FindDoctorsRepository.getFilterOptions();
      setFilterOptionsRequest({
        isLoading: false,
        data: response ?? EMPTY_FILTER_OPTIONS,
        error: null,
      });
    } catch (e: any) {
      console.log('fetchFilterOptions error ==>', e?.message);
      setFilterOptionsRequest({
        isLoading: false,
        data: EMPTY_FILTER_OPTIONS,
        error: e?.message ?? null,
      });
    }
  }, []);

  const fetchTopRated = useCallback(async () => {
    try {
      const page = await FindDoctorsRepository.searchDoctors({
        sortBy: 'experience',
        pageSize: TOP_RATED_COUNT,
      });
      setTopRated(page?.data ?? []);
    } catch (e: any) {
      // A browse aid only — the list below does not depend on it.
      console.log('fetchTopRated error ==>', e?.message);
      setTopRated([]);
    }
  }, []);

  useEffect(() => {
    fetchFilterOptions();
    fetchTopRated();
  }, [fetchFilterOptions, fetchTopRated]);

  /** Read off what is typed, not the debounced text: the strip steps aside at the first key. */
  const hasActiveFilters = Boolean(
    filters?.department || filters?.gender || filters?.day || searchQuery,
  );

  /** A department pill: tapping the one already chosen goes back to all. */
  const setDepartment = useCallback((department: string) => {
    setFilters(prev => ({
      ...prev,
      department: prev?.department === department ? '' : department,
    }));
  }, []);

  const applyFilters = useCallback((next: DoctorFilters) => {
    setFilters({ ...DEFAULT_FILTERS, ...next });
    setIsFilterSheetVisible(false);
  }, []);

  /** Clears the filters and the search, both at once so one request goes out. */
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery('');
    setDebouncedSearch('');
  }, []);

  const retry = useCallback(() => {
    fetchFirstPage();
    // The reads beside the list are tried again too, if they came back empty.
    if ((filterOptionsRequest?.data?.departments?.length ?? 0) === 0) {
      fetchFilterOptions();
    }
    if ((topRated?.length ?? 0) === 0) fetchTopRated();
  }, [
    fetchFirstPage,
    fetchFilterOptions,
    fetchTopRated,
    filterOptionsRequest?.data,
    topRated?.length,
  ]);

  const openFilter = useCallback(() => setIsFilterSheetVisible(true), []);
  const closeFilter = useCallback(() => setIsFilterSheetVisible(false), []);

  const genderOptions = useMemo(() => {
    const genders = filterOptionsRequest?.data?.genders ?? [];
    return genders.length > 0 ? genders : FALLBACK_GENDERS;
  }, [filterOptionsRequest?.data?.genders]);

  /** The filters the sheet holds that no pill shows — the count on its button. */
  const sheetFilterCount =
    [filters?.gender, filters?.day]?.filter(Boolean)?.length ?? 0;

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setDepartment,
    applyFilters,
    resetFilters,
    hasActiveFilters,
    sheetFilterCount,
    isFilterSheetVisible,
    openFilter,
    closeFilter,
    departments: filterOptionsRequest?.data?.departments ?? [],
    genderOptions,
    isFilterOptionsLoading: filterOptionsRequest?.isLoading ?? false,
    doctors,
    totalCount,
    isLoading,
    isFetching,
    isLoadingMore,
    hasMore,
    loadMore,
    error,
    retry,
    topRated,
    /** The strip shows only while the patient is browsing, not searching. */
    showTopRated: !hasActiveFilters && (topRated?.length ?? 0) > 0,
  };
};

export default useFindDoctorsViewModel;
