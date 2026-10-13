import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PatientDocument,
  PatientReportRepository,
  REPORT_CATEGORIES,
  ReportCategory,
  UploadFile,
} from '@app/core';
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';
import { useReloadOnRefocus } from '../../../hooks/useReloadOnRefocus';

/** '' selects every category — the "All" chip. */
export const ALL_CATEGORIES = '';

/** What the upload sheet hands back once a file is picked and described. */
export interface UploadReportInput {
  file: UploadFile;
  title: string;
  category: ReportCategory;
  notes: string;
}

export const useReportsViewModel = () => {
  const [reportsRequest, setReportsRequest] = useState<RequestState<PatientDocument[]>>({
    isLoading: true,
    data: [],
    error: null,
  });
  const [isUploading, setUploading] = useState(false);
  /** Id of the document a delete call is in flight for, if any. */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | ''>(ALL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Every read takes a number, and so does each upload or delete: only the
   * newest may change the list, so a read that set out before a delete cannot
   * bring the deleted document back.
   */
  const listVersionRef = useRef(0);

  /**
   * `'quiet'` re-reads behind what is on screen — no spinner, and a failure
   * leaves it as it was. Used when the screen comes back into view.
   */
  const fetchReports = useCallback(async (mode?: 'quiet') => {
    const isQuiet = mode === 'quiet';
    const version = ++listVersionRef.current;
    if (!isQuiet) setReportsRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await PatientReportRepository.getReports();
      if (version !== listVersionRef.current) return;
      setReportsRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('getReports error ==>', error?.message);
      if (version !== listVersionRef.current) return;
      // A quiet read keeps the list as it was — unless nothing has loaded yet.
      setReportsRequest(prev => ({
        isLoading: false,
        data: isQuiet ? prev?.data ?? [] : [],
        error: isQuiet && prev?.data?.length ? prev?.error ?? null : error?.message ?? null,
      }));
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // A drawer screen stays mounted: a document added elsewhere shows up on return.
  useReloadOnRefocus(() => fetchReports('quiet'));

  const reports = useMemo(() => reportsRequest?.data ?? [], [reportsRequest?.data]);

  const counts = useMemo(
    () =>
      REPORT_CATEGORIES.reduce(
        (acc, category) => ({
          ...acc,
          [category]: reports.filter(report => report?.category === category).length,
        }),
        {} as Record<ReportCategory, number>,
      ),
    [reports],
  );

  /**
   * The endpoint does take a `category` filter, and this screen deliberately
   * never sends it: the chips show a count each, which needs the full list in
   * memory anyway. Search is client-side for the same reason — the API has no
   * text search over documents.
   */
  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return reports.filter(report => {
      if (selectedCategory && report?.category !== selectedCategory) return false;
      if (query) {
        const haystack = `${report?.title ?? ''} ${report?.fileName ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [reports, selectedCategory, searchQuery]);

  /**
   * Upload, then file the stored blob under the account. `patientCode` is left
   * blank — the web files documents against the signed-in patient too, so the
   * screen needs no member picker.
   */
  const uploadReport = useCallback(
    async (input: UploadReportInput): Promise<boolean> => {
      setUploading(true);

      try {
        const fileUrl = await PatientReportRepository.uploadFile(input?.file);
        const created = await PatientReportRepository.createReport({
          category: input?.category ?? 'Other',
          title: input?.title ?? '',
          fileUrl,
          fileName: input?.file?.name ?? '',
          fileSize: Number(input?.file?.size ?? 0),
          notes: input?.notes ?? '',
        });

        // The POST echoes the stored row back; only fall back to a refetch when
        // it did not, so the new card appears without a second round trip.
        if (created) {
          listVersionRef.current += 1;
          setReportsRequest(prev => ({
            ...prev,
            isLoading: false,
            data: [created, ...(prev?.data ?? [])],
          }));
        } else {
          await fetchReports();
        }
        return true;
      } catch (error: any) {
        console.log('uploadReport error ==>', error?.message);
        return false;
      } finally {
        setUploading(false);
      }
    },
    [fetchReports],
  );

  const removeReport = useCallback(async (id: string): Promise<boolean> => {
    setDeletingId(id);

    try {
      await PatientReportRepository.deleteReport(id);
      listVersionRef.current += 1;
      setReportsRequest(prev => ({
        ...prev,
        isLoading: false,
        data: (prev?.data ?? []).filter(report => report?.id !== id),
      }));
      return true;
    } catch (error: any) {
      console.log('deleteReport error ==>', error?.message);
      return false;
    } finally {
      setDeletingId(null);
    }
  }, []);

  return {
    reports: filteredReports,
    totalCount: reports.length,
    counts,
    isLoading: reportsRequest?.isLoading ?? false,
    error: reportsRequest?.error ?? null,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    isUploading,
    uploadReport,
    deletingId,
    removeReport,
    refresh: () => fetchReports(),
  };
};

export default useReportsViewModel;
