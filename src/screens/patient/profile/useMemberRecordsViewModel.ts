import { useCallback, useEffect, useState } from 'react';
import {
  Allergy,
  AllergySeverity,
  ConditionStatus,
  MedicalCondition,
  PatientRepository,
} from '@app/core';
import { RequestState } from '../findDoctors/useFindDoctorsViewModel';

const EMPTY_CONDITIONS: RequestState<MedicalCondition[]> = {
  isLoading: false,
  data: [],
  error: null,
};

const EMPTY_ALLERGIES: RequestState<Allergy[]> = {
  isLoading: false,
  data: [],
  error: null,
};

/**
 * One relative's medical history and allergies.
 *
 * These are the same six calls the account holder's own records use — every one
 * of them already takes a `patientCode` query param, so the only difference is
 * that this hook always passes one. It is deliberately separate from
 * `useProfileViewModel`: that hook owns the signed-in patient's own records and
 * its `memberRecords` cache is read-only, feeding the counts on the family tab.
 */
export const useMemberRecordsViewModel = (patientCode: string) => {
  const [conditionsRequest, setConditionsRequest] = useState<
    RequestState<MedicalCondition[]>
  >({ ...EMPTY_CONDITIONS, isLoading: true });

  const [allergiesRequest, setAllergiesRequest] = useState<RequestState<Allergy[]>>({
    ...EMPTY_ALLERGIES,
    isLoading: true,
  });

  const loadConditions = useCallback(async () => {
    // A deep link can land here without a code — nothing to scope a read to.
    if (!patientCode) {
      setConditionsRequest(EMPTY_CONDITIONS);
      return;
    }

    setConditionsRequest(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await PatientRepository.getConditions(patientCode);
      setConditionsRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('[MemberRecords] getConditions error ==>', error?.message);
      setConditionsRequest({
        isLoading: false,
        data: [],
        error: error?.message ?? null,
      });
    }
  }, [patientCode]);

  const loadAllergies = useCallback(async () => {
    if (!patientCode) {
      setAllergiesRequest(EMPTY_ALLERGIES);
      return;
    }

    setAllergiesRequest(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await PatientRepository.getAllergies(patientCode);
      setAllergiesRequest({ isLoading: false, data: response ?? [], error: null });
    } catch (error: any) {
      console.log('[MemberRecords] getAllergies error ==>', error?.message);
      setAllergiesRequest({
        isLoading: false,
        data: [],
        error: error?.message ?? null,
      });
    }
  }, [patientCode]);

  useEffect(() => {
    loadConditions();
    loadAllergies();
  }, [loadConditions, loadAllergies]);

  const addCondition = useCallback(
    async (input: {
      name: string;
      diagnosedDate: string;
      status: ConditionStatus;
      notes: string;
    }) => {
      if (!patientCode) return;

      try {
        const created = await PatientRepository.addCondition(input, patientCode);
        setConditionsRequest(prev => ({
          ...prev,
          data: [...(prev?.data ?? []), created],
        }));
      } catch (error: any) {
        console.log('[MemberRecords] addCondition error ==>', error?.message);
      }
    },
    [patientCode],
  );

  const removeCondition = useCallback(
    async (id: string) => {
      if (!patientCode) return;

      try {
        await PatientRepository.removeCondition(id, patientCode);
        setConditionsRequest(prev => ({
          ...prev,
          data: prev?.data?.filter(item => item?.id !== id) ?? [],
        }));
      } catch (error: any) {
        console.log('[MemberRecords] removeCondition error ==>', error?.message);
      }
    },
    [patientCode],
  );

  const addAllergy = useCallback(
    async (input: { name: string; severity: AllergySeverity; reaction: string }) => {
      if (!patientCode) return;

      try {
        const created = await PatientRepository.addAllergy(input, patientCode);
        setAllergiesRequest(prev => ({
          ...prev,
          data: [...(prev?.data ?? []), created],
        }));
      } catch (error: any) {
        console.log('[MemberRecords] addAllergy error ==>', error?.message);
      }
    },
    [patientCode],
  );

  const removeAllergy = useCallback(
    async (id: string) => {
      if (!patientCode) return;

      try {
        await PatientRepository.removeAllergy(id, patientCode);
        setAllergiesRequest(prev => ({
          ...prev,
          data: prev?.data?.filter(item => item?.id !== id) ?? [],
        }));
      } catch (error: any) {
        console.log('[MemberRecords] removeAllergy error ==>', error?.message);
      }
    },
    [patientCode],
  );

  return {
    conditions: conditionsRequest?.data ?? [],
    isConditionsLoading: conditionsRequest?.isLoading ?? false,
    allergies: allergiesRequest?.data ?? [],
    isAllergiesLoading: allergiesRequest?.isLoading ?? false,
    addCondition,
    removeCondition,
    addAllergy,
    removeAllergy,
  };
};

export default useMemberRecordsViewModel;
