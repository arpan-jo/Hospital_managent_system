import { useCallback, useEffect, useState } from 'react';
import { AuthRepository } from '@app/core';
import { SIGNUP_ROLE } from '../signup/useSignupViewModel';

export const CODE_LENGTH = 6;
const DEFAULT_EXPIRY_SECONDS = 284; // 04:44, used when the send-OTP response didn't carry one

export type VerifyEmailStatus = 'verified' | 'invalid';

export interface VerifyEmailResult {
  status: VerifyEmailStatus;
  /** Backend-provided message, shown as the toast on both outcomes. */
  message?: string;
  /** The verified code, which the register call on the next screen needs. */
  code?: string;
}

/**
 * OTP entry for the sign-up flow. A complete 6-digit code is checked against
 * `AuthRepository.verifyOtp`; `resend` re-binds the email via `sendOtp`.
 */
export const useVerifyEmailViewModel = (
  email: string,
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
      const res = await AuthRepository.sendOtp(email, SIGNUP_ROLE);
      setDigits(Array(CODE_LENGTH).fill(''));
      setSecondsLeft(res?.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS);
      return { ok: true, message: res?.message };
    } catch (e: any) {
      return { ok: false, message: e?.message };
    } finally {
      setIsResending(false);
    }
  }, [email]);

  const submit = async (): Promise<VerifyEmailResult> => {
    const code = digits.join('');
    if (code.length !== CODE_LENGTH) {
      return { status: 'invalid' };
    }

    setIsLoading(true);
    try {
      const res = await AuthRepository.verifyOtp(email, code);
      return {
        status: res?.isValid ? 'verified' : 'invalid',
        message: res?.message,
        code,
      };
    } catch (e: any) {
      return { status: 'invalid', message: e?.message };
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
