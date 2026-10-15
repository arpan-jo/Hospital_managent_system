/**
 * Where a notification's portal link leads in the app. Kept apart from the
 * repository so it can be tested without the network layer.
 */

/** An app screen a notification can open. */
export type NotificationTarget =
  | { screen: 'appointment'; appointmentId: number }
  | {
      screen:
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
  if (path === '/follow-ups') return { screen: 'followUps' };
  if (path === '/prescriptions' || path.startsWith('/prescriptions/')) {
    return { screen: 'prescriptions' };
  }
  if (path === '/reports') return { screen: 'reports' };
  if (path === '/doctors' || path.startsWith('/doctors/')) return { screen: 'findDoctors' };
  if (path === '/profile' || path === '/profiles') return { screen: 'profile' };
  return null;
};

