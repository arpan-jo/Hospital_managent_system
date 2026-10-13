import { useCallback, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useTranslation } from 'react-i18next';
import { PatientRepository, useStores } from '@app/core';
import { DrawerParamList } from '../navigation/DrawerNavigator';

/** The API's "no profile row yet" — `POST /api/patient/profile` creates it. */
const NOT_FOUND = 404;

/**
 * Guards the Book / Book Appointment / Make Appointment buttons: an appointment
 * is always *for* a patient profile, and a freshly registered account has none
 * (registration creates the login only). Without this the patient reaches the
 * booking screen, finds an empty "Appointment For" list behind a disabled
 * button, and has no way forward.
 *
 * `ensureProfile` resolves true when it is safe to carry on. When there is no
 * profile it says why and opens the Profile tab, whose empty state offers the
 * create form.
 */
export const useRequirePatientProfile = () => {
  const { profileStore, toastStore } = useStores();
  const navigation = useNavigation();
  const { t } = useTranslation();

  const [isChecking, setIsChecking] = useState(false);
  /**
   * State lands a render too late to stop a second tap — two doctor cards in a
   * row would each fire the navigation. The ref closes that window.
   */
  const isCheckingRef = useRef(false);

  const ensureProfile = useCallback(async (): Promise<boolean> => {
    // Populated at login, so the ordinary case costs no request at all.
    if (profileStore.patientProfileData) return true;
    if (isCheckingRef.current) return false;

    /**
     * An empty store is not proof: the login fetch is fire-and-forget and only
     * warns on failure, so `null` also covers "it failed" and "it is still in
     * flight". Asking the API is what separates those from a real absence —
     * guessing would lock a patient who *does* have a profile out of booking.
     */
    isCheckingRef.current = true;
    setIsChecking(true);
    try {
      const profile = await PatientRepository.getProfile();
      profileStore.setPatientProfile(profile);
      return true;
    } catch (error: any) {
      console.log('[ProfileGate] getProfile error ==>', error?.message);

      // Anything but a 404 means we could not tell. Sending them to the profile
      // screen would be a guess, and its own fetch would fail the same way.
      if (error?.status !== NOT_FOUND) {
        toastStore.show(t('patientProfile.loadFailed'), 'error');
        return false;
      }

      toastStore.show(t('patientProfile.createProfileFirst'), 'warning');
      // Same hop the Find Doctors header avatar makes: out of this stack, into
      // the Profile tab — the booking stacks mount no profile screens of their own.
      navigation
        .getParent<DrawerNavigationProp<DrawerParamList>>()
        ?.navigate('MainTabs', { screen: 'ProfileTab' });
      return false;
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [profileStore, toastStore, navigation, t]);

  return { ensureProfile, isChecking };
};

export default useRequirePatientProfile;
