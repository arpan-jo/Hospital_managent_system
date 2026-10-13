import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { AuthRepository, isBdMobile } from '@app/core';

/** This app signs up patients only — the role every sign-up call sends. */
export const SIGNUP_ROLE = 'Patient';
export type IdentifierKind = 'email' | 'phone';

export interface SignupForm {
  identifier: string;
}

/** Digits and the usual separators — what a typed mobile number looks like. */
const PHONE_PATTERN = /^[0-9+\-\s().]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const getIdentifierKind = (value?: string): IdentifierKind => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 && PHONE_PATTERN.test(trimmed) ? 'phone' : 'email';
};

/**
 * Anything that isn't phone-shaped is treated as an email, so the address has
 * to be checked here — otherwise a typo goes out as a `sendOtp` call and comes
 * back as a server-side validation error. A mobile number must be one the API
 * takes once its country code and spacing are dropped (see `isBdMobile`).
 */
export const isValidIdentifier = (value?: string): boolean => {
  const trimmed = value?.trim() ?? '';
  return getIdentifierKind(trimmed) === 'phone'
    ? isBdMobile(trimmed)
    : EMAIL_PATTERN.test(trimmed);
};

export interface SignupResult extends SignupForm {
  /** Set when `identifierKind` is 'email' and the OTP send call succeeded. */
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
 * Sign-up form — an email or mobile number is all a patient needs to give.
 *
 * Phone identifiers skip straight to Set Password (no OTP endpoint for
 * phone yet). Email identifiers bind the address via `AuthRepository.sendOtp`
 * before the screen navigates to VerifyEmail.
 */
export const useSignupViewModel = () => {
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit } = useForm<SignupForm>({
    defaultValues: { identifier: '' },
    mode: 'onBlur',
  });

  const identifier = useWatch({ control, name: 'identifier' });

  const identifierKind = getIdentifierKind(identifier ?? '');

  // Validates the form and hands the data back to the screen, which decides
  // where to go next (phone -> Set Password, email -> OTP) based on
  // `identifierKind`. For an email identifier, the OTP is sent here so the
  // screen only navigates once the address is actually bound server-side.
  const submit = async (): Promise<SignupSubmitResult> => {
    let result: SignupResult | null = null;
    let error: string | undefined;

    setIsLoading(true);
    try {
      await handleSubmit(async data => {
        if (getIdentifierKind(data?.identifier) === 'email') {
          const res = await AuthRepository.sendOtp(data?.identifier, SIGNUP_ROLE);
          result = {
            ...data,
            expiresInSeconds: res?.expiresInSeconds,
            message: res?.message,
          };
        } else {
          result = data;
        }
      })();
    } catch (e: any) {
      error = e?.message || 'Failed to send verification code';
    } finally {
      setIsLoading(false);
    }

    return { data: result, error };
  };

  return {
    control,
    identifierKind,
    isLoading,
    submit,
  };
};

export default useSignupViewModel;
