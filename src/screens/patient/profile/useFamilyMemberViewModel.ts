import { useCallback, useState } from 'react';
import {
  FamilyMember,
  FileRepository,
  NewFamilyMember,
  PatientRepository,
  UploadFile,
  toISODate,
} from '@app/core';

export interface FamilyMemberForm extends Omit<NewFamilyMember, 'dateOfBirth'> {
  dateOfBirth?: Date;
}

export const EMPTY_MEMBER_FORM: FamilyMemberForm = {
  fullName: '',
  relationship: 'Spouse',
  gender: '',
  bloodType: '',
  dateOfBirth: undefined,
  phone: '',
  email: '',
  address: '',
  emergencyContact: '',
  emergencyPhone: '',
};

/**
 * Saves one family member — POST for a new relative, PUT when an existing
 * `patientCode` is being edited. Validation itself lives in the form (see
 * `useProfileFormRules`), so this only owns the call and its loader.
 */
export const useFamilyMemberViewModel = (patientCode?: string) => {
  const [isSaving, setIsSaving] = useState(false);

  const submit = useCallback(
    async (values: FamilyMemberForm, photo?: UploadFile): Promise<FamilyMember | null> => {
      setIsSaving(true);
      try {
        // A photo picked before the row exists is uploaded first, so its blob
        // name can go out with the create call rather than a second request.
        const photoUrl = photo ? await FileRepository.upload(photo) : undefined;

        const payload: NewFamilyMember = {
          ...values,
          fullName: values?.fullName?.trim() ?? '',
          dateOfBirth: values?.dateOfBirth ? toISODate(values.dateOfBirth) : '',
          ...(photoUrl ? { photoUrl } : {}),
        };

        return patientCode
          ? await PatientRepository.updateFamilyMember(patientCode, payload)
          : await PatientRepository.addFamilyMember(payload);
      } catch (error: any) {
        console.log('[FamilyMember] save error ==>', error?.message);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [patientCode],
  );

  return { isSaving, submit };
};

export default useFamilyMemberViewModel;
