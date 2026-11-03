import React from 'react';
import { useTranslation } from 'react-i18next';
import { CustomDialog } from '@app/ui';
import { useAppUpdate } from '../hooks/useAppUpdate';

/**
 * "Update available" — Update opens the Play Store page; Later, Back or a tap
 * outside closes it until the next launch. Rendered once at the app's root, so
 * it shows over whichever screen the app opens on, signed in or not.
 */
export const AppUpdateDialog = () => {
  const { t } = useTranslation();
  const { isVisible, update, dismiss } = useAppUpdate();

  return (
    <CustomDialog
      visible={isVisible}
      title={t('appUpdate.title')}
      message={t('appUpdate.message')}
      confirmText={t('appUpdate.update')}
      cancelText={t('appUpdate.later')}
      onConfirm={update}
      onDismiss={dismiss}
    />
  );
};

export default AppUpdateDialog;
