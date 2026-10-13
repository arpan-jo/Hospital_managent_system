import { useCallback, useState } from 'react';

/**
 * Holds the message for a `CustomDialog` used to report a failure.
 *
 * Auth failures are shown in a dialog rather than a toast: the backend message
 * ("An account with this email already exists.") is the whole reason the flow
 * stopped, so it has to stay on screen until it's acknowledged. Success
 * messages still go to the toast.
 */
export const useErrorDialog = () => {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((next: string) => setMessage(next), []);
  const dismiss = useCallback(() => setMessage(null), []);

  return {
    visible: message !== null,
    message: message ?? '',
    show,
    dismiss,
  };
};

export default useErrorDialog;
