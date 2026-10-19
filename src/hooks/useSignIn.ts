import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useStores,
  AuthContact,
  AuthRepository,
  PatientRepository,
} from '@app/core';

/**
 * The one role this app is built for. Doctors, admins and assistants have
 * their own portal on the web; signed in here they would get the patient's
 * screens and a stream of refused calls.
 *
 * Lower case because the role is compared that way, as on the web — the API
 * sends "Patient".
 */
const APP_ROLE = 'patient';

/**
 * Starts a session from credentials: logs in, populates `authStore`, then
 * kicks off the profile fetch.
 *
 * Shared by the Login screen and the last sign-up step, which logs the new
 * account in straight away (the register response carries no token).
 */
export const useSignIn = () => {
  const { authStore, profileStore } = useStores();
  const { t } = useTranslation();

  return useCallback(
    async (contact: AuthContact, password: string) => {
      const result = await AuthRepository.login(contact, password);

      // Nothing to undo on the server: the token is just never stored.
      if (result?.role?.toLowerCase() !== APP_ROLE) {
        throw new Error(t('login.roleNotSupported'));
      }

      // A new session starts with no profile, as the portal clears its cache
      // on sign-in: an account without one must not see the last one's.
      profileStore.clear();
      authStore.login(result);

      // Fires after isAuthenticated flips (navigation already happens on
      // that), so a slow/failed profile fetch doesn't block or fail login.
      PatientRepository.getProfile()
        .then(profile => {
          profileStore.setPatientProfile(profile);
        })
        .catch(err =>
          console.warn('[SignIn] Failed to fetch patient profile:', err),
        );

      return result;
    },
    [authStore, profileStore, t],
  );
};

export default useSignIn;
