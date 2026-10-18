import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AuthRepository,
  isBdMobile,
  serverMessageOf,
  toLocalBdMobile,
} from '@app/core';

/** This app signs up patients only — the role every sign-up call sends. */
export const SIGNUP_ROLE = 'Patient';

/** What the patient signs up with — the tab above the field. */
export type SignupMethod = 'email' | 'phone';

export interface SignupForm {
  email: string;
  phone: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface SignupResult {
  /** Exactly one of these: where the code went (the phone in `01XXXXXXXXX` form). */
  email?: string;
  phone?: string;
  /** How long the code just sent stays valid — the next screen's countdown. */
  expiresInSeconds?: number;
  /** Backend-provided message for the OTP-sent toast, e.g. "Verification code sent to your email." */
  message?: string;
}

export interface SignupSubmitResult {
  /** Null when validation failed or the OTP send call errored. */
  data: SignupResult | null;
  /**
   * User-facing failure message. Returned rather than read off state, since
   * the caller runs before React has re-rendered with the new state.
   */
  error?: string;
}

/**
 * First sign-up step: an email or a mobile number, and the verification code
 * is sent from here, so the screen only moves on to VerifyEmail once the
 * address is actually bound server-side.
 *
 * The API signs up by email only so far; the mobile-number path is laid out
 * for its SMS code API, which the backend has yet to provide.
 */
export const useSignupViewModel = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [method, setMethodState] = useState<SignupMethod>('email');

  const { control, trigger, getValues, clearErrors } = useForm<SignupForm>({
    defaultValues: { email: '', phone: '' },
    mode: 'onBlur',
  });

  const rules = useMemo(
    () => ({
      email: {
        validate: (value?: string) =>
          EMAIL_PATTERN.test(value?.trim() ?? '') || t('signup.invalidEmail'),
      },
      phone: {
        validate: (value?: string) =>
          isBdMobile(value) || t('signup.invalidPhone'),
      },
    }),
    [t],
  );

  /** Switching tabs drops the other field's error; its text stays for coming back. */
  const setMethod = (next: SignupMethod) => {
    clearErrors();
    setMethodState(next);
  };

  const submit = async (): Promise<SignupSubmitResult> => {
    // Only the field on screen is checked: the other tab's may be empty.
    const valid = await trigger(method, { shouldFocus: true });
    if (!valid) {
      return { data: null };
    }

    let result: SignupResult | null = null;
    let error: string | undefined;

    setIsLoading(true);
    try {
      if (method === 'phone') {
        // Waiting on the backend: the SMS code is sent here. Until then the
        // flow just moves on, so its screens can be walked through.
        result = { phone: toLocalBdMobile(getValues('phone')) };
      } else {
        // The same trimmed address goes to every later step of the flow.
        const email = getValues('email')?.trim() ?? '';
        const res = await AuthRepository.sendOtp(email, SIGNUP_ROLE);
        result = {
          email,
          expiresInSeconds: res?.expiresInSeconds,
          message: res?.message,
        };
      }
    } catch (e: any) {
      error = serverMessageOf(e) || t('signup.sendFailed');
    } finally {
      setIsLoading(false);
    }

    return { data: result, error };
  };

  return {
    control,
    rules,
    method,
    setMethod,
    isLoading,
    submit,
  };
};

export default useSignupViewModel;
