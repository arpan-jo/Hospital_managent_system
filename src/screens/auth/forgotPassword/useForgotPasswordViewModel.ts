import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AuthRepository,
  isBdMobile,
  serverMessageOf,
  toLocalBdMobile,
} from '@app/core';

export interface ForgotPasswordForm {
  /** An email, or a mobile number — told apart by the `@`, as on the web. */
  identifier: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface ForgotPasswordResult {
  /** Exactly one of these: an email got a reset link, a phone (`01XXXXXXXXX`) a code. */
  email?: string;
  phone?: string;
  /** Backend copy, e.g. "If that email is registered, a reset link has been sent." */
  message?: string;
}

export interface ForgotPasswordSubmitResult {
  /** Null when validation failed or the request errored. */
  data: ForgotPasswordResult | null;
  /**
   * User-facing failure message. Returned rather than read off state, since
   * the caller runs before React has re-rendered with the new state.
   */
  error?: string;
}

/**
 * Reset request form, for an email or a mobile number.
 *
 * An email gets a link and the reset itself happens on the web, so the screen
 * only shows the confirmation panel. A number gets a code by SMS, and the
 * reset is done in the app on the next screen. Either 200 is deliberately
 * vague about whether the account exists, so neither must be read that way.
 */
export const useForgotPasswordViewModel = () => {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<ForgotPasswordForm>({
    defaultValues: { identifier: '' },
    mode: 'onBlur',
  });

  const [isLoading, setIsLoading] = useState(false);
  // A ref, not the state: a fast double tap lands before the re-render.
  const inFlightRef = useRef(false);

  const rules = useMemo(
    () => ({
      identifier: {
        validate: (value?: string) => {
          const text = value?.trim() ?? '';
          const valid = text.includes('@')
            ? EMAIL_PATTERN.test(text)
            : isBdMobile(text);
          return valid || t('forgotPassword.invalidIdentifier');
        },
      },
    }),
    [t],
  );

  const submit = async (): Promise<ForgotPasswordSubmitResult> => {
    // The keyboard's Done key can fire again while a request is in flight.
    if (inFlightRef.current) {
      return { data: null };
    }

    let result: ForgotPasswordResult | null = null;
    let error: string | undefined;

    inFlightRef.current = true;
    setIsLoading(true);
    try {
      await handleSubmit(async data => {
        const text = data?.identifier?.trim() ?? '';
        if (text.includes('@')) {
          const res = await AuthRepository.forgotPassword(text);
          result = { email: text, message: res?.message };
        } else {
          const phone = toLocalBdMobile(text);
          const res = await AuthRepository.sendResetOtp(phone);
          result = { phone, message: res?.message };
        }
      })();
    } catch (e: any) {
      error = serverMessageOf(e) || t('forgotPassword.sendFailed');
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }

    return { data: result, error };
  };

  return { control, rules, isLoading, submit };
};

export default useForgotPasswordViewModel;
