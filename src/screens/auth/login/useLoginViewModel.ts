import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { serverMessageOf, useStores } from '@app/core';
import { useSignIn } from '../../../hooks/useSignIn';

export interface LoginForm {
  email: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** The API's own floor, checked here so a password it would refuse never goes out. */
const MIN_PASSWORD_LENGTH = 6;

/**
 * Sign-in form. Email and password only: the API has no mobile-number login,
 * and rejects anything that is not an email before it even checks the password.
 */
export const useLoginViewModel = () => {
  const signIn = useSignIn();
  const { toastStore } = useStores();
  const { t } = useTranslation();

  const { control, handleSubmit } = useForm<LoginForm>({
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
  });

  const [isLoading, setIsLoading] = useState(false);

  const rules = useMemo(
    () => ({
      email: {
        validate: (value?: string) =>
          EMAIL_PATTERN.test(value?.trim() ?? '') || t('login.invalidEmail'),
      },
      password: {
        required: t('login.invalidPassword'),
        minLength: {
          value: MIN_PASSWORD_LENGTH,
          message: t('login.invalidPassword'),
        },
      },
    }),
    [t],
  );

  /**
   * Resolves to the failure message, or null — both when the session started
   * and when the form itself was invalid (the fields show that themselves).
   */
  const submitLogin = async (): Promise<string | null> => {
    // The keyboard's Done key can fire again while a request is in flight.
    if (isLoading) {
      return null;
    }

    let error: string | null = null;

    await handleSubmit(async data => {
      setIsLoading(true);

      try {
        await signIn(data?.email, data?.password);
        toastStore.show(t('login.welcome'), 'success');
      } catch (e: any) {
        // The server's words first; a refusal made here in the app (an
        // account this app does not serve) carries its own reason.
        error =
          serverMessageOf(e) ||
          (e?.originalError ? '' : e?.message) ||
          t('login.failed');
      } finally {
        setIsLoading(false);
      }
    })();

    return error;
  };

  return {
    control,
    rules,
    isLoading,
    submitLogin,
  };
};

export default useLoginViewModel;
