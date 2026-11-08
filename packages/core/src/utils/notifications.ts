/**
 * Where a notification's portal link leads in the app, and when it was sent.
 * Kept apart from the repository so it can be tested without the network layer.
 */

/** Bangladesh Standard Time — the hospital's zone; no daylight saving. */
const HOSPITAL_UTC_OFFSET = '+06:00';

/**
 * A notification's `createdAt` with its offset spelled out, so `Date` reads
 * the same instant on any phone. Since 2026-11-02 the API stores and returns
 * Bangladesh wall-clock time without an offset ("2026-10-28T12:06:01.1263996"
 * is 12:06 in Dhaka), so such a value gets +06:00; one that already carries Z
 * or an offset is kept as sent. Seconds can carry up to seven decimals; they
 * are cut to milliseconds, the precision `Date` is specified to read.
 */
export const toNotificationTimestamp = (value: unknown): string => {
  const text = String(value ?? '')
    .trim()
    .replace(/(\.\d{3})\d+/, '$1');
  if (!text) return '';
  const hasOffset = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text);
  const hasTime = /T\d{2}:\d{2}/.test(text);
  return hasOffset || !hasTime ? text : `${text}${HOSPITAL_UTC_OFFSET}`;
};

/** An app screen a notification can open. */
export type NotificationTarget =
  | { screen: 'appointment'; appointmentId: number }
  /** A doctor's reply: the conversation it landed in. */
  | { screen: 'messageThread'; doctorEmployeeId: number; patientRegistrationId: number }
  | {
      screen:
        | 'messages'
        | 'homeCollection'
        | 'appointments'
        | 'followUps'
        | 'prescriptions'
        | 'reports'
        | 'findDoctors'
        | 'profile';
    };

/**
 * The app screen for a portal link: an appointment's own page, or the list a
 * section link names. Null for anything the app has no screen for — a doctor's
 * or an admin's page — which is then only marked read.
 */
export const notificationTarget = (
  link: string | null | undefined,
): NotificationTarget | null => {
  const path = String(link ?? '')
    .trim()
    .split(/[?#]/)[0]
    .replace(/\/+$/, '')
    .toLowerCase();

  const appointment = /^\/appointments\/(\d+)$/.exec(path);
  if (appointment) {
    const appointmentId = Number(appointment[1]);
    return appointmentId > 0
      ? { screen: 'appointment', appointmentId }
      : { screen: 'appointments' };
  }

  if (path === '/appointments') return { screen: 'appointments' };
  // A home-collection order moved on (confirmed, a collector assigned, collected…).
  if (path === '/lab-orders') return { screen: 'homeCollection' };
  if (path === '/messages') {
    // "/messages?doctor=23248&patient=2313" — the reply's own conversation.
    const query = String(link ?? '').split('?')[1]?.split('#')[0] ?? '';
    const read = (name: string): number => {
      const match = new RegExp(`(?:^|&)${name}=(\\d+)`, 'i').exec(query);
      return Number(match?.[1] ?? 0) || 0;
    };
    const doctorEmployeeId = read('doctor');
    const patientRegistrationId = read('patient');
    return doctorEmployeeId > 0 && patientRegistrationId > 0
      ? { screen: 'messageThread', doctorEmployeeId, patientRegistrationId }
      : { screen: 'messages' };
  }
  if (path === '/follow-ups') return { screen: 'followUps' };
  if (path === '/prescriptions' || path.startsWith('/prescriptions/')) {
    return { screen: 'prescriptions' };
  }
  if (path === '/reports') return { screen: 'reports' };
  if (path === '/doctors' || path.startsWith('/doctors/')) return { screen: 'findDoctors' };
  if (path === '/profile' || path === '/profiles') return { screen: 'profile' };
  return null;
};

