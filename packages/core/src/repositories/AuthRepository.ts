import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { toLoginIdentifier } from '../utils/bdPhone';

export interface LoginResponse {
  userId: number;
  token: string;
  /** Nullable on the API contract, same for `email` and `role` below. */
  fullName: string | null;
  email: string | null;
  role: string | null;
  expiresAt: string;
}

export interface SendOtpResponse {
  message: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface VerifyOtpResponse {
  isValid: boolean;
  message: string;
}

/**
 * Deliberately non-committal ("If that email is registered, a reset link has
 * been sent."), so a 200 says nothing about whether the account exists.
 */
export interface ForgotPasswordResponse {
  message: string;
}

export interface RegisterWithOtpPayload {
  email: string;
  code: string;
  password: string;
  role: string;
  /** Doctor-only, collected on the sign-up screen. */
  fullName?: string;
  /** Doctor-only, collected on the sign-up screen. */
  registrationType?: string;
  signupSource?: string;
}

/** Phone sign-up, which has no OTP step and so carries no `code`. */
export interface RegisterPayload {
  identifier: string;
  password: string;
  role: string;
  /** Doctor-only, collected on the sign-up screen. */
  fullName?: string;
  /** Doctor-only, collected on the sign-up screen. */
  registrationType?: string;
  signupSource?: string;
}

/**
 * The 201 body carries no token, which is why callers follow a successful
 * register with a `login` call to actually start the session.
 */
export interface RegisterResponse {
  userId: number;
  fullName: string;
  email: string;
  /** Comes back capitalised ("Patient"), unlike the lowercase role sent up. */
  role: string;
  userRoleId: number | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  userLastActivitiesTime: string | null;
  /** Not in the 201 body today, but preferred over a local string if it lands. */
  message?: string;
}

/**
 * The registration-type dropdown holds display labels ("Medical Officer"), but
 * the backend keys them as snake_case ("medical_officer").
 */
const toRegistrationTypeKey = (value?: string): string =>
  value?.trim()?.toLowerCase()?.replace(/\s+/g, '_') ?? '';

export const AuthRepository = {
  sendOtp: async (email: string, role: string) => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.sendOtp,
      method: 'POST',
      data: { email: email?.trim(), role: role?.toLowerCase() },
      baseUrl: API_URL,
    };

    return apiRequest<SendOtpResponse>(api_params);
  },

  verifyOtp: async (email: string, code: string) => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.verifyOtp,
      method: 'POST',
      data: { email: email?.trim(), code: code?.trim() },
      baseUrl: API_URL,
    };

    return apiRequest<VerifyOtpResponse>(api_params);
  },

  registerWithOtp: async (payload: RegisterWithOtpPayload) => {
    const data: RegisterWithOtpPayload = {
      email: payload?.email?.trim(),
      code: payload?.code?.trim(),
      password: payload?.password || '',
      role: payload?.role?.toLowerCase(),
    };

    // Doctor-only fields; omitted entirely for a patient rather than sent empty.
    if (payload?.fullName) {
      data.fullName = payload?.fullName?.trim() ?? '';
    }
    if (payload?.registrationType) {
      data.registrationType = toRegistrationTypeKey(payload?.registrationType);
    }

    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.registerWithOtp,
      method: 'POST',
      data,
      baseUrl: API_URL,
    };

    return apiRequest<RegisterResponse>(api_params);
  },

  register: async (payload: RegisterPayload) => {
    const data: RegisterPayload = {
      // A mobile number goes in its local form: the API rejects '+880…' and spaces.
      identifier: toLoginIdentifier(payload?.identifier),
      password: payload?.password || '',
      role: payload?.role?.toLowerCase(),
    };

    if (payload?.fullName) {
      data.fullName = payload?.fullName?.trim() ?? '';
    }
    if (payload?.registrationType) {
      data.registrationType = toRegistrationTypeKey(payload?.registrationType);
    }

    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.register,
      method: 'POST',
      data,
      baseUrl: API_URL,
    };

    return apiRequest<RegisterResponse>(api_params);
  },

  forgotPassword: async (email: string) => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.forgotPassword,
      method: 'POST',
      data: { email: email?.trim() },
      baseUrl: API_URL,
    };

    return apiRequest<ForgotPasswordResponse>(api_params);
  },

  /**
   * Email and password only — the API has no mobile-number sign-in.
   *
   * There is no matching logout call: the API keeps no session to close, so
   * signing out is just clearing the stores.
   */
  login: async (email: string, password: string) => {
    const payload = {
      // Trimmed, since a leading space alone turns a correct login into a 401.
      email: email?.trim() ?? '',
      password: password || '',
    };

    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.login,
      method: 'POST',
      data: payload,
      baseUrl: API_URL,
    };
    const res = await apiRequest<LoginResponse>(api_params);

    if (!res?.token) {
      throw new Error('Login failed: no token in response');
    }

    return res;
  },
};

export default AuthRepository;
