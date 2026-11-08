import { useCallback } from 'react';
import { AuthRepository, useStores } from '@app/core';

/**
 * Signs the patient out — here at once, and on the server after, as the
 * portal's own sign-out does. The token is read before the stores let it go;
 * the server call is best effort, so a slow or failed one never holds the app
 * signed in.
 */
export const useSignOut = () => {
  const { authStore, profileStore } = useStores();

  return useCallback(() => {
    const token = authStore?.authToken ?? null;
    authStore?.logout();
    profileStore?.clear();
    AuthRepository.logout(token).catch((error: any) => {
      console.log('sign out error ==>', error?.message);
    });
  }, [authStore, profileStore]);
};

export default useSignOut;
