import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { authErrorMessageOf, AuthRepository } from '@app/core';
import { SIGNUP_ROLE } from '../signup/useSignupViewModel';
import { otpDeadline, secondsUntil } from './otpUtils';

export const CODE_LENGTH = 6;

/** `incomplete`: fewer than six digits, nothing sent. `rejected`: the server said no. */
export type VerifyEmailStatus = 'verified' | 'incomplete' | 'rejected';

export interface VerifyEmailResult {
  status: VerifyEmailStatus;
  /** The server's own words, on either outcome; '' or absent when it sent none. */
  message?: string;
  /** The verified code, which the register call on the next screen needs. */
  code?: string;
}

export interface VerifyCodeTarget {
  /** Exactly one of these: where the code went. */
  email?: string;
  phone?: string;
}

/**
 * OTP entry for the sign-up flow, for a code sent by mail or by SMS. A
 * complete 6-digit code is checked against `AuthRepository.verifyOtp`;
 * `resend` re-binds the email or number via `sendOtp`.
 */
export const useVerifyEmailViewModel = (
  { email, phone }: VerifyCodeTarget,
  initialExpiresInSeconds?: number,
) => {
  const [digits, setDigits] = useState<string[]>(() =>
    Array(CODE_LENGTH).fill(''),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  /** When the code runs out (wall clock) — the countdown is read off it, never counted down by itself. */
  const [deadline, setDeadline] = useState(() => otpDeadline(initialExpiresInSeconds));
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(deadline));

  // Re-read each second and on coming back to the app: Android stops an app's
  // timers while it is away, and the patient leaves to read the SMS or email.
  useEffect(() => {
    const tick = () => setSecondsLeft(secondsUntil(deadline));
    tick();
    const id = setInterval(tick, 1000);
    const subscription = AppState?.addEventListener?.('change', state => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(id);
      subscription?.remove?.();
    };
  }, [deadline]);

  const setDigit = useCallback((index: number, value: string) => {
    setDigits(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const resend = useCallback(async (): Promise<{
    ok: boolean;
    message?: string;
  }> => {
    setIsResending(true);
    try {
      const res = await AuthRepository.sendOtp({ email, phone }, SIGNUP_ROLE);
      setDigits(Array(CODE_LENGTH).fill(''));
      setDeadline(otpDeadline(res?.expiresInSeconds));
      return { ok: true, message: res?.message };
    } catch (e: any) {
      return { ok: false, message: authErrorMessageOf(e) };
    } finally {
      setIsResending(false);
    }
  }, [email, phone]);

  const submit = async (): Promise<VerifyEmailResult> => {
    const code = digits.join('');
    if (code.length !== CODE_LENGTH) {
      return { status: 'incomplete' };
    }

    setIsLoading(true);
    try {
      const res = await AuthRepository.verifyOtp({ email, phone }, code);
      return {
        status: res?.isValid ? 'verified' : 'rejected',
        message: res?.message,
        code,
      };
    } catch (e: any) {
      return { status: 'rejected', message: authErrorMessageOf(e) };
    } finally {
      setIsLoading(false);
    }
  };

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return {
    digits,
    setDigit,
    isLoading,
    isResending,
    submit,
    resend,
    /** A new code can only be asked for once the current one has run out, as on the web. */
    isExpired: secondsLeft === 0,
    timeLabel: `${minutes}:${seconds}`,
  };
};

export default useVerifyEmailViewModel;
