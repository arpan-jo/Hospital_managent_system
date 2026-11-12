import React, { useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useStores } from '@app/core';
import { CustomDialog } from '@app/ui';
import { useSignOut } from '../hooks/useSignOut';

/** Nothing closes it but Log out — Back and a tap outside do nothing. */
const stayOpen = () => undefined;

/**
 * Asked once per login when the server refuses it with a bare 403 — the
 * session was ended elsewhere (a sign-out or password reset on another
 * device), and no screen can load with it any more. As on the portal that
 * signs nobody out by itself, so the patient is told and logs out here: one
 * button, no way past it, then the sign-in screen for a fresh login.
 */
export const SessionEndedDialog = observer(() => {
  const { t } = useTranslation();
  const { authStore } = useStores();
  const signOut = useSignOut();

  const logOut = useCallback(() => {
    signOut?.();
  }, [signOut]);

  return (
    <CustomDialog
      visible={Boolean(authStore?.isSessionRevoked)}
      title={t('common.sessionEndedTitle')}
      icon="account-lock-outline"
      message={t('common.sessionEndedRelogin')}
      confirmText={t('profile.logoutButton')}
      showCancel={false}
      dismissable={false}
      onConfirm={logOut}
      onDismiss={stayOpen}
    />
  );
});

export default SessionEndedDialog;
