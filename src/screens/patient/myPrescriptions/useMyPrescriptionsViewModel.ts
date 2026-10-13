import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReloadOnRefocus } from '../../../hooks/useReloadOnRefocus';
import {
  AttachmentCategory,
  FamilyMember,
  PatientPrescriptionRepository,
  PatientRepository,
  PrescriptionAttachment,
  PrescriptionDoctor,
  PrescriptionListItem,
  PrescriptionListQuery,
  toISODate,
  UploadFile,
} from '@app/core';
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';

export interface PrescriptionFilters {
  /** `userId` of a doctor from the lookup; '' means every doctor. */
  doctorId: string;
  /** Free text matched against the patient name and patient code. */
  patientQuery: string;
  fromDate: Date | null;
  toDate: Date | null;
}

export const EMPTY_FILTERS: PrescriptionFilters = {
  doctorId: '',
  patientQuery: '',
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

export const useMyPrescriptionsViewModel = () => {
  const [prescriptionsRequest, setPrescriptionsRequest] =
    useState<RequestState<PrescriptionListItem[]>>(EMPTY_LIST_REQUEST);
  const [doctorsRequest, setDoctorsRequest] =
    useState<RequestState<PrescriptionDoctor[]>>(EMPTY_LIST_REQUEST);
  const [membersRequest, setMembersRequest] =
    useState<RequestState<FamilyMember[]>>(EMPTY_LIST_REQUEST);
  /** Documents of the patient whose panel is open — fetched as it opens. */
  const [attachmentsRequest, setAttachmentsRequest] =
    useState<RequestState<PrescriptionAttachment[]>>(EMPTY_LIST_REQUEST);

  /** The member chip's `patientCode`; list rows carry no patient id. */
  const [selectedPatientCode, setSelectedPatientCode] = useState<string>(ALL_MEMBERS);
  const [filters, setFilters] = useState<PrescriptionFilters>(EMPTY_FILTERS);
  const [isFilterVisible, setFilterVisible] = useState(false);
  /** Id of the card whose "Reports and Documents" section is open, if any. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Prescription the upload sheet is attaching a document to. */
  const [uploadTarget, setUploadTarget] = useState<PrescriptionListItem | null>(null);
  const [isUploading, setUploading] = useState(false);

  /**
   * Only the doctor and the dates go to the server — rebuilt from those three
   * alone, so editing the patient search does not send the list back to the API.
   */
  const listQuery = useMemo<PrescriptionListQuery>(
    () => ({
      doctorUserId: filters?.doctorId ?? '',
      fromDate: filters?.fromDate ? toISODate(filters.fromDate) : '',
      toDate: filters?.toDate ? toISODate(filters.toDate) : '',
    }),
    [filters?.doctorId, filters?.fromDate, filters?.toDate],
  );

  /** Every list read takes a number; only the newest may change the screen. */
  const listVersionRef = useRef(0);

  /*
   * Each read below takes `'quiet'` for the re-read when the screen comes back
   * into view: no spinner, and a failure leaves what is on screen.
   */
  const fetchPrescriptions = useCallback(
    async (query: PrescriptionListQuery, mode?: 'quiet') => {
      const isQuiet = mode === 'quiet';
      const version = ++listVersionRef.current;
      if (!isQuiet) setPrescriptionsRequest(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await PatientPrescriptionRepository.getPrescriptions(query);
        // A newer read — another filter, or a refresh — decides what shows.
        if (version !== listVersionRef.current) return;
        setPrescriptionsRequest({ isLoading: false, data: response ?? [], error: null });
      } catch (error: any) {
        console.log('getPrescriptions error ==>', error?.message);
        if (version !== listVersionRef.current) return;
        // A quiet read keeps the list as it was — unless nothing has loaded yet.
        setPrescriptionsRequest(prev => ({
          isLoading: false,
          data: isQuiet ? prev?.data ?? [] : [],
          error: isQuiet && prev?.data?.length ? prev?.error ?? null : error?.message ?? null,
        }));
      }
    },
    [],
  );

  /** The doctor filter's list — a doctor who prescribes for the first time joins it. */
  const fetchDoctors = useCallback(async (mode?: 'quiet') => {
    const isQuiet = mode === 'quiet';
    if (!isQuiet) setDoctorsRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await PatientPrescriptionRepository.getDoctors();
      setDoctorsRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('getPrescriptionDoctors error ==>', error?.message);
      if (isQuiet) return;
      setDoctorsRequest({ isLoading: false, data: [], error: error?.message ?? null });
    }
  }, []);

  /** The member chips — a relative added on the Profile tab joins them. */
  const fetchMembers = useCallback(async (mode?: 'quiet') => {
    const isQuiet = mode === 'quiet';
    if (!isQuiet) setMembersRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = (await PatientRepository.getFamilyMembers()) ?? [];
      setMembersRequest({ isLoading: false, data: response, error: null });
      // A member removed on the Profile tab has no chip left, so cannot stay the filter.
      setSelectedPatientCode(current =>
        current === ALL_MEMBERS || response.some(member => member?.patientCode === current)
          ? current
          : ALL_MEMBERS,
      );
    } catch (error: any) {
      console.log('getFamilyMembers error ==>', error?.message);
      if (isQuiet) return;
      setMembersRequest({ isLoading: false, data: [], error: error?.message ?? null });
    }
  }, []);

  /**
   * Documents belong to the patient, not to one visit — `patientCode` is the
   * only key the endpoint narrows by, so a card lists every document of the
   * member it was issued for.
   */
  const fetchAttachments = useCallback(async (patientCode: string) => {
    setAttachmentsRequest({ isLoading: true, data: [], error: null });

    try {
      const response = await PatientPrescriptionRepository.getDocuments(patientCode);
      setAttachmentsRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('getDocuments error ==>', error?.message);
      setAttachmentsRequest({
        isLoading: false,
        data: [],
        error: error?.message ?? null,
      });
    }
  }, []);

  // Re-runs whenever Apply commits a new doctor or date range.
  useEffect(() => {
    fetchPrescriptions(listQuery);
  }, [fetchPrescriptions, listQuery]);

  useEffect(() => {
    fetchDoctors();
    fetchMembers();
  }, [fetchDoctors, fetchMembers]);

  const prescriptions = useMemo(
    () => prescriptionsRequest?.data ?? [],
    [prescriptionsRequest],
  );

  /** Whose documents the open panel lists — '' while every card is collapsed. */
  const expandedPatientCode = useMemo(
    () => prescriptions.find(item => item?.id === expandedId)?.patientCode ?? '',
    [prescriptions, expandedId],
  );

  // Fetched as a panel opens — the list payload does not carry documents. Keyed
  // on the patient, so moving between two cards of the same member re-uses it.
  useEffect(() => {
    if (!expandedPatientCode) {
      setAttachmentsRequest(EMPTY_LIST_REQUEST);
      return;
    }
    fetchAttachments(expandedPatientCode);
  }, [expandedPatientCode, fetchAttachments]);

  const members = useMemo(() => membersRequest?.data ?? [], [membersRequest]);

  /** Shown next to the record count once the list is narrowed to one member. */
  const selectedMemberName = useMemo(
    () =>
      selectedPatientCode === ALL_MEMBERS
        ? ''
        : members.find(member => member?.patientCode === selectedPatientCode)?.fullName ?? '',
    [selectedPatientCode, members],
  );

  /** What the endpoint cannot narrow: the member chip and the name/code search. */
  const visiblePrescriptions = useMemo(() => {
    const query = (filters?.patientQuery ?? '').trim().toLowerCase();

    return prescriptions.filter(prescription => {
      if (
        selectedPatientCode !== ALL_MEMBERS &&
        prescription?.patientCode !== selectedPatientCode
      ) {
        return false;
      }

      if (query) {
        const haystack =
          `${prescription?.patientName ?? ''} ${prescription?.patientCode ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [prescriptions, selectedPatientCode, filters?.patientQuery]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters?.doctorId ||
          (filters?.patientQuery ?? '').trim() ||
          filters?.fromDate ||
          filters?.toDate,
      ),
    [filters],
  );

  const openFilters = useCallback(() => setFilterVisible(true), []);
  const closeFilters = useCallback(() => setFilterVisible(false), []);

  const applyFilters = useCallback((next: PrescriptionFilters) => {
    setFilters(next);
    setFilterVisible(false);
  }, []);

  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  /** Pull to refresh: the list, and the member and doctor filters with it. */
  const refresh = useCallback(() => {
    fetchPrescriptions(listQuery);
    fetchDoctors('quiet');
    fetchMembers('quiet');
  }, [fetchPrescriptions, fetchDoctors, fetchMembers, listQuery]);

  // The tab stays mounted: a prescription written since, or a relative added
  // on the Profile tab, shows up on return.
  useReloadOnRefocus(() => {
    fetchPrescriptions(listQuery, 'quiet');
    fetchDoctors('quiet');
    fetchMembers('quiet');
  });

  const toggleAttachments = useCallback(
    (id: string) => setExpandedId(prev => (prev === id ? null : id)),
    [],
  );

  const openUpload = useCallback(
    (prescription: PrescriptionListItem) => setUploadTarget(prescription),
    [],
  );

  const closeUpload = useCallback(() => setUploadTarget(null), []);

  /**
   * Two calls: the file goes to blob storage first, then the document row that
   * points at it and files it under the card's patient.
   */
  const uploadDocument = useCallback(
    async (input: UploadDocumentInput): Promise<boolean> => {
      if (!uploadTarget) return false;
      setUploading(true);

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

        await fetchAttachments(uploadTarget?.patientCode ?? '');
        setUploadTarget(null);
        return true;
      } catch (error: any) {
        console.log('uploadDocument error ==>', error?.message);
        return false;
      } finally {
        setUploading(false);
      }
    },
    [uploadTarget, fetchAttachments],
  );

  const removeAttachment = useCallback(
    async (attachmentId: string): Promise<boolean> => {
      try {
        await PatientPrescriptionRepository.deleteDocument(attachmentId);
        setAttachmentsRequest(prev => ({
          ...prev,
          data: (prev?.data ?? []).filter(attachment => attachment?.id !== attachmentId),
        }));
        return true;
      } catch (error: any) {
        console.log('deleteDocument error ==>', error?.message);
        return false;
      }
    },
    [],
  );

  return {
    prescriptions: visiblePrescriptions,
    totalCount: visiblePrescriptions?.length ?? 0,
    isLoading: prescriptionsRequest?.isLoading ?? false,
    refresh,
    members,
    doctors: doctorsRequest?.data ?? [],
    selectedPatientCode,
    setSelectedPatientCode,
    selectedMemberName,
    filters,
    hasActiveFilters,
    isFilterVisible,
    openFilters,
    closeFilters,
    applyFilters,
    resetFilters,
    expandedId,
    toggleAttachments,
    attachments: attachmentsRequest?.data ?? [],
    isLoadingAttachments: attachmentsRequest?.isLoading ?? false,
    removeAttachment,
    uploadTarget,
    openUpload,
    closeUpload,
    uploadDocument,
    isUploading,
  };
};

export default useMyPrescriptionsViewModel;
