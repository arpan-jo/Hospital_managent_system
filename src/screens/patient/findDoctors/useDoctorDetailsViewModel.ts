import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DoctorDetailsInfo,
  DoctorDetailsRepository,
  DoctorLocation,
  DoctorReviewSummary,
  groupThousands,
} from '@app/core';
import { RequestState } from './useFindDoctorsViewModel';

/** One day + one time window, flattened so the screen renders a single list. */
export interface DoctorScheduleRow {
  key: string;
  dayOfWeek: string;
  /** 0 = Sunday, matching the `days` locale block. -1 when the API day is unknown. */
  dayIndex: number;
  startTime: string;
  endTime: string;
  availableCount: number;
  maxCapacity: number;
}

const EMPTY_DETAILS_REQUEST: RequestState<DoctorDetailsInfo | null> = {
  isLoading: false,
  data: null,
  error: null,
};

const EMPTY_REVIEWS: DoctorReviewSummary = {
  reviews: [],
  totalCount: 0,
  averageRating: 0,
  ratingBreakdown: [0, 0, 0, 0, 0],
};

const EMPTY_REVIEWS_REQUEST: RequestState<DoctorReviewSummary> = {
  isLoading: false,
  data: EMPTY_REVIEWS,
  error: null,
};

/**
 * Audio and video calls are switched off — on the portal (its own
 * `CALLS_ENABLED`) and in the app, which has no calling at all — so their
 * options are not offered. Flip back to true once calling ships.
 */
const CALLS_ENABLED = false;
const CALL_OPTION_TYPES = ['audio', 'video'];

/**
 * Everything the Doctor Details screen shows comes from `GET /api/doctors/{id}`.
 * The screen stays a pure view: fetching, chamber selection and the derived
 * labels all live here.
 */
export const useDoctorDetailsViewModel = (doctorId: string) => {
  const { t } = useTranslation();

  const [doctorDetailsRequest, setDoctorDetailsRequest] = useState<
    RequestState<DoctorDetailsInfo | null>
  >({ ...EMPTY_DETAILS_REQUEST, isLoading: true });

  const [reviewsRequest, setReviewsRequest] = useState<
    RequestState<DoctorReviewSummary>
  >({ ...EMPTY_REVIEWS_REQUEST, isLoading: true });

  const [selectedLocationId, setSelectedLocationId] = useState('');

  const fetchDoctorDetails = useCallback(async () => {
    // A deep link can land on this screen without an id — nothing to fetch.
    if (!doctorId) {
      setDoctorDetailsRequest(EMPTY_DETAILS_REQUEST);
      return;
    }

    setDoctorDetailsRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await DoctorDetailsRepository.getDoctorDetails(doctorId);
      setDoctorDetailsRequest({
        isLoading: false,
        data: response ?? null,
        error: null,
      });
      setSelectedLocationId(response?.locations?.[0]?.locationId ?? '');
    } catch (error: any) {
      console.log('fetchDoctorDetails error ==>', error?.message);
      setDoctorDetailsRequest({
        isLoading: false,
        data: null,
        error: error?.message ?? null,
      });
    }
  }, [doctorId]);

  const fetchDoctorReviews = useCallback(async () => {
    // A deep link can land on this screen without an id — nothing to fetch.
    if (!doctorId) {
      setReviewsRequest(EMPTY_REVIEWS_REQUEST);
      return;
    }

    setReviewsRequest(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await DoctorDetailsRepository.getDoctorReviews(doctorId);
      setReviewsRequest({
        isLoading: false,
        data: response ?? EMPTY_REVIEWS,
        error: null,
      });
    } catch (error: any) {
      console.log('fetchDoctorReviews error ==>', error?.message);
      setReviewsRequest({
        isLoading: false,
        data: EMPTY_REVIEWS,
        error: error?.message ?? null,
      });
    }
  }, [doctorId]);

  useEffect(() => {
    fetchDoctorDetails();
  }, [fetchDoctorDetails]);

  useEffect(() => {
    fetchDoctorReviews();
  }, [fetchDoctorReviews]);

  const doctor = doctorDetailsRequest?.data ?? null;

  /** Falls back to the first chamber, so fees/schedule always have a source. */
  const selectedLocation = useMemo<DoctorLocation | null>(
    () =>
      doctor?.locations?.find(
        location => location?.locationId === selectedLocationId,
      ) ??
      doctor?.locations?.[0] ??
      null,
    [doctor, selectedLocationId],
  );

  const scheduleRows = useMemo<DoctorScheduleRow[]>(() => {
    const rows: DoctorScheduleRow[] = [];

    selectedLocation?.schedule?.forEach(day =>
      day?.timeSlots?.forEach(slot =>
        rows?.push({
          key: `${day?.dayOfWeek}-${slot?.startTime}-${slot?.endTime}`,
          dayOfWeek: day?.dayOfWeek ?? '',
          dayIndex: day?.dayIndex ?? -1,
          startTime: slot?.startTime ?? '',
          endTime: slot?.endTime ?? '',
          availableCount: slot?.availableCount ?? 0,
          maxCapacity: slot?.maxCapacity ?? 0,
        }),
      ),
    );

    return rows;
  }, [selectedLocation]);

  const taka = useCallback(
    (amount?: number | null) => `৳${groupThousands(amount ?? 0)}`,
    [],
  );

  /** "৳1,200 - ৳1,600", or a single amount when the chambers charge the same. */
  const feeRangeLabel = useMemo(() => {
    const min = doctor?.minFee ?? 0;
    const max = doctor?.maxFee ?? 0;

    if (!min && !max) return t('common.na');
    if (!max || min === max) return taka(min || max);
    return `${taka(min)} - ${taka(max)}`;
  }, [doctor?.minFee, doctor?.maxFee, t, taka]);

  /** The API has no bio field — the About blurb is built from the profile facts. */
  const aboutSummary = useMemo(() => {
    if (!doctor) return '';

    const role =
      [doctor?.specialty, doctor?.designation]?.filter(Boolean)?.join(', ') ??
      '';

    return t('doctorProfile.aboutSummary', {
      name: doctor?.name || t('common.na'),
      role: role || t('common.na'),
      hospital: doctor?.hospital || t('common.na'),
      years: doctor?.experienceYears ?? 0,
    });
  }, [doctor, t]);

  const enabledConsultationOptions = useMemo(
    () =>
      doctor?.consultationOptions?.filter(
        option =>
          option?.enabled &&
          (CALLS_ENABLED || !CALL_OPTION_TYPES.includes(String(option?.type ?? '').toLowerCase())),
      ) ?? [],
    [doctor?.consultationOptions],
  );

  const siteCount = doctor?.locations?.length ?? 0;

  return {
    doctorDetailsRequest,
    doctor,
    fetchDoctorDetails,
    reviewsRequest,
    fetchDoctorReviews,
    selectedLocation,
    selectedLocationId: selectedLocation?.locationId ?? '',
    selectLocation: setSelectedLocationId,
    scheduleRows,
    enabledConsultationOptions,
    feeRangeLabel,
    aboutSummary,
    siteCount,
    taka,
  };
};

export default useDoctorDetailsViewModel;
