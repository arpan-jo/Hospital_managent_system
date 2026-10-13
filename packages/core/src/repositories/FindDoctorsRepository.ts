import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';

export type DoctorGender = 'Male' | 'Female';

export type DoctorFilterResponse = {
  specialties: string[];
  locations: string[];
};

export interface DoctorSummary {
  id: string;
  name: string;
  specialty: string;
  secondarySpecialty: string;
  designation: string;
  qualification: string;
  experienceYears: number;
  minFee: number;
  maxFee: number;
  photoUrl: string;
  hospital: string;
  department: string;
  gender: DoctorGender | '';
  locations: string[];
  isAvailable: boolean;
  /**
   * Weekdays any of the doctor's chambers is open, as indexes into the `days`
   * locale block (0 = Sunday). `[]` when they have published none; `null` when
   * the source sends no such list — the AI finder's suggestions, or a backend
   * deployed before the field existed — and the card then shows no week row.
   */
  availableDays: number[] | null;
}

export interface DoctorListQuery {
  specialty?: string;
  location?: string;
  gender?: string;
  availability?: string;
  search?: string;
}

const toDoctorListParams = (query?: DoctorListQuery) => {
  const params: Record<string, string> = {};

  if (query?.specialty) params.specialty = query?.specialty;
  if (query?.location) params.location = query?.location;
  if (query?.gender) params.gender = query?.gender;
  if (query?.availability) params.availability = query?.availability;
  if (query?.search?.trim()) params.search = query?.search?.trim();

  return params;
};

const toText = (value: any): string => String(value ?? '').trim();

const toNumber = (value: any): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toTextList = (raw: any): string[] =>
  Array.isArray(raw) ? raw?.map(toText)?.filter(Boolean) ?? [] : [];

const toFilterValueList = (raw: any): string[] =>
  Array.isArray(raw)
    ? raw
        ?.map((item: any) => String(item ?? ''))
        ?.filter(item => item?.trim()) ?? []
    : [];

const toQualification = (raw: any): string =>
  [raw?.degree1, raw?.degree2, raw?.fellowship]
    ?.map(toText)
    ?.filter(Boolean)
    ?.join(', ') ?? '';

const toGender = (raw: any): DoctorGender | '' => {
  const gender = toText(raw);
  return gender === 'Male' || gender === 'Female' ? gender : '';
};

/** The API's day words, as indexes into the `days` locale block (0 = Sunday). */
const DAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/**
 * `availableDays` ("Mon", "Tue", …) as day indexes, unknown words dropped.
 * `null` when the payload has no such list at all, which is not the same as a
 * doctor who has published no days.
 */
const toAvailableDays = (raw: any): number[] | null => {
  if (!Array.isArray(raw)) return null;

  const indexes = raw
    ?.map(day => DAY_INDEX[toText(day).slice(0, 3).toLowerCase()])
    ?.filter((index): index is number => index !== undefined);
  return [...new Set(indexes ?? [])];
};

/**
 * One doctor as the list shows them. Exported for the AI doctor finder, whose
 * suggestions carry the same fields as `GET /api/doctors`.
 */
export const toDoctorSummary = (raw: any): DoctorSummary => ({
  id: toText(raw?.userId),
  name: toText(raw?.fullName),
  specialty: toText(raw?.primarySpecialization),
  secondarySpecialty: toText(raw?.secondarySpecialization),
  designation: toText(raw?.designation),
  qualification: toQualification(raw),
  // `||`, as the portal reads it: the API sends 0 for a figure nobody filled
  // in, which must not hide the other one.
  experienceYears: toNumber(raw?.totalExperience) || toNumber(raw?.yearsOfPractice),
  minFee: toNumber(raw?.minConsultationFee),
  maxFee: toNumber(raw?.maxConsultationFee),
  photoUrl: toText(raw?.photoUrl),
  hospital: toText(raw?.hospitalClinic),
  department: toText(raw?.department),
  gender: toGender(raw?.gender),
  locations: toTextList(raw?.locationNames),
  isAvailable: Boolean(raw?.isAvailable),
  availableDays: toAvailableDays(raw?.availableDays),
});

export const FindDoctorsRepository = {
  getFilters: async (): Promise<DoctorFilterResponse> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.filters,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return {
      specialties: toFilterValueList(response?.specialties),
      locations: toFilterValueList(response?.locations),
    };
  },

  getDoctors: async (query?: DoctorListQuery): Promise<DoctorSummary[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.doctors,
      method: 'GET',
      baseUrl: API_URL,
      params: toDoctorListParams(query),
    };
    const response = await apiRequest<any>(api_params);

    return Array.isArray(response) ? response?.map(toDoctorSummary) ?? [] : [];
  },
};

export default FindDoctorsRepository;
