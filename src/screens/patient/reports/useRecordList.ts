import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RecordPatient, serverMessageOf } from '@app/core';
import { useReloadOnRefocus } from '../../../hooks/useReloadOnRefocus';

/** The "Everyone" chip. */
export const EVERYONE = '';

export interface RecordPatientOption {
  code: string;
  name: string;
}

/**
 * One of the hospital-issued lists on the Reports page — lab reports, imaging
 * reports or visit prescriptions — as the portal runs them: the whole list
 * read once, then narrowed on the phone by family member and by a search over
 * `searchFields`.
 */
export const useRecordList = <T extends RecordPatient>(
  fetcher: () => Promise<T[]>,
  searchFields: (item: T) => (string | null | undefined)[],
) => {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Null once read; otherwise the server's words, '' when it sent none. */
  const [error, setError] = useState<string | null>(null);
  const [patientCode, setPatientCode] = useState<string>(EVERYONE);
  const [search, setSearch] = useState('');

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const fieldsRef = useRef(searchFields);
  fieldsRef.current = searchFields;

  const load = useCallback(async (mode: 'initial' | 'quiet' | 'refresh' = 'initial') => {
    if (mode === 'initial') setIsLoading(true);
    if (mode === 'refresh') setIsRefreshing(true);
    try {
      const response = await fetcherRef.current();
      setItems(response ?? []);
      setError(null);
    } catch (e: any) {
      console.log('getRecords error ==>', e?.message);
      if (mode !== 'quiet') {
        setItems([]);
        setError(serverMessageOf(e));
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load('initial');
  }, [load]);

  // A record delivered while the app was away shows on return.
  useReloadOnRefocus(() => load('quiet'));

  /** Everyone the records belong to, in the order they first appear. */
  const patients = useMemo(() => {
    const seen = new Map<string, string>();
    items?.forEach(item => {
      const code = item?.patientCode ?? '';
      if (code && !seen.has(code)) seen.set(code, item?.patientName || code);
    });
    return Array.from(seen, ([code, name]): RecordPatientOption => ({ code, name }));
  }, [items]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (
      items?.filter(item => {
        if (patientCode && item?.patientCode !== patientCode) return false;
        if (!query) return true;
        return fieldsRef.current(item).some(field => (field ?? '').toLowerCase().includes(query));
      }) ?? []
    );
  }, [items, patientCode, search]);

  return {
    items: visible,
    hasRecords: (items?.length ?? 0) > 0,
    /** A family chip row is offered only when the records span two people or more. */
    patients,
    showPatients: patients.length > 1,
    patientCode,
    setPatientCode,
    search,
    setSearch,
    isLoading,
    isRefreshing,
    error,
    retry: () => load('initial'),
    refresh: () => load('refresh'),
  };
};

export type RecordListViewModel<T extends RecordPatient> = ReturnType<typeof useRecordList<T>>;
