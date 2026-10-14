import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Allergy,
  AllergySeverity,
  ConditionStatus,
  MedicalCondition,
  PatientProfile,
  PatientProfileForm,
  PatientRepository,
  UploadFile,
  serverMessageOf,
  useStores,
} from '@app/core';
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';

export type ProfileTab = 'personal' | 'medical' | 'allergies' | 'family';

const NOT_FOUND = 404;

/**
 * My Profile, as the portal has it: the patient's own profile with its photo,
 * and their medical history and allergies beside it. Every message shown is
 * the server's own when it sent one, the screen's otherwise.
 */
export const useProfileViewModel = () => {
  const { t } = useTranslation();
  const { profileStore, toastStore } = useStores();

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
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('personal');
  /** The GET answered 404 — the patient has no profile yet, so the screen offers to create one. */
  const [isMissing, setIsMissing] = useState(false);

  /**
   * The store is the one copy every screen reads: this hook runs once per
   * screen, so a profile saved on the edit screen would otherwise stay
   * invisible to the profile screen until it fetched again.
   */
  const profile = profileStore.patientProfileData ?? profileRequest?.data ?? null;
  const hasProfile = Boolean(profile);

  const loadProfile = useCallback(async () => {
    setProfileRequest(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await PatientRepository.getProfile();
      profileStore.setPatientProfile(response);
      setProfileRequest({ isLoading: false, data: response, error: null });
      setIsMissing(false);
    } catch (error: any) {
      console.log('[Profile] getProfile error ==>', error?.message);
      setProfileRequest({ isLoading: false, data: null, error: serverMessageOf(error) });
      setIsMissing(error?.status === NOT_FOUND);
    }
  }, [profileStore]);

  useEffect(() => {
    loadProfile();
    // Mount-only: every later refresh goes through `refreshProfile`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConditions = useCallback(async () => {
    setConditionsRequest(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await PatientRepository.getConditions();
      setConditionsRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('[Profile] getConditions error ==>', error?.message);
      setConditionsRequest({ isLoading: false, data: [], error: serverMessageOf(error) });
    }
  }, []);

  const loadAllergies = useCallback(async () => {
    setAllergiesRequest(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await PatientRepository.getAllergies();
      setAllergiesRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('[Profile] getAllergies error ==>', error?.message);
      setAllergiesRequest({ isLoading: false, data: [], error: serverMessageOf(error) });
    }
  }, []);

  // The lists belong to the login, but there is nothing to show them under
  // until the profile itself is there.
  useEffect(() => {
    if (!hasProfile) return;
    loadConditions();
    loadAllergies();
  }, [hasProfile, loadConditions, loadAllergies]);

  /** Resolves true once saved, so the sheet closes only then. */
  const addCondition = useCallback(
    async (input: {
      name: string;
      diagnosedDate: string;
      status: ConditionStatus;
      notes: string;
    }): Promise<boolean> => {
      try {
        const created = await PatientRepository.addCondition(input);
        setConditionsRequest(prev => ({ ...prev, data: [...(prev?.data ?? []), created] }));
        toastStore.show(t('patientProfile.conditionAdded'), 'success');
        return true;
      } catch (error: any) {
        console.log('[Profile] addCondition error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('patientProfile.conditionAddFailed'), 'error');
        return false;
      }
    },
    [toastStore, t],
  );

  const removeCondition = useCallback(
    async (id: string) => {
      try {
        await PatientRepository.removeCondition(id);
        setConditionsRequest(prev => ({
          ...prev,
          data: prev?.data?.filter(item => item?.id !== id) ?? [],
        }));
      } catch (error: any) {
        console.log('[Profile] removeCondition error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('patientProfile.deleteFailed'), 'error');
      }
    },
    [toastStore, t],
  );

  /** Resolves true once saved, so the sheet closes only then. */
  const addAllergy = useCallback(
    async (input: { name: string; severity: AllergySeverity; reaction: string }): Promise<boolean> => {
      try {
        const created = await PatientRepository.addAllergy(input);
        setAllergiesRequest(prev => ({ ...prev, data: [...(prev?.data ?? []), created] }));
        toastStore.show(t('patientProfile.allergyAdded'), 'success');
        return true;
      } catch (error: any) {
        console.log('[Profile] addAllergy error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('patientProfile.allergyAddFailed'), 'error');
        return false;
      }
    },
    [toastStore, t],
  );

  const removeAllergy = useCallback(
    async (id: string) => {
      try {
        await PatientRepository.removeAllergy(id);
        setAllergiesRequest(prev => ({
          ...prev,
          data: prev?.data?.filter(item => item?.id !== id) ?? [],
        }));
      } catch (error: any) {
        console.log('[Profile] removeAllergy error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('patientProfile.deleteFailed'), 'error');
      }
    },
    [toastStore, t],
  );

  /**
   * Creates the profile the first time — a newly signed-up patient has none —
   * and updates it after that. A photo picked before the first save is
   * uploaded here and saved with it. Resolves true once saved.
   */
  const saveProfile = useCallback(
    async (form: PatientProfileForm, photo?: UploadFile | null): Promise<boolean> => {
      const isCreating = !profile?.registrationId;
      try {
        const photoUrl = photo ? await PatientRepository.uploadPhoto(photo) : undefined;
        const response = await PatientRepository.saveProfile(
          form,
          profile?.registrationId,
          photoUrl,
        );
        profileStore.setPatientProfile(response);
        setProfileRequest({ isLoading: false, data: response, error: null });
        setIsMissing(false);
        toastStore.show(
          t(isCreating ? 'patientProfile.profileCreated' : 'patientProfile.profileUpdated'),
          'success',
        );
        return true;
      } catch (error: any) {
        console.log('[Profile] saveProfile error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('patientProfile.saveFailed'), 'error');
        return false;
      }
    },
    [profile?.registrationId, profileStore, toastStore, t],
  );

  /** Uploads the picked image and makes it the profile photo. */
  const uploadPhoto = useCallback(
    async (file: UploadFile): Promise<boolean> => {
      const registrationId = profile?.registrationId ?? 0;
      if (!registrationId) return false;

      setIsUploadingPhoto(true);
      try {
        const response = await PatientRepository.updatePhoto(file, registrationId);
        profileStore.setPatientProfile(response);
        setProfileRequest({ isLoading: false, data: response, error: null });
        toastStore.show(t('photoPicker.uploaded'), 'success');
        return true;
      } catch (error: any) {
        console.log('[Profile] uploadPhoto error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('photoPicker.uploadFailed'), 'error');
        return false;
      } finally {
        setIsUploadingPhoto(false);
      }
    },
    [profile?.registrationId, profileStore, toastStore, t],
  );

  return {
    profile,
    isProfileLoading: profileRequest?.isLoading ?? false,
    /** Load finished and the patient has no profile yet — offer to create one. */
    hasNoProfile: !profileRequest?.isLoading && !profile && isMissing,
    /** The profile could not be read — offer Retry, never the create form. */
    hasLoadFailed: !profileRequest?.isLoading && !profile && !isMissing,
    /** The server's words when the profile could not be read; '' when it sent none. */
    loadError: profileRequest?.error ?? '',
    conditions: conditionsRequest?.data ?? [],
    isConditionsLoading: conditionsRequest?.isLoading ?? false,
    conditionsError: conditionsRequest?.error ?? null,
    allergies: allergiesRequest?.data ?? [],
    isAllergiesLoading: allergiesRequest?.isLoading ?? false,
    allergiesError: allergiesRequest?.error ?? null,
    tab,
    setTab,
    refreshProfile: loadProfile,
    reloadConditions: loadConditions,
    reloadAllergies: loadAllergies,
    addCondition,
    removeCondition,
    addAllergy,
    removeAllergy,
    saveProfile,
    uploadPhoto,
    isUploadingPhoto,
  };
};

export default useProfileViewModel;
