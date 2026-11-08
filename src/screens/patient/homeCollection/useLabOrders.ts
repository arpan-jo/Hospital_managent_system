import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { LabOrder, LabOrderRepository, isActiveLabOrder, serverMessageOf } from '@app/core';

/**
 * The account's home-collection orders, as the portal's page reads them — again
 * each time the screen comes into view (an order placed or cancelled elsewhere
 * shows on return), and on a pull. A failed re-read keeps what is shown.
 */
export const useLabOrders = () => {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Null once read; the server's words ('' for none) while nothing could be read. */
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const readRef = useRef(0);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (pulled = false) => {
    const read = ++readRef.current;
    if (pulled) setIsRefreshing(true);
    else if (!hasLoadedRef.current) setIsLoading(true);
    try {
      const rows = await LabOrderRepository.getMyOrders();
      if (!isMountedRef.current || read !== readRef.current) return;
      setOrders(rows ?? []);
      setError(null);
      hasLoadedRef.current = true;
    } catch (e: any) {
      if (!isMountedRef.current || read !== readRef.current) return;
      console.log('getMyLabOrders error ==>', e?.message);
      if (!hasLoadedRef.current) setError(serverMessageOf(e));
    } finally {
      if (isMountedRef.current && read === readRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Still with the hospital first, then the rest — the portal's two lists.
  const active = useMemo(() => (orders ?? []).filter(order => isActiveLabOrder(order)), [orders]);
  const past = useMemo(() => (orders ?? []).filter(order => !isActiveLabOrder(order)), [orders]);

  return {
    orders,
    active,
    past,
    isLoading,
    isRefreshing,
    error,
    refresh: () => load(true),
    retry: () => {
      hasLoadedRef.current = false;
      return load();
    },
  };
};

export type LabOrdersViewModel = ReturnType<typeof useLabOrders>;
