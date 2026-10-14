/**
 * How the portal sorts follow-ups into its tabs. Kept apart from the
 * repository so it can be tested without the network layer.
 */
import { toISODate } from './format';

/** `tblFollowUps.strStatus` — the only three values the table holds. */
export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';

/** The four tabs. `overdue` is not stored: a pending follow-up whose date has passed. */
export type FollowUpBucket = 'upcoming' | 'overdue' | 'completed' | 'cancelled';

export const FOLLOW_UP_BUCKETS: FollowUpBucket[] = ['upcoming', 'overdue', 'completed', 'cancelled'];

/** Anything the API has not sent before reads as still pending, as on the portal. */
export const toFollowUpStatus = (raw: unknown): FollowUpStatus => {
  const status = String(raw ?? '').trim().toLowerCase();
  return status === 'completed' || status === 'cancelled' ? status : 'pending';
};

/**
 * The tab a follow-up belongs under — late by the patient's own calendar,
 * which is why the server leaves "overdue" to the caller.
 */
export const followUpBucket = (
  followUp?: { status?: FollowUpStatus | null; date?: string | null } | null,
  today: string = toISODate(new Date()),
): FollowUpBucket => {
  const status = toFollowUpStatus(followUp?.status);
  if (status !== 'pending') return status;
  return String(followUp?.date ?? '') < today ? 'overdue' : 'upcoming';
};
