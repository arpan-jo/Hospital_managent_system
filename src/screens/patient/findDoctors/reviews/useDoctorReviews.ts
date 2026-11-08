import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DoctorReviewRepository,
  DoctorReviewSummary,
  PatientRepository,
  serverMessageOf,
  useStores,
} from '@app/core';
import { emitDoctorRated } from './doctorRatedEvents';

/**
 * One doctor's reviews and the way to rate them, as the portal runs it. From
 * a visit the patient is known; from the doctor's own page the account's
 * first profile rates, as on the portal.
 */
export const useDoctorReviews = (
  employeeId: number,
  options?: { appointmentId?: number | null; patientRegistrationId?: number | null },
) => {
  const { t } = useTranslation();
  const { toastStore } = useStores();
  const doctorId = Number(employeeId ?? 0) || 0;
  const knownRegistrationId = Number(options?.patientRegistrationId ?? 0) || 0;
  const appointmentId = Number(options?.appointmentId ?? 0) || 0;

  const [summary, setSummary] = useState<DoctorReviewSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** Null once read; the server's words ('' for none) when it failed. */
  const [error, setError] = useState<string | null>(null);
  const [firstProfileId, setFirstProfileId] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (quiet = false) => {
      if (!doctorId) {
        setIsLoading(false);
        return;
      }
      if (!quiet) setIsLoading(true);
      try {
        const response = await DoctorReviewRepository.getReviews(doctorId);
        if (!isMountedRef.current) return;
        setSummary(response);
        setError(null);
      } catch (e: any) {
        console.log('getDoctorReviews error ==>', e?.message);
        if (isMountedRef.current && !quiet) setError(serverMessageOf(e));
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    },
    [doctorId],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (knownRegistrationId) return;
    PatientRepository.getAllProfiles()
      .then(profiles => {
        if (isMountedRef.current) setFirstProfileId(Number(profiles?.[0]?.registrationId ?? 0) || 0);
      })
      .catch((e: any) => console.log('getAllProfiles (reviews) error ==>', e?.message));
  }, [knownRegistrationId]);

  const registrationId = knownRegistrationId || firstProfileId;
  const mine = summary?.reviews?.find(review => review?.isMine) ?? null;

  /** True once saved; the caller closes its form then. */
  const submit = useCallback(
    async (rating: number, comment: string): Promise<boolean> => {
      if (!doctorId || !registrationId || rating < 1 || isSubmitting) return false;
      setIsSubmitting(true);
      try {
        await DoctorReviewRepository.addReview({
          doctorEmployeeId: doctorId,
          patientRegistrationId: registrationId,
          appointmentId: appointmentId || null,
          rating,
          comment,
        });
        // The backend answers with the saved review and no words of its own.
        toastStore.show(t('reviews.thanks'), 'success');
        // The doctor lists show the stars too: they read again, as the portal's does.
        emitDoctorRated(doctorId);
        await load(true);
        return true;
      } catch (e: any) {
        console.log('addDoctorReview error ==>', e?.message);
        toastStore.show(serverMessageOf(e) || t('common.somethingWentWrong'), 'error');
        return false;
      } finally {
        if (isMountedRef.current) setIsSubmitting(false);
      }
    },
    [doctorId, registrationId, appointmentId, isSubmitting, toastStore, t, load],
  );

  return {
    summary,
    isLoading,
    error,
    retry: () => load(),
    /** The form shows only when the account may rate and a profile is known to rate as. */
    canReview: !!summary?.canReview && !!registrationId,
    mine,
    isSubmitting,
    submit,
  };
};

export type DoctorReviewsViewModel = ReturnType<typeof useDoctorReviews>;
