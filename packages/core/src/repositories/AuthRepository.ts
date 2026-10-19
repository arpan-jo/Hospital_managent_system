import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { toLocalBdMobile } from '../utils/bdPhone';

/** Who the auth calls are about: an email, or a BD mobile number. Exactly one. */
export interface AuthContact {
  email?: string;
  /** Any usual way of writing it; it goes up as `01XXXXXXXXX`. */
  phone?: string;
}

/**
 * The API takes either key and goes by `phone` when both are there, so only
 * one is sent. A phone gets its code by SMS, an email by mail.
 */
const contactBody = (contact?: AuthContact) =>
  contact?.phone
    ? { phone: toLocalBdMobile(contact.phone) }
    : { email: contact?.email?.trim() ?? '' };

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

export interface RegisterWithOtpPayload extends AuthContact {
  /** The code `verifyOtp` just accepted; the API checks it once more. */
  code: string;
  password: string;
  role: string;
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
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export const AuthRepository = {
  sendOtp: async (contact: AuthContact, role: string) => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.sendOtp,
      method: 'POST',
      data: { ...contactBody(contact), role: role?.toLowerCase() },
      baseUrl: API_URL,
    };

    return apiRequest<SendOtpResponse>(api_params);
  },

  verifyOtp: async (contact: AuthContact, code: string) => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.verifyOtp,
      method: 'POST',
      data: { ...contactBody(contact), code: code?.trim() },
      baseUrl: API_URL,
    };

    return apiRequest<VerifyOtpResponse>(api_params);
  },

  registerWithOtp: async (payload: RegisterWithOtpPayload) => {
    const data = {
      ...contactBody(payload),
      code: payload?.code?.trim() ?? '',
      password: payload?.password || '',
      // The API takes the role in lower case only.
      role: payload?.role?.toLowerCase() ?? '',
    };

    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.registerWithOtp,
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
   * An email or a mobile number, with the password.
   *
   * There is no matching logout call: the API keeps no session to close, so
   * signing out is just clearing the stores.
   */
  login: async (contact: AuthContact, password: string) => {
    const payload = {
      // Trimmed, since a leading space alone turns a correct email login into a 401.
      ...contactBody(contact),
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
