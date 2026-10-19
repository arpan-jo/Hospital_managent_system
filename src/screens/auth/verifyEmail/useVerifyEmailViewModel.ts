import { useCallback, useEffect, useState } from 'react';
import { AuthRepository, serverMessageOf } from '@app/core';
import { SIGNUP_ROLE } from '../signup/useSignupViewModel';

export const CODE_LENGTH = 6;
const DEFAULT_EXPIRY_SECONDS = 284; // 04:44, used when the send-OTP response didn't carry one

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
  const [secondsLeft, setSecondsLeft] = useState(
    initialExpiresInSeconds ?? DEFAULT_EXPIRY_SECONDS,
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

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
      setSecondsLeft(res?.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS);
      return { ok: true, message: res?.message };
    } catch (e: any) {
      return { ok: false, message: serverMessageOf(e) };
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
      return { status: 'rejected', message: serverMessageOf(e) };
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
