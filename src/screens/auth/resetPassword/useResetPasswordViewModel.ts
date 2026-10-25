import { useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthRepository, serverMessageOf } from '@app/core';
import { CODE_LENGTH } from '../verifyEmail/useVerifyEmailViewModel';

export interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

/** `incomplete`: fewer than six digits, nothing sent. `invalid`: the form's own checks failed. */
export type ResetPasswordStatus = 'reset' | 'incomplete' | 'invalid' | 'failed';

export interface ResetPasswordResult {
  status: ResetPasswordStatus;
  /** The server's own words, on either outcome; '' or absent when it sent none. */
  message?: string;
}

/**
 * Forgot password by mobile, second step: the SMS code and a new password go
 * up together — the API has no separate verify call, so a wrong code comes
 * back from the reset itself. `resend` asks for a fresh code; the server
 * refuses one inside its cooldown and says so.
 */
export const useResetPasswordViewModel = (phone: string) => {
  const [digits, setDigits] = useState<string[]>(() =>
    Array(CODE_LENGTH).fill(''),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  // Refs, not the state: a fast double tap lands before the re-render.
  const resetInFlightRef = useRef(false);
  const resendInFlightRef = useRef(false);

  const { control, handleSubmit, getValues } = useForm<ResetPasswordForm>({
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  const setDigit = useCallback((index: number, value: string) => {
    setDigits(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  /** Null when a send is already on its way — nothing to tell the user. */
  const resend = useCallback(async (): Promise<{
    ok: boolean;
    message?: string;
  } | null> => {
    if (resendInFlightRef.current) {
      return null;
    }
    resendInFlightRef.current = true;
    setIsResending(true);
    try {
      const res = await AuthRepository.sendResetOtp(phone);
      setDigits(Array(CODE_LENGTH).fill(''));
      return { ok: true, message: res?.message };
    } catch (e: any) {
      return { ok: false, message: serverMessageOf(e) };
    } finally {
      resendInFlightRef.current = false;
      setIsResending(false);
    }
  }, [phone]);

  const submit = async (): Promise<ResetPasswordResult> => {
    // The keyboard's Done key can fire again while a request is in flight.
    if (resetInFlightRef.current) {
      return { status: 'invalid' };
    }

    const code = digits.join('');
    if (code.length !== CODE_LENGTH) {
      return { status: 'incomplete' };
    }

    let result: ResetPasswordResult = { status: 'invalid' };

    // Taken before the form's own (async) checks, so a second tap can't slip in.
    resetInFlightRef.current = true;
    try {
      await handleSubmit(async data => {
        setIsLoading(true);
        try {
          const res = await AuthRepository.resetPasswordWithOtp(
            phone,
            code,
            data?.password,
          );
          result = { status: 'reset', message: res?.message };
        } catch (e: any) {
          result = { status: 'failed', message: serverMessageOf(e) };
        } finally {
          setIsLoading(false);
        }
      })();
    } finally {
      resetInFlightRef.current = false;
    }

    return result;
  };

  return {
    digits,
    setDigit,
    control,
    getValues,
    isLoading,
    isResending,
    submit,
    resend,
  };
};

export default useResetPasswordViewModel;
