/**
 * The notification permission, asked once for the whole app. Follow-up and
 * medicine reminders all need it. It is asked right after a patient signs in,
 * as the portal does, and again from a reminder in case it was never asked.
 *
 * After the one ask, the phone's settings decide. Android itself also stops
 * showing the dialog after two refusals.
 */
import { AppState } from 'react-native';
import { storage } from './secureStorage';
import { requestNotificationPermission } from './localNotifications';

/** The key the follow-up reminder has always used, so a patient already asked is not asked again. */
const PERMISSION_ASKED_KEY = 'reminder_permission_asked';

let isAsking = false;

/**
 * Asks to show notifications, once. Only while the patient is looking at the
 * app: a request from the background is lost and would use up the one ask.
 * It counts only once the phone has answered (allowed or refused). One that
 * could not be asked is asked again next time. Never throws.
 */
export const askNotificationPermissionOnce = async (): Promise<void> => {
  if (isAsking) return;
  isAsking = true;
  try {
    if (storage?.getBoolean?.(PERMISSION_ASKED_KEY)) return;
    if (AppState?.currentState !== 'active') return;
    const answer = await requestNotificationPermission?.();
    if (answer === 'granted' || answer === 'denied') {
      storage?.set?.(PERMISSION_ASKED_KEY, true);
    }
  } catch (error: any) {
    console.log('notification permission error ==>', error?.message);
  } finally {
    isAsking = false;
  }
};
