import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DOCUMENT_CATEGORIES,
  DocumentReadRepository,
  ExtractedLabReport,
  ExtractedPrescription,
  LabReportType,
  PatientDocument,
  PatientProfile,
  PatientReportRepository,
  READ_CATEGORIES,
  UploadFile,
  isNotThatKind,
  isReadableLabReport,
  isReadablePrescription,
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
  /** Whose prescription or lab report it is — the AI's read is added to this profile after review. */
  forWhom?: PatientProfile | null;
  /** A lab report's kind, or 'Auto' to go by the AI's read. */
  reportType?: LabReportType | 'Auto';
}

/** An upload the AI read, waiting for the patient's review — as the portal hands it to its review. */
export type UploadRead =
  | { kind: 'rx'; documentId: number; registrationId: number; extraction: ExtractedPrescription }
  | {
      kind: 'lab';
      documentId: number;
      registrationId: number;
      extraction: ExtractedLabReport;
      /** Null — go by the read. */
      reportType: LabReportType | null;
    };

/**
 * Where an upload the AI will read has got to — what the progress modal shows.
 * Null when no such upload runs (a plain document shows no modal).
 */
export type UploadProgress = { stage: 'uploading' | 'reading'; kind: 'rx' | 'lab' };

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
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** A read waiting for the screen to open its review. */
  const [read, setRead] = useState<UploadRead | null>(null);

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

  /**
   * Has the AI read a just-saved prescription or lab report, as the portal
   * does after its upload: a read worth reviewing is handed to the screen; any
   * other outcome leaves the file a plain document and says so. The upload is
   * already saved — nothing here can undo it.
   */
  const readUpload = useCallback(
    async (input: UploadDocumentInput, documentId: number, registrationId: number): Promise<UploadRead | null> => {
      const isLab = input?.category === 'Lab Report';
      const noun = t(isLab ? 'reports.read.nounLab' : 'reports.read.nounRx');
      try {
        let status = '';
        if (isLab) {
          const extraction = await DocumentReadRepository.readLabReport(input?.file, documentId);
          status = extraction?.status ?? '';
          if (isReadableLabReport(extraction)) {
            const chosen = input?.reportType;
            return {
              kind: 'lab',
              documentId,
              registrationId,
              extraction,
              reportType: chosen === 'Pathology' || chosen === 'Radiology' ? chosen : null,
            };
          }
        } else {
          const extraction = await DocumentReadRepository.readPrescription(input?.file, documentId);
          status = extraction?.status ?? '';
          if (isReadablePrescription(extraction)) return { kind: 'rx', documentId, registrationId, extraction };
        }
        toastStore.show(
          t(isNotThatKind(status) ? 'reports.read.notThatKind' : 'reports.read.unreadable', { noun }),
          'info',
        );
      } catch (e: any) {
        console.log('readUpload error ==>', e?.message);
        toastStore.show(t('reports.read.unavailable', { noun }), 'info');
      }
      return null;
    },
    [toastStore, t],
  );

  /**
   * Upload the file, then file it under the account — no patient code for the
   * patient's own, a family member's code for theirs, as the portal sends. A
   * prescription or lab report for a profile with a registration is then read
   * by the AI; a read worth reviewing waits in `read` for the screen.
   */
  const upload = useCallback(
    async (input: UploadDocumentInput): Promise<boolean> => {
      const forWhom = input?.forWhom ?? null;
      const registrationId = forWhom?.registrationId ?? 0;
      const reads = READ_CATEGORIES.includes(input?.category ?? '') && registrationId > 0;
      const kind = input?.category === 'Lab Report' ? 'lab' : 'rx';
      setIsUploading(true);
      if (reads) setProgress({ stage: 'uploading', kind });
      try {
        const fileUrl = await PatientReportRepository.uploadFile(input?.file);
        const documentId = await PatientReportRepository.createReport({
          category: input?.category ?? DOCUMENT_CATEGORIES[0],
          title: input?.title ?? '',
          fileUrl,
          fileName: input?.file?.name ?? '',
          fileSize: Number(input?.file?.size ?? 0),
          notes: input?.notes ?? '',
          // The patient's own stays untagged — My Uploads lists those; a family member's is tagged.
          patientCode: reads && forWhom?.relationship !== 'self' ? forWhom?.patientCode ?? '' : '',
        });
        toastStore.show(t('reports.uploadSuccess'), 'success');
        await load('quiet');
        if (reads && documentId > 0) {
          setProgress({ stage: 'reading', kind });
          const result = await readUpload(input, documentId, registrationId);
          if (result) setRead(result);
        }
        return true;
      } catch (e: any) {
        console.log('uploadDocument error ==>', e?.message);
        toastStore.show(serverMessageOf(e) || t('reports.uploadFailed'), 'error');
        return false;
      } finally {
        setIsUploading(false);
        setProgress(null);
      }
    },
    [load, readUpload, toastStore, t],
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
    progress,
    upload,
    deletingId,
    remove,
    /** A read waiting for its review; the screen opens it and clears it. */
    read,
    clearRead: () => setRead(null),
  };
};

export type UploadsViewModel = ReturnType<typeof useUploadsViewModel>;

export default useUploadsViewModel;
