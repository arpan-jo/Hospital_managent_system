import { useCallback } from 'react';
import {
  AuthRepository,
  unregisterPushDevice,
  clearFollowUpReminders,
  clearMedicineReminders,
  useStores,
} from '@app/core';

interface SignOutOptions {
  /**
   * Leave the follow-up and medicine reminders on the phone. For a session
   * ended elsewhere (a sign-out or password reset on another device): the
   * same patient still has the follow-up and still takes the medicines. Only
   * the patient's own Logout takes them away.
   */
  keepReminders?: boolean;
}

/**
 * Signs the patient out — here at once, and on the server after, as the
 * portal's own sign-out does. The token is read before the stores let it go;
 * the server call is best effort, so a slow or failed one never holds the app
 * signed in. A Logout also takes this account's follow-up and medicine
 * reminders off the phone, so the next person on it never sees them.
 */
export const useSignOut = (options?: SignOutOptions) => {
  const { authStore, profileStore } = useStores();
  const keepReminders = Boolean(options?.keepReminders);

  return useCallback(() => {
    const token = authStore?.authToken ?? null;
    authStore?.logout();
    profileStore?.clear();
    if (!keepReminders) {
      clearFollowUpReminders?.();
      clearMedicineReminders?.();
    }
    // The push token first: the logout request ends the login it needs.
    unregisterPushDevice(token)
      .then(() => AuthRepository.logout(token))
      .catch((error: any) => {
        console.log('sign out error ==>', error?.message);
      });
  }, [authStore, profileStore, keepReminders]);
};

export default useSignOut;
