/**
 * The patient portal's doctor directory: a paged, server-filtered search, the
 * options its filters offer, and one doctor by id. These are the calls the
 * web's Find Doctors page makes, with the same parameters.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';

/** One doctor as the portal lists them — `PortalDoctorDto` on the API. */
export interface PortalDoctor {
  /** What identifies a doctor everywhere in the portal: the list, the profile, a booking. */
  employeeId: number;
  fullName: string;
  /** The doctor's designation, e.g. "Senior Consultant". */
  specialty: string;
  departmentName: string;
  gender: string;
  /** A stored file's id or a full url; '' when the doctor has no photo. */
  photoUrl: string;
  experienceYears: number;
  consultationFee: number;
  followUpFee: number;
  location: string;
  /** Bookable weekdays as the API names them — "Mon", "Tue", … */
  availableDays: string[];
  isAvailable: boolean;
  accountId: number;
  branchId: number;
  officeId: number;
}

export interface PortalDoctorPage {
  data: PortalDoctor[];
  /** How many doctors match in all, not how many this page holds. */
  totalCount: number;
}

export interface PortalDoctorFilterOptions {
  departments: string[];
  specialties: string[];
  genders: string[];
}

export interface PortalDoctorSearchParams {
  /** Matched server-side against name, specialty and department. */
  search?: string;
  department?: string;
  gender?: string;
  /**
   * A weekday abbreviation ("Mon" … "Sun"). "Today" is resolved to one before
   * it is sent, so the day is the patient's own rather than the server's.
   */
  availableDay?: string;
  availableOnly?: boolean;
  sortBy?: 'name' | 'experience';
  /** Zero-based. */
  pageNo?: number;
  pageSize?: number;
}

export const PORTAL_DOCTOR_PAGE_SIZE = 12;

const toText = (value: any): string => String(value ?? '').trim();

const toNumber = (value: any): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Words kept exactly as sent — a filter value goes back to the API verbatim. */
const toOptionList = (raw: any): string[] =>
  Array.isArray(raw)
    ? raw
        ?.map((item: any) => String(item ?? ''))
        ?.filter(item => item?.trim()) ?? []
    : [];

/** Defensive mapping — every field on the payload can come back null. */
export const toPortalDoctor = (raw: any): PortalDoctor => ({
  employeeId: toNumber(raw?.employeeId),
  fullName: toText(raw?.fullName),
  specialty: toText(raw?.specialty),
  departmentName: toText(raw?.departmentName),
  gender: toText(raw?.gender),
  photoUrl: toText(raw?.photoUrl),
  experienceYears: toNumber(raw?.experienceYears),
  consultationFee: toNumber(raw?.consultationFee),
  followUpFee: toNumber(raw?.followUpFee),
  location: toText(raw?.location),
  availableDays: Array.isArray(raw?.availableDays)
    ? raw?.availableDays?.map(toText)?.filter(Boolean) ?? []
    : [],
  isAvailable: Boolean(raw?.isAvailable),
  accountId: toNumber(raw?.accountId),
  branchId: toNumber(raw?.branchId),
  officeId: toNumber(raw?.officeId),
});

/**
 * The query as the web builds it: an empty filter is left out rather than sent
 * blank, the search is trimmed, and the page always goes.
 */
const toSearchQuery = (params?: PortalDoctorSearchParams) => {
  const query: Record<string, string | number | boolean> = {};

  const search = params?.search?.trim();
  if (search) query.search = search;
  if (params?.department) query.department = params.department;
  if (params?.gender) query.gender = params.gender;
  if (params?.availableDay) query.availableDay = params.availableDay;
  if (params?.availableOnly) query.availableOnly = true;
  if (params?.sortBy) query.sortBy = params.sortBy;
  query.pageNo = params?.pageNo ?? 0;
  query.pageSize = params?.pageSize ?? PORTAL_DOCTOR_PAGE_SIZE;

  return query;
};

export const FindDoctorsRepository = {
  /** `GET /hms/portal/doctors/SearchDoctors` — one page of the matching doctors. */
  searchDoctors: async (
    params?: PortalDoctorSearchParams,
  ): Promise<PortalDoctorPage> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalDoctorsSearch,
      method: 'GET',
      baseUrl: API_URL,
      params: toSearchQuery(params),
      isConsole: true,
      isConsoleParams: true,
    };
    const response = await apiRequest<any>(api_params);

    const data = Array.isArray(response?.data)
      ? response?.data?.map(toPortalDoctor) ?? []
      : [];

    return {
      data,
      // Never below what this page holds, even if the payload left the count out.
      totalCount: Math.max(toNumber(response?.totalCount), data.length),
    };
  },

  /** `GET /hms/portal/doctors/GetFilterOptions` — what the filters can offer. */
  getFilterOptions: async (): Promise<PortalDoctorFilterOptions> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalDoctorFilterOptions,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return {
      departments: toOptionList(response?.departments),
      specialties: toOptionList(response?.specialties),
      genders: toOptionList(response?.genders),
    };
  },

  /** `GET /hms/portal/doctors/GetDoctorById?employeeId=` — null when there is no such doctor. */
  getDoctorById: async (employeeId: number): Promise<PortalDoctor | null> => {
    const id = toNumber(employeeId);
    if (!id) return null;

    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalDoctorById,
      method: 'GET',
      baseUrl: API_URL,
      params: { employeeId: id },
    };
    const response = await apiRequest<any>(api_params);

    return toNumber(response?.employeeId) ? toPortalDoctor(response) : null;
  },
};

export default FindDoctorsRepository;
