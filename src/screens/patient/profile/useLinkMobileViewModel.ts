import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AuthRepository,
  isBdMobile,
  serverMessageOf,
  toLocalBdMobile,
  useStores,
} from '@app/core';

const CODE_LENGTH = 6;
const CODE_PATTERN = /^\d{6}$/;

/**
 * "Already registered at the hospital?" — the portal's profile card for an
 * account signed in by email that has no registration yet. The patient proves
 * the mobile number they gave at the counter with a code by SMS; the backend
 * then hands the account every registration carrying that number, and the
 * profile, appointments and reports appear.
 *
 * A mobile-number account never needs this: the backend matches its number on
 * every sign-in.
 */
export const useLinkMobileViewModel = (onLinked?: () => void) => {
  const { t } = useTranslation();
  const { toastStore } = useStores();

  const [phone, setPhoneText] = useState('');
  const [code, setCodeText] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [codeError, setCodeError] = useState('');
  /** The number the last code went to — the one that code proves. '' before any. */
  const [sentTo, setSentTo] = useState('');
  const [isSending, setSending] = useState(false);
  const [isLinking, setLinking] = useState(false);
  // Refs, not the state: a fast double tap lands before the re-render.
  const sendingRef = useRef(false);
  const linkingRef = useRef(false);

  const setPhone = useCallback((text: string) => {
    setPhoneText(String(text ?? ''));
    setPhoneError('');
  }, []);

  /** Digits only, six at most — a pasted "123 456" still reads right. */
  const setCode = useCallback((text: string) => {
    setCodeText(String(text ?? '').replace(/\D/g, '').slice(0, CODE_LENGTH));
    setCodeError('');
  }, []);

  /** Back to the number field — the code sent so far proves the old number. */
  const changeNumber = useCallback(() => {
    if (sendingRef.current || linkingRef.current) return;
    setSentTo('');
    setCodeText('');
    setCodeError('');
  }, []);

  /** Texts a code to the number — again, for "Resend code". */
  const sendCode = useCallback(async () => {
    if (sendingRef.current || linkingRef.current) return;

    // A resend goes to the number the card is locked on, not whatever was typed.
    const text = (sentTo || phone)?.trim() ?? '';
    if (!text) {
      setPhoneError(t('linkMobile.phoneRequired'));
      return;
    }
    if (!isBdMobile(text)) {
      setPhoneError(t('linkMobile.invalidPhone'));
      return;
    }
    const number = toLocalBdMobile(text);

    sendingRef.current = true;
    setSending(true);
    try {
      // The sign-up code: the backend refuses a number another account holds.
      const res = await AuthRepository.sendOtp({ phone: number }, 'patient');
      setSentTo(number);
      setPhoneText(number);
      setCodeText('');
      setCodeError('');
      toastStore.show(res?.message?.trim() || t('linkMobile.codeSent'), 'success');
    } catch (error: any) {
      console.log('link mobile send error ==>', error?.message);
      toastStore.show(serverMessageOf(error) || t('linkMobile.sendFailed'), 'error');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [phone, sentTo, t, toastStore]);

  /** Proves the number with the code, and reports how many records came with it. */
  const verify = useCallback(async () => {
    if (sendingRef.current || linkingRef.current || !sentTo) return;

    const digits = code?.trim() ?? '';
    if (!CODE_PATTERN.test(digits)) {
      setCodeError(t('linkMobile.invalidCode'));
      return;
    }

    linkingRef.current = true;
    setLinking(true);
    try {
      const res = await AuthRepository.linkPhone(sentTo, digits);
      const claimed = res?.claimedRegistrations ?? 0;
      // The server's words first; how many records it found is ours to add.
      const outcome =
        claimed > 0
          ? t('linkMobile.recordsLinked', { count: claimed })
          : t('linkMobile.noRecords');
      toastStore.show(`${res?.message || t('linkMobile.verified')} ${outcome}`, 'success', 5000);
      setSentTo('');
      setPhoneText('');
      setCodeText('');
      onLinked?.();
    } catch (error: any) {
      console.log('link mobile verify error ==>', error?.message);
      toastStore.show(serverMessageOf(error) || t('linkMobile.verifyFailed'), 'error');
    } finally {
      linkingRef.current = false;
      setLinking(false);
    }
  }, [code, sentTo, t, toastStore, onLinked]);

  return {
    phone,
    setPhone,
    phoneError,
    code,
    setCode,
    codeError,
    sentTo,
    isCodeSent: sentTo !== '',
    isSending,
    isLinking,
    sendCode,
    verify,
    changeNumber,
  };
};

export default useLinkMobileViewModel;
