import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LabTestType,
  UploadedLabReport,
  UploadedLabReportRepository,
  serverMessageOf,
  useStores,
} from '@app/core';
import { useReloadOnRefocus } from '../../../hooks/useReloadOnRefocus';

/**
 * The patient's own confirmed lab-report uploads for one page — Pathology or
 * Radiology — and removing one, as the portal runs them. A failed read shows
 * nothing, as on the portal: the hospital's own tests still speak for
 * themselves.
 */
export const useUploadedLabReports = (type: LabTestType) => {
  const { t } = useTranslation();
  const { toastStore } = useStores();
  const [reports, setReports] = useState<UploadedLabReport[]>([]);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const isMountedRef = useRef(true);
  /** Only the newest read may change the list — an older one cannot bring a removed report back. */
  const readRef = useRef(0);

  const load = useCallback(async () => {
    const read = ++readRef.current;
    try {
      const all = await UploadedLabReportRepository.getUploadedLabReports();
      if (isMountedRef.current && read === readRef.current) setReports(all ?? []);
    } catch (e: any) {
      console.log('getUploadedLabReports error ==>', e?.message);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    load();
    return () => {
      isMountedRef.current = false;
    };
  }, [load]);

  // A report confirmed on the portal while the app was away shows on return.
  useReloadOnRefocus(load);

  const ofType = useMemo(() => (reports ?? []).filter(report => report?.reportType === type), [reports, type]);

  /** True once removed; the caller closes its question then. */
  const remove = useCallback(
    async (report: UploadedLabReport | null | undefined): Promise<boolean> => {
      const id = Number(report?.uploadedLabReportId ?? 0) || 0;
      if (!id || removingId) return false;
      setRemovingId(id);
      try {
        await UploadedLabReportRepository.removeUploadedLabReport(id);
        // Any read already on its way predates the removal.
        readRef.current += 1;
        if (isMountedRef.current) {
          setReports(prev => (prev ?? []).filter(item => item?.uploadedLabReportId !== id));
        }
        toastStore.show(t('reports.uploadedReportRemoved'), 'success');
        return true;
      } catch (e: any) {
        console.log('removeUploadedLabReport error ==>', e?.message);
        // The backend answers 204 or a bare 404 — our words unless it ever says more.
        toastStore.show(serverMessageOf(e) || t('reports.removeFailed'), 'error');
        return false;
      } finally {
        if (isMountedRef.current) setRemovingId(null);
      }
    },
    [removingId, toastStore, t],
  );

  return { reports: ofType, reload: load, removingId, remove };
};

export type UploadedLabReportsViewModel = ReturnType<typeof useUploadedLabReports>;
