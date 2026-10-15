import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppointmentDetail,
  AppointmentRepository,
  serverMessageOf,
  useStores,
} from '@app/core';
import { useReloadOnRefocus } from '../../../hooks/useReloadOnRefocus';

/**
 * One appointment, as the portal's detail page has it: read from the portal
 * detail endpoint, with cancelling as the patient's one action — offered while
 * it is still pending or confirmed and no consultation has started.
 */
export const useAppointmentDetailsViewModel = (appointmentId: number) => {
  const { t } = useTranslation();
  const { toastStore } = useStores();

  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** No such appointment, or not this patient's. */
  const [isNotFound, setIsNotFound] = useState(false);
  /** Null once read; otherwise the server's words, '' when it sent none. */
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  /** Bumped by every load, so an older answer never lands over a newer one. */
  const requestRef = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      const requestId = ++requestRef.current;
      if (!quiet) {
        // Another appointment opened onto this screen (from a notification or a
        // follow-up) must not show under the last one's data while it loads.
        setDetail(null);
        setIsNotFound(false);
        setIsLoading(true);
      }
      try {
        const response = await AppointmentRepository.getAppointmentDetail(appointmentId);
        if (requestId !== requestRef.current) return;
        setDetail(response);
        setIsNotFound(!response);
        setError(null);
      } catch (e: any) {
        if (requestId !== requestRef.current) return;
        console.log('getAppointmentDetail error ==>', e?.message);
        if (!quiet) {
          setDetail(null);
          setError(serverMessageOf(e));
        }
      } finally {
        if (requestId === requestRef.current) setIsLoading(false);
      }
    },
    [appointmentId],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Coming back to an appointment left open re-reads it behind what is shown,
  // so a status changed since — confirmed, cancelled — is not shown stale.
  useReloadOnRefocus(() => load(true));

  const canCancel =
    (detail?.status === 'pending' || detail?.status === 'confirmed') && !detail?.hasConsultation;

  /**
   * Cancels and shows the appointment as the server answered it — the patient
   * stays on it, as on the portal. Reads it again only when the answer had none.
   */
  const cancel = useCallback(async (): Promise<boolean> => {
    if (!detail?.id || isCancelling) return false;

    setIsCancelling(true);
    try {
      const updated = await AppointmentRepository.cancelAppointment(detail.id);
      toastStore.show(t('appointmentDetails.updated'), 'success');
      if (updated) setDetail(updated);
      else await load(true);
      return true;
    } catch (e: any) {
      console.log('cancelAppointment error ==>', e?.message);
      toastStore.show(serverMessageOf(e) || t('appointmentDetails.updateFailed'), 'error');
      return false;
    } finally {
      setIsCancelling(false);
    }
  }, [detail?.id, isCancelling, toastStore, t, load]);

  return {
    detail,
    isLoading,
    isNotFound,
    error,
    reload: () => load(),
    canCancel,
    cancel,
    isCancelling,
  };
};

export default useAppointmentDetailsViewModel;
