import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { DoctorGender } from './DoctorRepository';

/** One bookable window inside a day, as published by `GET /api/doctors/{id}`. */
export interface DoctorTimeSlot {
  /** "09:00" — kept raw so the view can format it with `to12Hour`. */
  startTime: string;
  endTime: string;
  maxCapacity: number;
  bookedCount: number;
  /** `maxCapacity - bookedCount`, never negative. */
  availableCount: number;
}

export interface DoctorDaySchedule {
  /** "Mon" — exactly what the API sends. */
  dayOfWeek: string;
  /** 0 = Sunday, matching the `days` block in the locale files. -1 when unknown. */
  dayIndex: number;
  timeSlots: DoctorTimeSlot[];
}

/** A chamber the doctor sits at. Fees are per location, not per doctor. */
export interface DoctorLocation {
  locationId: string;
  name: string;
  address: string;
  /** "both" | "online" | "offline" — free text on the API side. */
  consultationType: string;
  consultationFee: number;
  callFee: number;
  videoCallFee: number;
  /**
   * `null` when the chamber never set one. The server then bills the full
   * consultation fee for that visit type, so the visit is not offered at all.
   */
  followUpFee: number | null;
  /** `null` when the chamber never set one — see `followUpFee`. */
  reportFee: number | null;
  followUpValidDays: number;
  schedule: DoctorDaySchedule[];
}

export interface DoctorConsultationOption {
  optionId: string;
  /** "audio" | "video". */
  type: string;
  enabled: boolean;
  fee: number;
  durationMinutes: number;
}

/** One entry in a doctor's review feed, from `GET /api/reviews/doctor/{id}`. */
export interface DoctorReviewItem {
  id: string;
  patientName: string;
  patientPhotoUrl: string;
  rating: number;
  comment: string;
  /** 'YYYY-MM-DD' — `updatedAt` when the patient edited the review, else `createdAt`. */
  date: string;
}

export interface DoctorReviewSummary {
  reviews: DoctorReviewItem[];
  totalCount: number;
  /** 0 when nobody has reviewed this doctor yet. */
  averageRating: number;
  /** Always 5 entries: index 0 = 1-star count ... index 4 = 5-star count. */
  ratingBreakdown: number[];
}

export interface DoctorDetailsInfo {
  id: string;
  name: string;
  specialty: string;
  secondarySpecialty: string;
  designation: string;
  /** degree1 + degree2 + fellowship, joined for the one-line header. */
  qualification: string;
  /** The same three degrees as separate rows for the About tab. */
  degrees: string[];
  /** Primary/secondary specialization plus `skillsProcedures`, deduplicated. */
  specializations: string[];
  /** position1 + position2. */
  experienceHistory: string[];
  /** award1 + award2 + publications. */
  awards: string[];
  linkedIn: string;
  facebook: string;
  website: string;
  experienceYears: number;
  minFee: number;
  maxFee: number;
  photoUrl: string;
  hospital: string;
  department: string;
  gender: DoctorGender | '';
  locationNames: string[];
  isAvailable: boolean;
  locations: DoctorLocation[];
  consultationOptions: DoctorConsultationOption[];
}

const toText = (value: any): string => String(value ?? '').trim();

const toNumber = (value: any): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Optional fees keep the null the API sends; only a real number survives. */
const toOptionalNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toTextList = (raw: any): string[] =>
  Array.isArray(raw) ? raw?.map(toText)?.filter(Boolean) ?? [] : [];

/** "ECG interpretation, Angioplasty" -> ["ECG interpretation", "Angioplasty"]. */
const toCommaList = (raw: any): string[] =>
  toText(raw)
    ?.split(',')
    ?.map(item => item?.trim() ?? '')
    ?.filter(Boolean) ?? [];

/** Drops empties and case-insensitive repeats while keeping the first spelling. */
const toUniqueList = (values: string[]): string[] => {
  const seen = new Set<string>();
  return (
    values?.filter(value => {
      const key = value?.toLowerCase?.() ?? '';
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }) ?? []
  );
};

const DAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/** "Mon" / "Monday" -> 1. Unknown input returns -1 so the row can still render. */
const toDayIndex = (raw: any): number =>
  DAY_INDEX[toText(raw)?.slice(0, 3)?.toLowerCase() ?? ''] ?? -1;

const toGender = (raw: any): DoctorGender | '' => {
  const gender = toText(raw);
  return gender === 'Male' || gender === 'Female' ? gender : '';
};

const toTimeSlot = (raw: any): DoctorTimeSlot => {
  const maxCapacity = toNumber(raw?.maxCapacity);
  const bookedCount = toNumber(raw?.bookedCount);

  return {
    startTime: toText(raw?.startTime),
    endTime: toText(raw?.endTime),
    maxCapacity,
    bookedCount,
    // The API can report more bookings than capacity — clamp so "-1 left" never shows.
    availableCount: Math.max(maxCapacity - bookedCount, 0),
  };
};

const toDaySchedule = (raw: any): DoctorDaySchedule => ({
  dayOfWeek: toText(raw?.dayOfWeek),
  dayIndex: toDayIndex(raw?.dayOfWeek),
  timeSlots: Array.isArray(raw?.timeSlots)
    ? raw?.timeSlots?.map(toTimeSlot) ?? []
    : [],
});

