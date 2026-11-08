/**
 * Patients' reviews of a doctor, as the portal reads and writes them:
 * `GET /hms/portal/doctors/GetReviews` for the stars, the list and whether the
 * caller may rate, and `POST …/AddReview` to rate — a second rating from the
 * same patient for the same doctor replaces the first.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';

/** The backend refuses a longer comment. */
export const REVIEW_COMMENT_MAX = 1000;

export interface DoctorReview {
  reviewId: number;
  doctorEmployeeId: number;
  /** 1 to 5. */
  rating: number;
  comment: string;
  createdAt: string;
  /** First name and an initial only — "Rahim U."; '' when unknown. */
  patientName: string;
  /** Written by the signed-in account. */
  isMine: boolean;
}

export interface DoctorReviewSummary {
  doctorEmployeeId: number;
  reviewCount: number;
  /** Null until someone has rated. */
  averageRating: number | null;
  /** The account has had an appointment with this doctor, so may rate them. */
  canReview: boolean;
  reviews: DoctorReview[];
}

export interface AddDoctorReviewInput {
  doctorEmployeeId: number;
  /** Whose visit the rating is for — one of the account's own profiles. */
  patientRegistrationId: number;
  /** Sent when rating from a visit; left out from the doctor's page. */
  appointmentId?: number | null;
  rating: number;
  comment?: string | null;
}

const toText = (value: any): string => String(value ?? '').trim();
const toNumber = (value: any): number => Number(value ?? 0) || 0;

/** A star count the screen can draw: whole, 0 to 5. */
const toRating = (value: any): number => Math.min(Math.max(Math.round(toNumber(value)), 0), 5);

/** An average as sent, or null when there is none yet. */
export const toAverageRating = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const average = Number(value);
  return Number.isFinite(average) ? average : null;
};

export const toDoctorReview = (raw: any): DoctorReview => ({
  reviewId: toNumber(raw?.reviewId),
  doctorEmployeeId: toNumber(raw?.doctorEmployeeId),
  rating: toRating(raw?.rating),
  comment: String(raw?.comment ?? '').trim(),
  createdAt: toText(raw?.createdAt),
  patientName: toText(raw?.patientName),
  isMine: Boolean(raw?.isMine),
});

export const toDoctorReviewSummary = (raw: any, employeeId = 0): DoctorReviewSummary => ({
  doctorEmployeeId: toNumber(raw?.doctorEmployeeId) || employeeId,
  reviewCount: toNumber(raw?.reviewCount),
  averageRating: toAverageRating(raw?.averageRating),
  canReview: Boolean(raw?.canReview),
  reviews: (Array.isArray(raw?.reviews) ? raw.reviews : []).map(toDoctorReview),
});

export const DoctorReviewRepository = {
  getReviews: async (employeeId: number): Promise<DoctorReviewSummary> => {
    const id = toNumber(employeeId);
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalDoctorReviews,
      method: 'GET',
      baseUrl: API_URL,
      params: { employeeId: id },
    };
    const response = await apiRequest<any>(api_params);
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      throw new Error('Unexpected reviews response');
    }
    return toDoctorReviewSummary(response, id);
  },

  /**
   * 400 with the reason for a bad rating or a long comment; 403 when the
   * patient has had no appointment with the doctor. Both carry the server's words.
   */
  addReview: async (input: AddDoctorReviewInput): Promise<DoctorReview> => {
    const comment = String(input?.comment ?? '').trim();
    const appointmentId = toNumber(input?.appointmentId);
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.portalDoctorAddReview,
      method: 'POST',
      baseUrl: API_URL,
      data: {
        doctorEmployeeId: toNumber(input?.doctorEmployeeId),
        patientRegistrationId: toNumber(input?.patientRegistrationId),
        appointmentId: appointmentId || null,
        rating: toRating(input?.rating),
        comment: comment || null,
      },
    };
    const response = await apiRequest<any>(api_params);
    return toDoctorReview(response);
  },
};

export default DoctorReviewRepository;
