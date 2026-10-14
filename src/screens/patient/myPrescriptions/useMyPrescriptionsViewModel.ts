import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReloadOnRefocus } from '../../../hooks/useReloadOnRefocus';
import {
  AttachmentCategory,
  FamilyMember,
  PatientPrescriptionRepository,
  PatientRepository,
  PortalPrescription,
  PrescriptionAttachment,
  serverMessageOf,
  toISODate,
  UploadFile,
  useStores,
} from '@app/core';
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';
import { prescriptionDay } from './prescriptionUi';

export interface PrescriptionFilters {
  /** A doctor's name as the rows carry it; '' means every doctor. */
  doctorName: string;
  /** Matched against the patient's name and code, the doctor, the department and the Rx code. */
  query: string;
  fromDate: Date | null;
  toDate: Date | null;
}

export const EMPTY_FILTERS: PrescriptionFilters = {
  doctorName: '',
  query: '',
  fromDate: null,
  toDate: null,
};

/** '' selects every family member — the "All Members" chip. */
export const ALL_MEMBERS = '';

/** What the upload sheet hands back once a file is picked and described. */
export interface UploadDocumentInput {
  file: UploadFile;
  title: string;
  category: AttachmentCategory;
  notes: string;
}

const EMPTY_LIST_REQUEST = { isLoading: false, data: [], error: null };

/**
 * My Prescriptions, as the portal has it: every prescription on the account,
 * narrowed on the phone by member, doctor, a search and dates — the API takes
 * no filters — and, under each card, the documents of the patient it is for.
 */
