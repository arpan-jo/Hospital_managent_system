import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useStores, AuthRepository, PatientRepository } from '@app/core';

/**
 * The one role this app is built for. Doctors, admins and assistants have
 * their own portal on the web; signed in here they would get the patient's
 * screens and a stream of refused calls.
 */
const APP_ROLE = 'Patient';

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
    async (identifier: string, password: string) => {
      const result = await AuthRepository.login(identifier, password);

      if (result?.role !== APP_ROLE) {
        // The server has already opened a session — close it again, then say why.
        if (result?.token) {
          AuthRepository.logout(result.token).catch(err =>
            console.warn('[SignIn] Logout of an unsupported role failed:', err),
          );
        }
        throw new Error(t('login.roleNotSupported'));
      }

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
