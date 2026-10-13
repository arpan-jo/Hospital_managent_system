import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthRepository } from '@app/core';
import { useSignIn } from '../../../hooks/useSignIn';
import { SIGNUP_ROLE } from '../signup/useSignupViewModel';

export interface SetPasswordForm {
  password: string;
  confirmPassword: string;
}

export type SetPasswordStatus =
  /** Registered and signed in; the root navigator swaps to the app stack. */
  | 'created'
  /** Registered, but the follow-up login failed — send them to Login. */
  | 'createdNeedsLogin'
  | 'failed'
  | null;

export interface SetPasswordResult {
  status: SetPasswordStatus;
  /** Why it failed, in the backend's words. */
  message?: string;
}

export interface SetPasswordParams {
  email: string;
  /** The code VerifyEmail just confirmed; the register call checks it again. */
  code: string;
}

/**
 * Final sign-up step: choose a password, register the account, then sign in
 * with the credentials just created — the register response carries no token,
 * so the session has to come from a follow-up login (as on web).
 */
export const useSetPasswordViewModel = (params: SetPasswordParams) => {
  const signIn = useSignIn();
  const { control, handleSubmit, getValues } = useForm<SetPasswordForm>({
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  const [isLoading, setIsLoading] = useState(false);

  const submit = async (): Promise<SetPasswordResult> => {
    let result: SetPasswordResult = { status: null };

    await handleSubmit(async data => {
      setIsLoading(true);
      try {
        await AuthRepository.registerWithOtp({
          email: params?.email,
          code: params?.code,
          password: data?.password,
          role: SIGNUP_ROLE,
        });

        // Registration succeeded, so the account exists even if this login
        // fails; report that separately rather than as a failed sign-up.
        try {
          await signIn(params?.email, data?.password);
          result = { status: 'created' };
        } catch {
          result = { status: 'createdNeedsLogin' };
        }
      } catch (e: any) {
        result = { status: 'failed', message: e?.message };
      } finally {
        setIsLoading(false);
      }
    })();

    return result;
  };

  return { control, getValues, isLoading, submit };
};

export default useSetPasswordViewModel;