const toLocation = (raw: any): DoctorLocation => ({
  locationId: toText(raw?.locationId),
  name: toText(raw?.name),
  address: toText(raw?.address),
  consultationType: toText(raw?.consultationType),
  consultationFee: toNumber(raw?.consultationFee),
  callFee: toNumber(raw?.callFee),
  videoCallFee: toNumber(raw?.videoCallFee),
  followUpFee: toOptionalNumber(raw?.followUpFee),
  reportFee: toOptionalNumber(raw?.reportFee),
  followUpValidDays: toNumber(raw?.followUpValidDays),
  schedule: Array.isArray(raw?.schedule)
    ? // Sunday-first, so the strip matches the `days` locale block everywhere else.
      raw?.schedule
        ?.map(toDaySchedule)
        ?.sort(
          (a: DoctorDaySchedule, b: DoctorDaySchedule) =>
            (a?.dayIndex ?? -1) - (b?.dayIndex ?? -1),
        ) ?? []
    : [],
});

const toConsultationOption = (raw: any): DoctorConsultationOption => ({
  optionId: toText(raw?.optionId),
  type: toText(raw?.type)?.toLowerCase() ?? '',
  enabled: Boolean(raw?.enabled),
  fee: toNumber(raw?.fee),
  durationMinutes: toNumber(raw?.durationMinutes),
});

const toDoctorDetails = (raw: any): DoctorDetailsInfo => {
  const degrees = [raw?.degree1, raw?.degree2, raw?.fellowship]
    ?.map(toText)
    ?.filter(Boolean) ?? [];

  return {
    id: toText(raw?.userId),
    name: toText(raw?.fullName),
    specialty: toText(raw?.primarySpecialization),
    secondarySpecialty: toText(raw?.secondarySpecialization),
    designation: toText(raw?.designation),
    qualification: degrees?.join(', ') ?? '',
    degrees,
    specializations: toUniqueList([
      toText(raw?.primarySpecialization),
      toText(raw?.secondarySpecialization),
      ...toCommaList(raw?.skillsProcedures),
    ]),
    experienceHistory: [raw?.position1, raw?.position2]
      ?.map(toText)
      ?.filter(Boolean) ?? [],
    awards: [raw?.award1, raw?.award2, raw?.publications]
      ?.map(toText)
      ?.filter(Boolean) ?? [],
    linkedIn: toText(raw?.linkedIn),
    facebook: toText(raw?.facebook),
    website: toText(raw?.website),
    // The same rule as the doctor list (`toDoctorSummary`) and the portal: total
    // experience first, and `||` because the API sends 0 for a figure nobody
    // filled in — so a doctor's card and their details never disagree.
    experienceYears: toNumber(raw?.totalExperience) || toNumber(raw?.yearsOfPractice),
    minFee: toNumber(raw?.minConsultationFee),
    maxFee: toNumber(raw?.maxConsultationFee),
    photoUrl: toText(raw?.photoUrl),
    hospital: toText(raw?.hospitalClinic),
    department: toText(raw?.department),
    gender: toGender(raw?.gender),
    locationNames: toTextList(raw?.locationNames),
    isAvailable: Boolean(raw?.isAvailable),
    locations: Array.isArray(raw?.locations)
      ? raw?.locations?.map(toLocation) ?? []
      : [],
    consultationOptions: Array.isArray(raw?.consultationOptions)
      ? raw?.consultationOptions?.map(toConsultationOption) ?? []
      : [],
  };
};

/**
 * Exported because `/api/reviews/appointment/{id}` answers with the very same
 * `DoctorReviewDto` — the appointment repository maps through this rather than
 * keeping a second copy that would drift the moment a field is added.
 */
export const toDoctorReviewItem = (raw: any): DoctorReviewItem => ({
  id: toText(raw?.reviewId),
  patientName: toText(raw?.patientName),
  patientPhotoUrl: toText(raw?.patientPhotoUrl),
  rating: toNumber(raw?.rating),
  comment: toText(raw?.comment),
  date: toText(raw?.updatedAt ?? raw?.createdAt)?.slice(0, 10) ?? '',
});

const EMPTY_RATING_BREAKDOWN = [0, 0, 0, 0, 0];

const toDoctorReviewSummary = (raw: any): DoctorReviewSummary => {
  const breakdown = Array.isArray(raw?.ratingBreakdown) ? raw?.ratingBreakdown : [];

  return {
    reviews: Array.isArray(raw?.reviews)
      ? raw?.reviews?.map(toDoctorReviewItem) ?? []
      : [],
    totalCount: toNumber(raw?.totalCount),
    averageRating: toNumber(raw?.averageRating),
    ratingBreakdown: EMPTY_RATING_BREAKDOWN?.map(
      (_, index) => toNumber(breakdown?.[index]),
    ),
  };
};

export const DoctorDetailsRepository = {
  getDoctorDetails: async (
    doctorId: string,
  ): Promise<DoctorDetailsInfo | null> => {
    const id = toText(doctorId);
    if (!id) return null;

    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.doctors}/${encodeURIComponent(id)}`,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return response ? toDoctorDetails(response) : null;
  },

  getDoctorReviews: async (
    doctorId: string,
  ): Promise<DoctorReviewSummary | null> => {
    const id = toText(doctorId);
    if (!id) return null;

    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.doctorReviews}/${encodeURIComponent(id)}`,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return response ? toDoctorReviewSummary(response) : null;
  },
};

export default DoctorDetailsRepository;
