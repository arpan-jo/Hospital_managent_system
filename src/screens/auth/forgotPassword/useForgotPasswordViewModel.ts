import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AuthRepository, serverMessageOf } from '@app/core';

export interface ForgotPasswordForm {
  email: string;
}

export interface ForgotPasswordResult extends ForgotPasswordForm {
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
 * Reset-link request form.
 *
 * The reset itself happens on the web — the app only asks the backend to mail
 * the link, then shows the confirmation panel. A 200 is deliberately vague
 * about whether the address is registered, so the screen must not read it as
 * "this account exists".
 */
export const useForgotPasswordViewModel = () => {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<ForgotPasswordForm>({
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  const [isLoading, setIsLoading] = useState(false);

  const submit = async (): Promise<ForgotPasswordSubmitResult> => {
    let result: ForgotPasswordResult | null = null;
    let error: string | undefined;

    setIsLoading(true);
    try {
      await handleSubmit(async data => {
        const res = await AuthRepository.forgotPassword(data?.email);
        result = { ...data, message: res?.message };
      })();
    } catch (e: any) {
      error = serverMessageOf(e) || t('forgotPassword.sendFailed');
    } finally {
      setIsLoading(false);
    }

    return { data: result, error };
  };

  return { control, isLoading, submit };
};

export default useForgotPasswordViewModel;
