import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { toLocalBdMobile } from '../utils/bdPhone';

/**
 * The shortest password a new account or a reset may set — the backend's
 * `MinLength(8)` on `otp/register` and `otp/reset` since 2026-11-07. Signing in
 * still takes 6, so passwords set before then keep working.
 */
export const NEW_PASSWORD_MIN_LENGTH = 8;

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
    ? { phone: toLocalBdMobile(contact?.phone) }
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

/** "Password has been reset. You can sign in now." */
export interface ResetWithOtpResponse {
  message: string;
}

/** A mobile proven on a signed-in account — "Mobile number verified." */
export interface LinkPhoneResponse {
  message: string;
  /** Hospital-counter registrations that carried the number and are now the account's. */
  claimedRegistrations: number;
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
   * Forgot password by mobile, step one: a reset code by SMS. The answer is
   * the same whether or not the number has an account (none gets no SMS).
   */
  sendResetOtp: async (phone: string) => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.sendResetOtp,
      method: 'POST',
      data: { phone: toLocalBdMobile(phone) },
      baseUrl: API_URL,
    };

    return apiRequest<SendOtpResponse>(api_params);
  },

  /** Step two: the code and the new password. There is no separate verify call. */
  resetPasswordWithOtp: async (
    phone: string,
    code: string,
    newPassword: string,
  ) => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.resetWithOtp,
      method: 'POST',
      data: {
        phone: toLocalBdMobile(phone),
        code: code?.trim() ?? '',
        newPassword: newPassword || '',
      },
      baseUrl: API_URL,
    };

    return apiRequest<ResetWithOtpResponse>(api_params);
  },

  /**
   * An email or a mobile number, with the password. Signing out is `logout`
   * below, after the stores are cleared.
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

  /**
   * For an account signed in by email: the code `sendOtp` texted to `phone`
   * proves the number, the account keeps it, and every hospital-counter
   * registration carrying it becomes the account's. Needs the session; a
   * number another account holds answers 409 with a message.
   */
  linkPhone: async (phone: string, code: string): Promise<LinkPhoneResponse> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.linkPhone,
      method: 'POST',
      data: { phone: toLocalBdMobile(phone), code: code?.trim() ?? '' },
      baseUrl: API_URL,
    };
    const res = await apiRequest<any>(api_params);

    return {
      message: typeof res?.message === 'string' ? res.message.trim() : '',
      claimedRegistrations: Math.max(0, Number(res?.claimedRegistrations ?? 0) || 0),
    };
  },

  /**
   * `POST /hms/auth/logout` — ends the login on the server too, as the portal's
   * own sign-out does: the account's token version moves on, so every older
   * token — this phone's and the web's — is refused from then on. It takes the
   * token because the stores are already cleared when it goes out; without one
   * there is nothing to end.
   */
  logout: async (token?: string | null): Promise<void> => {
    if (!token) return;
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.logout,
      method: 'POST',
      baseUrl: API_URL,
      headers: { Authorization: `Bearer ${token}` },
      // Best effort: a slow network must not hold a sign-out the app has already done.
      timeout: 5000,
    };
    await apiRequest(api_params);
  },
};

export default AuthRepository;
