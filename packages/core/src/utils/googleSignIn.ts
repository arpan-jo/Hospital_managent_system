/**
 * Google's account picker, for "Sign in with Google". All it does is prove to
 * Google who the user is: the ID token it hands back is for the HMS API to
 * check, and the API's answer (a login response, as for email) is what starts
 * the session. No Google session is kept here.
 *
 * The library is loaded lazily: its module throws on import when the native
 * side is missing (an install built before it was added), and that must leave
 * Google sign-in unavailable rather than crash the app at launch.
 */
import { GOOGLE_WEB_CLIENT_ID } from '@env';
import type * as GoogleSignInModule from '@react-native-google-signin/google-signin';

/**
 * Google's whole answer. Only `idToken` goes to the API, which reads the name,
 * email and photo from the token itself; `user` is for showing only.
 */
export type GoogleAccount = GoogleSignInModule.User & {
  /** Signed by Google, for the API to verify. Never stored. */
  idToken: string;
};

let googleModule: typeof GoogleSignInModule | null | undefined;

const loadGoogleSignIn = (): typeof GoogleSignInModule | null => {
  if (googleModule === undefined) {
    try {
      googleModule =
        require('@react-native-google-signin/google-signin') as typeof GoogleSignInModule;
      // The web client is the audience the API checks the ID token against;
      // without it Google hands back no ID token at all.
      googleModule?.GoogleSignin?.configure?.({
        webClientId: GOOGLE_WEB_CLIENT_ID,
      });
    } catch (error: any) {
      console.log('google sign-in unavailable ==>', error?.message);
      googleModule = null;
    }
  }
  return googleModule;
};

/**
 * Opens Google's account picker. Resolves to null when the user backs out or
 * a picker is already open; throws when Google could not sign them in.
 */
export const pickGoogleAccount = async (): Promise<GoogleAccount | null> => {
  const lib = loadGoogleSignIn();
  if (!lib) {
    throw new Error('Google sign-in is not available in this build');
  }

  try {
    await lib.GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
    const response = await lib.GoogleSignin.signIn();
    if (!lib.isSuccessResponse(response)) {
      return null;
    }

    // Left signed in, Google would skip the picker next time and reuse this
    // account; the app's own token is the session anyway.
    await lib.GoogleSignin.signOut().catch(() => null);

    const idToken = response?.data?.idToken;
    if (!idToken) {
      throw new Error('Google returned no ID token');
    }

    return { ...response?.data, idToken };
  } catch (error: any) {
    if (
      lib.isErrorWithCode(error) &&
      error?.code === lib.statusCodes?.IN_PROGRESS
    ) {
      return null;
    }
    throw error;
  }
};
