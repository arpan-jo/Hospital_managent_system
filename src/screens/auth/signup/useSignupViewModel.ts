import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AuthRepository, serverMessageOf } from '@app/core';

/** This app signs up patients only — the role every sign-up call sends. */
export const SIGNUP_ROLE = 'Patient';

export interface SignupForm {
  email: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface SignupResult extends SignupForm {
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
 * First sign-up step: an email is all a patient gives here. The API has no
 * mobile-number sign-up — every account starts from a verified email.
 *
 * The verification code is sent from here, so the screen only moves on to
 * VerifyEmail once the address is actually bound server-side.
 */
export const useSignupViewModel = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit } = useForm<SignupForm>({
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  const rules = useMemo(
    () => ({
      email: {
        validate: (value?: string) =>
          EMAIL_PATTERN.test(value?.trim() ?? '') || t('signup.invalidEmail'),
      },
    }),
    [t],
  );

  const submit = async (): Promise<SignupSubmitResult> => {
    let result: SignupResult | null = null;
    let error: string | undefined;

    setIsLoading(true);
    try {
      await handleSubmit(async data => {
        // The same trimmed address goes to every later step of the flow.
        const email = data?.email?.trim() ?? '';
        const res = await AuthRepository.sendOtp(email, SIGNUP_ROLE);
        result = {
          email,
          expiresInSeconds: res?.expiresInSeconds,
          message: res?.message,
        };
      })();
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
    isLoading,
    submit,
  };
};

export default useSignupViewModel;
