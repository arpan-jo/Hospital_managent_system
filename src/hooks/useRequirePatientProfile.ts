import { useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useTranslation } from 'react-i18next';
import {
  isPatientProfileComplete,
  PatientRepository,
  serverMessageOf,
  useStores,
} from '@app/core';
import { DrawerParamList } from '../navigation/DrawerNavigator';

/** The API's "no profile row yet" — the Profile tab's empty state creates it. */
const NOT_FOUND = 404;

/**
 * Guards the way into a doctor's page, as the portal does: a visit is booked
 * there, and a booking is always for a complete patient profile — name, date
 * of birth, phone, blood type and gender. A freshly registered account has no
 * profile at all, and one made elsewhere can be missing a field.
 *
 * `ensureProfile` resolves true when it is safe to carry on. Otherwise it says
 * why and opens the place to fix it: the profile form when a field is missing,
 * the Profile tab — whose empty state offers the create form — when there is
 * no profile yet.
 */
export const useRequirePatientProfile = () => {
  const { profileStore, toastStore } = useStores();
  const navigation = useNavigation();
  const { t } = useTranslation();

  /** Stops a second tap while the first is still asking — two doctor cards in a row would each open. */
  const isCheckingRef = useRef(false);

  const ensureProfile = useCallback(async (): Promise<boolean> => {
    // A complete profile already in hand costs no request at all.
    if (isPatientProfileComplete(profileStore.patientProfileData)) return true;
    if (isCheckingRef.current) return false;

    const drawer = navigation.getParent<DrawerNavigationProp<DrawerParamList>>();

    /**
     * Anything short of complete is asked of the API again: the profile held
     * here can be stale — finished on the web a minute ago — or absent because
     * the fetch at sign-in failed or is still on its way.
     */
    isCheckingRef.current = true;
    try {
      const profile = await PatientRepository.getProfile();
      profileStore.setPatientProfile(profile);
      if (isPatientProfileComplete(profile)) return true;

      toastStore.show(t('patientProfile.completeProfileFirst'), 'warning');
      // Straight to the form, with the profile screen under it to go back to.
      drawer?.navigate('MainTabs', {
        screen: 'ProfileTab',
        params: { screen: 'ProfileEdit', initial: false },
      });
      return false;
    } catch (error: any) {
      console.log('[ProfileGate] getProfile error ==>', error?.message);

      // Anything but a 404 means we could not tell. Sending them to the profile
      // screen would be a guess, and its own fetch would fail the same way.
      if (error?.status !== NOT_FOUND) {
        toastStore.show(serverMessageOf(error) || t('patientProfile.loadFailed'), 'error');
        return false;
      }

      // The 404 is the API's "no profile yet" ("Profile not found. Use POST to
      // create one." — words for a developer), so the patient gets ours.
      toastStore.show(t('patientProfile.createProfileFirst'), 'warning');
      drawer?.navigate('MainTabs', { screen: 'ProfileTab' });
      return false;
    } finally {
      isCheckingRef.current = false;
    }
  }, [profileStore, toastStore, navigation, t]);

  return { ensureProfile };
};

export default useRequirePatientProfile;
