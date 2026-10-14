import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Allergy,
  AllergySeverity,
  ConditionStatus,
  FamilyProfileForm,
  MedicalCondition,
  PatientProfile,
  PatientRepository,
  UploadFile,
  serverMessageOf,
  useStores,
} from '@app/core';
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';

/** One family profile's medical history and allergies, read when its card is opened. */
export interface MemberRecords {
  isLoading: boolean;
  /** Null once read; otherwise the server's words, '' when it sent none. */
  error: string | null;
  conditions: MedicalCondition[];
  allergies: Allergy[];
}

const EMPTY_RECORDS: MemberRecords = { isLoading: true, error: null, conditions: [], allergies: [] };

/**
 * The Family Profiles tab, as the portal has it: every profile on the account,
 * adding and editing a family member, their photo, and each one's medical
 * history and allergies. Every message is the server's own when it sent one.
 *
 * `onOwnRecordsChanged` lets the profile's own Medical and Allergies tabs read
 * their lists again — the holder's card shows the same records — and
 * `onOwnProfileChanged` the profile itself, after its card's photo changed.
 */
export const useFamilyProfilesViewModel = (options?: {
  onOwnRecordsChanged?: () => void;
  onOwnProfileChanged?: () => void;
}) => {
  const { t } = useTranslation();
  const { toastStore } = useStores();
  const onOwnRecordsChanged = options?.onOwnRecordsChanged;
  const onOwnProfileChanged = options?.onOwnProfileChanged;

  const [profilesRequest, setProfilesRequest] = useState<RequestState<PatientProfile[]>>({
    isLoading: true,
    data: [],
    error: null,
  });
  /** Keyed by patientCode. */
  const [records, setRecords] = useState<Record<string, MemberRecords>>({});
  const [photoUploadingCode, setPhotoUploadingCode] = useState('');

  const loadProfiles = useCallback(async () => {
    setProfilesRequest(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await PatientRepository.getAllProfiles();
      setProfilesRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('[Family] getAllProfiles error ==>', error?.message);
      setProfilesRequest({ isLoading: false, data: [], error: serverMessageOf(error) });
    }
  }, []);

  /** Reads one profile's records — when its card opens, and again after a change. */
  const loadRecords = useCallback(async (code: string) => {
    if (!code) return;
    setRecords(prev => ({ ...prev, [code]: { ...(prev?.[code] ?? EMPTY_RECORDS), isLoading: true } }));
    try {
      const [conditions, allergies] = await Promise.all([
        PatientRepository.getConditions(code),
        PatientRepository.getAllergies(code),
      ]);
      setRecords(prev => ({
        ...prev,
        [code]: { isLoading: false, error: null, conditions: conditions ?? [], allergies: allergies ?? [] },
      }));
    } catch (error: any) {
      console.log('[Family] records error ==>', error?.message);
      setRecords(prev => ({
        ...prev,
        [code]: { isLoading: false, error: serverMessageOf(error), conditions: [], allergies: [] },
      }));
    }
  }, []);

  const afterRecordsChange = useCallback(
    (code: string) => {
      loadRecords(code);
      // The account's records are shared by its profiles, the holder's own tabs included.
      onOwnRecordsChanged?.();
    },
    [loadRecords, onOwnRecordsChanged],
  );

  const addCondition = useCallback(
    async (
      code: string,
      input: { name: string; diagnosedDate: string; status: ConditionStatus; notes: string },
    ): Promise<boolean> => {
      try {
        await PatientRepository.addCondition(input, code);
        toastStore.show(t('patientProfile.conditionAdded'), 'success');
        afterRecordsChange(code);
        return true;
      } catch (error: any) {
        console.log('[Family] addCondition error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('patientProfile.conditionAddFailed'), 'error');
        return false;
      }
    },
    [toastStore, t, afterRecordsChange],
  );

  const removeCondition = useCallback(
    async (code: string, id: string) => {
      try {
        await PatientRepository.removeCondition(id, code);
        afterRecordsChange(code);
      } catch (error: any) {
        console.log('[Family] removeCondition error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('patientProfile.deleteFailed'), 'error');
      }
    },
    [toastStore, t, afterRecordsChange],
  );

  const addAllergy = useCallback(
    async (
      code: string,
      input: { name: string; severity: AllergySeverity; reaction: string },
    ): Promise<boolean> => {
      try {
        await PatientRepository.addAllergy(input, code);
        toastStore.show(t('patientProfile.allergyAdded'), 'success');
        afterRecordsChange(code);
        return true;
      } catch (error: any) {
        console.log('[Family] addAllergy error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('patientProfile.allergyAddFailed'), 'error');
        return false;
      }
    },
    [toastStore, t, afterRecordsChange],
  );

  const removeAllergy = useCallback(
    async (code: string, id: string) => {
      try {
        await PatientRepository.removeAllergy(id, code);
        afterRecordsChange(code);
      } catch (error: any) {
        console.log('[Family] removeAllergy error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('patientProfile.deleteFailed'), 'error');
      }
    },
    [toastStore, t, afterRecordsChange],
  );

  /**
   * Adds a family member, or saves one (`target` set). A photo picked in the
   * form is uploaded first and saved with it. Resolves true once saved.
   */
  const saveMember = useCallback(
    async (
      form: FamilyProfileForm,
      photo?: UploadFile | null,
      target?: PatientProfile | null,
    ): Promise<boolean> => {
      try {
        const photoUrl = photo ? await PatientRepository.uploadPhoto(photo) : undefined;
        if (target?.patientCode) {
          await PatientRepository.updateFamilyProfile(target.patientCode, form, photoUrl);
          toastStore.show(t('patientProfile.profileUpdated'), 'success');
        } else {
          const created = await PatientRepository.createFamilyProfile(form, photoUrl);
          toastStore.show(
            t('patientProfile.familyProfileCreated', {
              name: created?.fullName || form?.fullName?.trim() || '',
            }),
            'success',
          );
        }
        loadProfiles();
        return true;
      } catch (error: any) {
        console.log('[Family] saveMember error ==>', error?.message);
        const fallback = target ? 'patientProfile.saveFailed' : 'patientProfile.familyCreateFailed';
        toastStore.show(serverMessageOf(error) || t(fallback), 'error');
        return false;
      }
    },
    [toastStore, t, loadProfiles],
  );

  const removeMember = useCallback(
    async (code: string): Promise<boolean> => {
      try {
        await PatientRepository.removeFamilyProfile(code);
        toastStore.show(t('patientProfile.familyProfileRemoved'), 'success');
        loadProfiles();
        return true;
      } catch (error: any) {
        console.log('[Family] removeMember error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('patientProfile.familyRemoveFailed'), 'error');
        return false;
      }
    },
    [toastStore, t, loadProfiles],
  );

  /** A card's photo, sent as the portal sends it: uploaded, then put on that profile. */
  const uploadPhoto = useCallback(
    async (profile: PatientProfile, file: UploadFile): Promise<boolean> => {
      const code = profile?.patientCode ?? '';
      if (!code) return false;

      setPhotoUploadingCode(code);
      try {
        await PatientRepository.updateFamilyPhoto(file, code);
        toastStore.show(t('photoPicker.uploaded'), 'success');
        loadProfiles();
        if (profile?.relationship === 'self') onOwnProfileChanged?.();
        return true;
      } catch (error: any) {
        console.log('[Family] uploadPhoto error ==>', error?.message);
        toastStore.show(serverMessageOf(error) || t('photoPicker.uploadFailed'), 'error');
        return false;
      } finally {
        setPhotoUploadingCode('');
      }
    },
    [toastStore, t, loadProfiles, onOwnProfileChanged],
  );

  return {
    profiles: profilesRequest?.data ?? [],
    isLoading: profilesRequest?.isLoading ?? false,
    /** Null once read; otherwise the server's words, '' when it sent none. */
    error: profilesRequest?.error ?? null,
    reload: loadProfiles,
    records,
    loadRecords,
    addCondition,
    removeCondition,
    addAllergy,
    removeAllergy,
    saveMember,
    removeMember,
    uploadPhoto,
    photoUploadingCode,
  };
};

export type FamilyProfilesViewModel = ReturnType<typeof useFamilyProfilesViewModel>;

export default useFamilyProfilesViewModel;