export const useMyPrescriptionsViewModel = () => {
  const { t } = useTranslation();
  const { toastStore } = useStores();

  const [prescriptionsRequest, setPrescriptionsRequest] = useState<
    RequestState<PortalPrescription[]>
  >({ isLoading: true, data: [], error: null });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  /** Documents of the patient whose panel is open — fetched as it opens. */
  const [attachmentsRequest, setAttachmentsRequest] =
    useState<RequestState<PrescriptionAttachment[]>>(EMPTY_LIST_REQUEST);

  const [selectedPatientCode, setSelectedPatientCode] = useState<string>(ALL_MEMBERS);
  const [filters, setFilters] = useState<PrescriptionFilters>(EMPTY_FILTERS);
  const [isFilterVisible, setFilterVisible] = useState(false);
  /** Id of the card whose "Reports & Documents" panel is open, if any. */
  const [expandedId, setExpandedId] = useState<number | null>(null);
  /** Prescription the upload sheet is attaching a document to. */
  const [uploadTarget, setUploadTarget] = useState<PortalPrescription | null>(null);

  /** Every list read takes a number; only the newest may change the screen. */
  const listVersionRef = useRef(0);

  const fetchPrescriptions = useCallback(async (mode?: 'quiet' | 'refresh') => {
    const version = ++listVersionRef.current;
    if (mode === 'refresh') setIsRefreshing(true);
    if (!mode) setPrescriptionsRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await PatientPrescriptionRepository.getMyPrescriptions();
      if (version !== listVersionRef.current) return;
      setPrescriptionsRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('getMyPrescriptions error ==>', error?.message);
      if (version !== listVersionRef.current) return;
      // A quiet re-read that fails keeps what is on screen.
      setPrescriptionsRequest(prev =>
        mode === 'quiet' && prev?.data?.length
          ? { ...prev, isLoading: false }
          : { isLoading: false, data: [], error: serverMessageOf(error) },
      );
    } finally {
      if (version === listVersionRef.current) setIsRefreshing(false);
    }
  }, []);

  /** The member chips — a profile added on the Profile tab joins them. */
  const fetchMembers = useCallback(async () => {
    try {
      const response = (await PatientRepository.getFamilyMembers()) ?? [];
      setMembers(response);
      // A member who is gone cannot stay the filter.
      setSelectedPatientCode(current =>
        current === ALL_MEMBERS || response.some(member => member?.patientCode === current)
          ? current
          : ALL_MEMBERS,
      );
    } catch (error: any) {
      console.log('getFamilyMembers error ==>', error?.message);
    }
  }, []);

  /** Documents belong to the patient, not to one prescription — `patientCode` is the key. */
  const fetchAttachments = useCallback(async (patientCode: string) => {
    setAttachmentsRequest({ isLoading: true, data: [], error: null });
    try {
      const response = await PatientPrescriptionRepository.getDocuments(patientCode);
      setAttachmentsRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('getDocuments error ==>', error?.message);
      setAttachmentsRequest({ isLoading: false, data: [], error: serverMessageOf(error) });
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions();
    fetchMembers();
  }, [fetchPrescriptions, fetchMembers]);

  // The tab stays mounted: a prescription written since shows up on return.
  useReloadOnRefocus(() => {
    fetchPrescriptions('quiet');
    fetchMembers();
  });

  const refresh = useCallback(() => {
    fetchPrescriptions('refresh');
    fetchMembers();
  }, [fetchPrescriptions, fetchMembers]);

  const prescriptions = useMemo(() => prescriptionsRequest?.data ?? [], [prescriptionsRequest]);

  /** The doctor filter's choices — every doctor who appears on the list, A to Z. */
  const doctors = useMemo(
    () =>
      Array.from(
        new Set(prescriptions.map(item => item?.doctorName?.trim()).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b)),
    [prescriptions],
  );

  const expandedPatientCode = useMemo(
    () => prescriptions.find(item => item?.id === expandedId)?.patientCode ?? '',
    [prescriptions, expandedId],
  );

  // Read as a panel opens; two cards of the same member share it.
  useEffect(() => {
    if (expandedId === null) {
      setAttachmentsRequest(EMPTY_LIST_REQUEST);
      return;
    }
    fetchAttachments(expandedPatientCode);
  }, [expandedId, expandedPatientCode, fetchAttachments]);

  const selectedMemberName = useMemo(
    () =>
      selectedPatientCode === ALL_MEMBERS
        ? ''
        : members.find(member => member?.patientCode === selectedPatientCode)?.fullName ?? '',
    [selectedPatientCode, members],
  );

  const visiblePrescriptions = useMemo(() => {
    const query = (filters?.query ?? '').trim().toLowerCase();
    const from = filters?.fromDate ? toISODate(filters.fromDate) : '';
    const to = filters?.toDate ? toISODate(filters.toDate) : '';

    return prescriptions.filter(item => {
      if (selectedPatientCode !== ALL_MEMBERS && item?.patientCode !== selectedPatientCode) {
        return false;
      }
      if (filters?.doctorName && item?.doctorName?.trim() !== filters.doctorName) return false;
      if (query) {
        const haystack = [
          item?.patientName,
          item?.patientCode,
          item?.doctorName,
          item?.departmentName,
          item?.code,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (from || to) {
        const day = prescriptionDay(item?.prescribedAt);
        if (!day || (from && day < from) || (to && day > to)) return false;
      }
      return true;
    });
  }, [prescriptions, selectedPatientCode, filters]);

  const hasActiveFilters = Boolean(
    filters?.doctorName || (filters?.query ?? '').trim() || filters?.fromDate || filters?.toDate,
  );

  const applyFilters = useCallback((next: PrescriptionFilters) => {
    setFilters(next);
    setFilterVisible(false);
  }, []);

  /** Clears every filter and the member chip, as the portal's Clear does. */
  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setSelectedPatientCode(ALL_MEMBERS);
  }, []);

  const toggleAttachments = useCallback(
    (id: number) => setExpandedId(prev => (prev === id ? null : id)),
    [],
  );

  /**
   * Two calls: the file goes to storage first, then the document row that
   * points at it and files it under the card's patient. Resolves true once saved.
   */
  const uploadDocument = useCallback(
    async (input: UploadDocumentInput): Promise<boolean> => {
      if (!uploadTarget) return false;
      try {
        const fileUrl = await PatientPrescriptionRepository.uploadFile(input?.file);
        await PatientPrescriptionRepository.createDocument({
          patientCode: uploadTarget?.patientCode ?? '',
          category: input?.category ?? 'Other',
          title: input?.title ?? '',
          fileUrl,
          fileName: input?.file?.name ?? '',
          fileSize: Number(input?.file?.size ?? 0),
          notes: input?.notes ?? '',
        });
        toastStore.show(t('myPrescriptions.uploadSuccess'), 'success');
        await fetchAttachments(uploadTarget?.patientCode ?? '');
        setUploadTarget(null);
        return true;
      } catch (error: any) {
        console.log('uploadDocument error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('myPrescriptions.uploadFailed'), 'error');
        return false;
      }
    },
    [uploadTarget, fetchAttachments, toastStore, t],
  );

  const removeAttachment = useCallback(
    async (attachmentId: string) => {
      try {
        await PatientPrescriptionRepository.deleteDocument(attachmentId);
        setAttachmentsRequest(prev => ({
          ...prev,
          data: (prev?.data ?? []).filter(attachment => attachment?.id !== attachmentId),
        }));
        toastStore.show(t('myPrescriptions.documentDeleted'), 'success');
      } catch (error: any) {
        console.log('deleteDocument error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('myPrescriptions.deleteFailed'), 'error');
      }
    },
    [toastStore, t],
  );

  return {
    prescriptions: visiblePrescriptions,
    totalCount: visiblePrescriptions?.length ?? 0,
    isLoading: prescriptionsRequest?.isLoading ?? false,
    isRefreshing,
    /** Null once read; otherwise the server's words, '' when it sent none. */
    error: prescriptionsRequest?.error ?? null,
    retry: () => fetchPrescriptions(),
    refresh,
    members,
    doctors,
    selectedPatientCode,
    setSelectedPatientCode,
    selectedMemberName,
    filters,
    hasActiveFilters,
    isFilterVisible,
    openFilters: () => setFilterVisible(true),
    closeFilters: () => setFilterVisible(false),
    applyFilters,
    clearFilters,
    expandedId,
    toggleAttachments,
    attachments: attachmentsRequest?.data ?? [],
    isLoadingAttachments: attachmentsRequest?.isLoading ?? false,
    removeAttachment,
    uploadTarget,
    openUpload: setUploadTarget,
    closeUpload: () => setUploadTarget(null),
    uploadDocument,
  };
};

export default useMyPrescriptionsViewModel;
