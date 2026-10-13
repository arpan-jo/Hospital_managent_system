import { useCallback, useEffect, useState } from 'react';
import {
  Allergy,
  AllergySeverity,
  ConditionStatus,
  FamilyMember,
  FileRepository,
  MedicalCondition,
  NewFamilyMember,
  PatientProfile,
  PatientRepository,
  UploadFile,
  useStores,
} from '@app/core';
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';

export type ProfileTab = 'personal' | 'medical' | 'allergies' | 'family';

/** Conditions + allergies of one relative, loaded when their card is expanded. */
export interface MemberRecords {
  isLoading: boolean;
  conditions: MedicalCondition[];
  allergies: Allergy[];
}

export const useProfileViewModel = () => {
  const { profileStore } = useStores();

  const [profileRequest, setProfileRequest] = useState<RequestState<PatientProfile | null>>({
    isLoading: true,
    data: null,
    error: null,
  });
  const [conditionsRequest, setConditionsRequest] = useState<RequestState<MedicalCondition[]>>({
    isLoading: true,
    data: [],
    error: null,
  });
  const [allergiesRequest, setAllergiesRequest] = useState<RequestState<Allergy[]>>({
    isLoading: true,
    data: [],
    error: null,
  });
  const [familyRequest, setFamilyRequest] = useState<RequestState<FamilyMember[]>>({
    isLoading: true,
    data: [],
    error: null,
  });
  /** Keyed by patientCode — a relative's records are fetched only once opened. */
  const [memberRecords, setMemberRecords] = useState<Record<string, MemberRecords>>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('personal');
  /**
   * The GET answered 404 — the account simply has no profile row yet, so the
   * screen offers to create one. Any other failure only offers Retry: the
   * create form POSTs, and the backend adds a second "self" row every time.
   */
  const [isMissing, setIsMissing] = useState(false);

  /**
   * The store is the one copy every screen reads: this hook runs once per
   * screen, so a profile created on the edit screen would otherwise stay
   * invisible to the index screen until the app restarted. `profileRequest`
   * still owns the loader and the error for this screen's own fetch.
   */
  const profile = profileStore.patientProfileData ?? profileRequest?.data ?? null;
  const patientCode = profile?.patientCode || undefined;

  const loadProfile = useCallback(async () => {
    setProfileRequest(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await PatientRepository.getProfile();
      profileStore.setPatientProfile(response);
      setProfileRequest({ isLoading: false, data: response, error: null });
      setIsMissing(false);
    } catch (error: any) {
      console.log('[Profile] getProfile error ==>', error?.message);
      setProfileRequest({ isLoading: false, data: null, error: error?.message || 'load' });
      setIsMissing(error?.status === 404);
    }
  }, [profileStore]);

  useEffect(() => {
    loadProfile();
    // Mount-only: every later refresh goes through `refreshProfile`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConditions = useCallback(async (code?: string) => {
    setConditionsRequest(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await PatientRepository.getConditions(code);
      setConditionsRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('[Profile] getConditions error ==>', error?.message);
      setConditionsRequest({ isLoading: false, data: [], error: error?.message ?? null });
    }
  }, []);

  const loadAllergies = useCallback(async (code?: string) => {
    setAllergiesRequest(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await PatientRepository.getAllergies(code);
      setAllergiesRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('[Profile] getAllergies error ==>', error?.message);
      setAllergiesRequest({ isLoading: false, data: [], error: error?.message ?? null });
    }
  }, []);

  // Own records hang off the profile's patientCode, so they load once it lands.
  useEffect(() => {
    if (!profile) return;
    loadConditions(patientCode);
    loadAllergies(patientCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientCode]);

  /** The family roster is loaded (and re-loaded) by the screen that shows it. */
  const reloadFamily = useCallback(async () => {
    setFamilyRequest(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await PatientRepository.getFamilyMembers();
      setFamilyRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('[Profile] getFamilyMembers error ==>', error?.message);
      setFamilyRequest({ isLoading: false, data: [], error: error?.message ?? null });
    }
  }, []);

  /** Fetches a relative's records the first time their card is expanded. */
  const loadMemberRecords = useCallback(
    async (code?: string) => {
      if (!code || memberRecords?.[code]) return;

      setMemberRecords(prev => ({
        ...prev,
        [code]: { isLoading: true, conditions: [], allergies: [] },
      }));

      try {
        const [conditions, allergies] = await Promise.all([
          PatientRepository.getConditions(code),
          PatientRepository.getAllergies(code),
        ]);
        setMemberRecords(prev => ({
          ...prev,
          [code]: {
            isLoading: false,
            conditions: conditions ?? [],
            allergies: allergies ?? [],
          },
        }));
      } catch (error: any) {
        console.log('[Profile] member records error ==>', error?.message);
        setMemberRecords(prev => ({
          ...prev,
          [code]: { isLoading: false, conditions: [], allergies: [] },
        }));
      }
    },
    [memberRecords],
  );

  /**
   * Drops the cached relative records so an open card refetches them. Called
   * when the screen regains focus: a relative's records may have been changed
   * on their own screen since, and these counts would otherwise stay stale.
   */
  const invalidateMemberRecords = useCallback(() => setMemberRecords({}), []);

  const addCondition = useCallback(
    async (input: { name: string; diagnosedDate: string; status: ConditionStatus; notes: string }) => {
      try {
        const created = await PatientRepository.addCondition(input, patientCode);
        setConditionsRequest(prev => ({ ...prev, data: [...(prev?.data ?? []), created] }));
      } catch (error: any) {
        console.log('[Profile] addCondition error ==>', error?.message);
      }
    },
    [patientCode],
  );

  const removeCondition = useCallback(
    async (id: string) => {
      try {
        await PatientRepository.removeCondition(id, patientCode);
        setConditionsRequest(prev => ({
          ...prev,
          data: prev?.data?.filter(item => item?.id !== id) ?? [],
        }));
      } catch (error: any) {
        console.log('[Profile] removeCondition error ==>', error?.message);
      }
    },
    [patientCode],
  );

  const addAllergy = useCallback(
    async (input: { name: string; severity: AllergySeverity; reaction: string }) => {
      try {
        const created = await PatientRepository.addAllergy(input, patientCode);
        setAllergiesRequest(prev => ({ ...prev, data: [...(prev?.data ?? []), created] }));
      } catch (error: any) {
        console.log('[Profile] addAllergy error ==>', error?.message);
      }
    },
    [patientCode],
  );

  const removeAllergy = useCallback(
    async (id: string) => {
      try {
        await PatientRepository.removeAllergy(id, patientCode);
        setAllergiesRequest(prev => ({
          ...prev,
          data: prev?.data?.filter(item => item?.id !== id) ?? [],
        }));
      } catch (error: any) {
        console.log('[Profile] removeAllergy error ==>', error?.message);
      }
    },
    [patientCode],
  );

  /**
   * POST the first time (a freshly registered patient has no profile row), PUT
   * afterwards. Resolves false so the screen can keep the form open on failure.
   */
  const saveProfile = useCallback(
    async (input: Partial<NewFamilyMember>, photo?: UploadFile): Promise<boolean> => {
      try {
        // Creating has no row to attach a photo to yet, so the file is uploaded
        // here and its blob name rides along with the create call.
        const photoUrl = photo ? await FileRepository.upload(photo) : undefined;
        const payload = photoUrl ? { ...input, photoUrl } : input;

        const response = profile
          ? await PatientRepository.updateProfile(payload)
          : await PatientRepository.createProfile(payload);
        profileStore.setPatientProfile(response);
        setProfileRequest({ isLoading: false, data: response, error: null });
        return true;
      } catch (error: any) {
        console.log('[Profile] saveProfile error ==>', error?.message);
        return false;
      }
    },
    [profile, profileStore],
  );

  /**
   * Uploads the picked image and stores the blob name on the profile. `code`
   * targets a relative; omitted, it updates the account holder's own photo.
   */
  const uploadPhoto = useCallback(
    async (file: UploadFile, code?: string): Promise<boolean> => {
      setIsUploadingPhoto(true);
      try {
        const response = await PatientRepository.updatePhoto(file, code);
        // Only the account holder's own photo is on this screen's header card.
        if (!code) {
          profileStore.setPatientProfile(response);
          setProfileRequest({ isLoading: false, data: response, error: null });
        }
        return true;
      } catch (error: any) {
        console.log('[Profile] uploadPhoto error ==>', error?.message);
        return false;
      } finally {
        setIsUploadingPhoto(false);
      }
    },
    [profileStore],
  );

  const removeFamilyMember = useCallback(async (code: string): Promise<boolean> => {
    try {
      await PatientRepository.removeFamilyMember(code);
      setFamilyRequest(prev => ({
        ...prev,
        data: prev?.data?.filter(item => item?.patientCode !== code) ?? [],
      }));
      return true;
    } catch (error: any) {
      console.log('[Profile] removeFamilyMember error ==>', error?.message);
      return false;
    }
  }, []);

  return {
    profile,
    isProfileLoading: profileRequest?.isLoading ?? false,
    /** Load finished and the account has no profile row yet — offer to create one. */
    hasNoProfile: !profileRequest?.isLoading && !profile && isMissing,
    /** The profile could not be read — offer Retry, never the create form. */
    hasLoadFailed: !profileRequest?.isLoading && !profile && !isMissing,
    conditions: conditionsRequest?.data ?? [],
    isConditionsLoading: conditionsRequest?.isLoading ?? false,
    allergies: allergiesRequest?.data ?? [],
    isAllergiesLoading: allergiesRequest?.isLoading ?? false,
    family: familyRequest?.data ?? [],
    isFamilyLoading: familyRequest?.isLoading ?? false,
    memberRecords,
    loadMemberRecords,
    invalidateMemberRecords,
    tab,
    setTab,
    refreshProfile: loadProfile,
    reloadFamily,
    addCondition,
    removeCondition,
    addAllergy,
    removeAllergy,
    saveProfile,
    uploadPhoto,
    isUploadingPhoto,
    removeFamilyMember,
  };
};

export default useProfileViewModel;
