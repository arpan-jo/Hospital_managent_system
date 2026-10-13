import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';

/**
 * `strStatus` on tblFollowUps — nvarchar(20) with no check constraint,
 * defaulting to `pending`. These three are the only values in the table, and
 * they map one-to-one onto the list's three tabs.
 */
export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';

const FOLLOW_UP_STATUSES: FollowUpStatus[] = [
  'pending',
  'completed',
  'cancelled',
];

/**
 * The four buckets the list tabs through. `overdue` is not a stored status — it
 * is derived from the scheduled date, so it can never go stale the way a
 * nightly "mark missed" job would.
 */
export type FollowUpBucket = FollowUpStatus | 'overdue';

export const FOLLOW_UP_BUCKETS: FollowUpBucket[] = [
  'pending',
  'overdue',
  'completed',
  'cancelled',
];

/**
 * One row of `GET /api/followups` — the signed-in patient's own visits. The
 * payload carries the doctor's details on every row, so the list needs no
 * separate doctor lookup.
 */
export interface FollowUp {
  id: string;
  /** `doctorUserId`. */
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  /** Blob name — run it through `getFileUrl` before rendering. */
  doctorPhotoUrl: string;
  /** `patientUserId`. */
  patientId: string;
  patientName: string;
  patientCode: string;
  patientPhone: string;
  /** Blob name — run it through `getFileUrl` before rendering. */
  patientPhotoUrl: string;
  status: FollowUpStatus;
  /** 'YYYY-MM-DD' — `scheduledDate` on the payload. */
  date: string;
  /** 24h 'HH:mm' — `scheduledTime` on the payload. */
  time: string;
  /** Why the doctor scheduled it, e.g. "follow up — 1 Days". */
  reason: string;
  /** Clinical notes the doctor wrote against the visit. */
  notes: string;
  /** Days until (positive) or since (negative) the visit, derived from `date`. */
  daysFromNow: number;
  /** The consultation that scheduled this visit, when it came from one. */
  consultationId: string;
  createdAt: string;
  reminderSent: boolean;
}

const toText = (value: any): string => String(value ?? '').trim();

/** Whole days between today and 'YYYY-MM-DD'. */
const daysUntil = (date: string): number => {
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

/** Anything the API has not seen before is treated as still pending. */
const toStatus = (raw: any): FollowUpStatus => {
  const status = toText(raw)?.toLowerCase() as FollowUpStatus;
  return FOLLOW_UP_STATUSES?.includes(status) ? status : 'pending';
};

/** Defensive mapping — every field on the payload can come back null. */
const toFollowUp = (raw: any): FollowUp => {
  const date = toText(raw?.scheduledDate)?.slice(0, 10) ?? '';

  return {
    id: toText(raw?.followUpId),
    doctorId: toText(raw?.doctorUserId),
    doctorName: toText(raw?.doctorName),
    doctorSpecialty: toText(raw?.doctorSpecialty),
    doctorPhotoUrl: toText(raw?.doctorPhotoUrl),
    patientId: toText(raw?.patientUserId),
    patientName: toText(raw?.patientName),
    patientCode: toText(raw?.patientCode),
    patientPhone: toText(raw?.patientPhone),
    patientPhotoUrl: toText(raw?.patientPhotoUrl),
    status: toStatus(raw?.status),
    date,
    time: toText(raw?.scheduledTime)?.slice(0, 5) ?? '',
    reason: toText(raw?.reason),
    notes: toText(raw?.doctorNotes),
    daysFromNow: daysUntil(date),
    consultationId: toText(raw?.consultationId),
    createdAt: toText(raw?.createdAt),
    reminderSent: Boolean(raw?.reminderSent),
  };
};

/**
 * `GET /api/followups` answers with a bare array of rows. Anything else — an
 * error envelope that came back on a 200, or a payload whose shape changed — is
 * a failure, not an empty list, so it is thrown for the caller's `catch` to
 * report instead of the screen quietly rendering "no follow-ups".
 */
const toFollowUpList = (response: any): FollowUp[] => {
  if (Array.isArray(response)) return response.map(toFollowUp);

  // Tolerate the rows arriving wrapped, the way some endpoints return them.
  const rows = response?.data ?? response?.items;
  if (Array.isArray(rows)) return rows.map(toFollowUp);

  throw new Error(
    toText(response?.message) || 'Could not read follow-ups from the server.',
  );
};

/**
 * Which tab a row belongs under. A still-pending visit whose date has passed is
 * overdue, not upcoming — the same derivation the doctor's roster uses, so both
 * sides of the app agree on what counts as late.
 */
export const followUpBucket = (followUp?: FollowUp): FollowUpBucket => {
  const status = followUp?.status ?? 'pending';
  if (status !== 'pending') return status;

  return (followUp?.daysFromNow ?? 0) < 0 ? 'overdue' : 'pending';
};

export const PatientFollowUpRepository = {
  /**
   * `GET /api/followups`. The token identifies the patient, so the list comes
   * back already scoped to them — the patient's list is read-only, scheduling
   * and closing a visit are the doctor's actions.
   */
  getFollowUps: async (): Promise<FollowUp[]> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.followUps,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);

    return toFollowUpList(response);
  },
};

export default PatientFollowUpRepository;
