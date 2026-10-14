import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DOCUMENT_CATEGORIES,
  PatientDocument,
  PatientReportRepository,
  UploadFile,
  serverMessageOf,
  useStores,
} from '@app/core';
import { useReloadOnRefocus } from '../../../hooks/useReloadOnRefocus';

/** The "All" chip. */
export const ALL_CATEGORIES = 'All';

/** What the upload sheet hands back once a file is picked and described. */
export interface UploadDocumentInput {
  file: UploadFile;
  title: string;
  category: string;
  notes: string;
}

/**
 * My Uploads, as the portal's Reports page has it: the account's own
 * documents, narrowed on the phone by category and by a search over title and
 * category, with upload and delete.
 */
export const useUploadsViewModel = () => {
  const { t } = useTranslation();
  const { toastStore } = useStores();

  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Null once read; otherwise the server's words, '' when it sent none. */
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [search, setSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /** Only the newest read may change the list — an older one cannot bring a deleted document back. */
  const versionRef = useRef(0);

  const load = useCallback(async (mode: 'initial' | 'quiet' | 'refresh' = 'initial') => {
    const version = ++versionRef.current;
    if (mode === 'initial') setIsLoading(true);
    if (mode === 'refresh') setIsRefreshing(true);
    try {
      const response = await PatientReportRepository.getDocuments();
      if (version !== versionRef.current) return;
      setDocuments(response ?? []);
      setError(null);
    } catch (e: any) {
      console.log('getDocuments error ==>', e?.message);
      if (version !== versionRef.current) return;
      // A quiet re-read that fails keeps what is already on screen.
      if (mode !== 'quiet') {
        setDocuments([]);
        setError(serverMessageOf(e));
      }
    } finally {
      if (version === versionRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load('initial');
  }, [load]);

  // A drawer screen stays mounted: a document added on the portal shows on return.
  useReloadOnRefocus(() => load('quiet'));

  /** Counted over the whole list, whatever is typed in the search. */
  const counts = useMemo(
    () =>
      documents?.reduce<Record<string, number>>((acc, item) => {
        const key = item?.category ?? '';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}) ?? {},
    [documents],
  );

  const visible = useMemo(() => {
    const query = search.toLowerCase();
    return (
      documents?.filter(item => {
        if (category !== ALL_CATEGORIES && item?.category !== category) return false;
        if (!query) return true;
        return (
          (item?.title ?? '').toLowerCase().includes(query) ||
          (item?.category ?? '').toLowerCase().includes(query)
        );
      }) ?? []
    );
  }, [documents, category, search]);

  /** Upload the file, then file it under the account — no patient code, as the portal sends. */
  const upload = useCallback(
    async (input: UploadDocumentInput): Promise<boolean> => {
      setIsUploading(true);
      try {
        const fileUrl = await PatientReportRepository.uploadFile(input?.file);
        await PatientReportRepository.createReport({
          category: input?.category ?? DOCUMENT_CATEGORIES[0],
          title: input?.title ?? '',
          fileUrl,
          fileName: input?.file?.name ?? '',
          fileSize: Number(input?.file?.size ?? 0),
          notes: input?.notes ?? '',
        });
        toastStore.show(t('reports.uploadSuccess'), 'success');
        await load('quiet');
        return true;
      } catch (e: any) {
        console.log('uploadDocument error ==>', e?.message);
        toastStore.show(serverMessageOf(e) || t('reports.uploadFailed'), 'error');
        return false;
      } finally {
        setIsUploading(false);
      }
    },
    [load, toastStore, t],
  );

  const remove = useCallback(
    async (documentId: string): Promise<boolean> => {
      if (!documentId) return false;
      setDeletingId(documentId);
      try {
        await PatientReportRepository.deleteReport(documentId);
        versionRef.current += 1;
        setDocuments(prev => prev?.filter(item => item?.id !== documentId) ?? []);
        toastStore.show(t('reports.deleteSuccess'), 'success');
        return true;
      } catch (e: any) {
        console.log('deleteDocument error ==>', e?.message);
        toastStore.show(serverMessageOf(e) || t('reports.deleteFailed'), 'error');
        return false;
      } finally {
        setDeletingId(null);
      }
    },
    [toastStore, t],
  );

  return {
    documents: visible,
    total: documents?.length ?? 0,
    counts,
    category,
    setCategory,
    search,
    setSearch,
    hasFilter: category !== ALL_CATEGORIES || search !== '',
    isLoading,
    isRefreshing,
    error,
    retry: () => load('initial'),
    refresh: () => load('refresh'),
    isUploading,
    upload,
    deletingId,
    remove,
  };
};

export type UploadsViewModel = ReturnType<typeof useUploadsViewModel>;

export default useUploadsViewModel;
