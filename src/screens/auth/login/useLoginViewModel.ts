import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSignIn } from '../../../hooks/useSignIn';

export const useLoginViewModel = () => {
  const signIn = useSignIn();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitLogin = async (): Promise<string | null> => {
    let error: string | null = null;

    await handleSubmit(async data => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await signIn(data?.email, data?.password);
      } catch (e: any) {
        error = e?.message || 'Login failed';
        setErrorMessage(error);
      } finally {
        setIsLoading(false);
      }
    })();

    return error;
  };

  return {
    control,
    errors,
    isLoading,
    errorMessage,
    submitLogin,
    clearError: () => setErrorMessage(null),
  };
};

export default useLoginViewModel;
