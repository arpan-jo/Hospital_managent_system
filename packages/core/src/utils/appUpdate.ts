/**
 * Whether the Play Store holds a newer build of this app, and the way there —
 * for the update prompt shown at launch. Android only: the app is not on the
 * App Store yet.
 *
 * Play's in-app updates API answers the question for this very install: it
 * reports an update only when the store has a higher version code than the
 * one running, so that answer is taken as is.
 *
 * The library is loaded lazily: its module throws on import when the native
 * side is missing (an install built before it was added), and that must leave
 * the prompt off rather than crash the app at launch. An install that did not
 * come from the Play Store (a debug or side-loaded build) gets an error back,
 * which reads as "no update" too.
 */
import { Linking, Platform } from 'react-native';
import type InAppUpdates from 'sp-react-native-in-app-updates';

/** The Play Store listing — `applicationId` in android/app/build.gradle. */
const PLAY_STORE_PACKAGE = 'com.ibos.hms';

let inAppUpdates: InAppUpdates | null | undefined;

const loadInAppUpdates = (): InAppUpdates | null => {
  if (inAppUpdates === undefined) {
    try {
      const InAppUpdatesClass = require('sp-react-native-in-app-updates')?.default as
        | typeof InAppUpdates
        | undefined;
      // One instance for the app: each one subscribes to the native update events.
      inAppUpdates = InAppUpdatesClass ? new InAppUpdatesClass(false) : null;
    } catch (error: any) {
      console.log('in-app updates unavailable ==>', error?.message);
      inAppUpdates = null;
    }
  }
  return inAppUpdates ?? null;
};

/** True when the Play Store has a newer build than this install. Never throws. */
export const hasStoreUpdate = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;

  const updates = loadInAppUpdates();
  if (!updates) return false;

  try {
    const result = await updates?.checkNeedsUpdate?.({
      // Play has already compared version codes. The library would compare
      // again, the store's version code against this build's version *name*,
      // which can read a real update as none ("10" against "10.0").
      customVersionComparator: () => 1,
    });
    return result?.shouldUpdate === true;
  } catch (error: any) {
    console.log('app update check error ==>', error?.message);
    return false;
  }
};

/** Opens this app's Play Store page — in the Play Store app, else in the browser. */
export const openStoreListing = async (): Promise<void> => {
  try {
    await Linking.openURL(`market://details?id=${PLAY_STORE_PACKAGE}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`);
  }
};
