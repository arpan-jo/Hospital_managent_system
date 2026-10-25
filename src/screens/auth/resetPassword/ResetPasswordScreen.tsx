import React, { useCallback, useMemo } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStores } from '@app/core';
import {
  CustomButton,
  CustomDialog,
  CustomFormInput,
  fontFamilies,
} from '@app/ui';
import { useErrorDialog } from '../../../hooks/useErrorDialog';
import { AuthStackParamList } from '../../../navigation/AuthStackNavigator';
import AuthScreenLayout from '../AuthScreenLayout';
import OtpCodeInput from '../verifyEmail/OtpCodeInput';
import { useResetPasswordViewModel } from './useResetPasswordViewModel';

export const ResetPasswordScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'ResetPassword'>>();
  const phone = route?.params?.phone ?? '';
  const { toastStore } = useStores();
  const viewModel = useResetPasswordViewModel(phone);
  const errorDialog = useErrorDialog();

  // Back to ForgotPassword, which still holds the number to change.
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleReset = useCallback(async () => {
    // The toasts show at the foot of the screen, where an open keyboard hides them.
    Keyboard.dismiss();
    const { status, message } = await viewModel.submit();

    if (status === 'incomplete') {
      errorDialog.show(t('resetPassword.invalidCode'));
    } else if (status === 'failed') {
      errorDialog.show(message || t('resetPassword.failed'));
    } else if (status === 'reset') {
      toastStore.show(message || t('resetPassword.done'), 'success');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  }, [viewModel, navigation, toastStore, errorDialog, t]);

  const handleResend = useCallback(async () => {
    const outcome = await viewModel.resend();
    if (!outcome) {
      return;
    }
    const { ok, message } = outcome;
    if (ok) {
      toastStore.show(message || t('resetPassword.codeResent'), 'success');
    } else {
      errorDialog.show(message || t('resetPassword.resendFailed'));
    }
  }, [viewModel, toastStore, errorDialog, t]);

  const mutedLinkStyle = useMemo(
    () => [styles.link, { color: theme.colors.onSurfaceVariant }],
    [theme.colors.onSurfaceVariant],
  );

  const resendColor = viewModel.isResending
    ? theme.colors.onSurfaceVariant
    : theme.colors.primary;

  const resendStyle = useMemo(
    () => [styles.link, { color: resendColor }],
    [resendColor],
  );

  return (
    <>
      <AuthScreenLayout
        title={t('resetPassword.title')}
        subtitle={t('resetPassword.subtitle', { phone })}
        onBack={goBack}
        backLabel={t('resetPassword.changeNumber')}
      >
        <OtpCodeInput
          digits={viewModel.digits}
          onChangeDigit={viewModel.setDigit}
        />

        <View style={styles.linkRow}>
          <Pressable onPress={goBack} hitSlop={8} accessibilityRole="button">
            <Text style={mutedLinkStyle}>
              {t('resetPassword.changeNumber')}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleResend}
            hitSlop={8}
            disabled={viewModel.isResending}
            accessibilityRole="button"
            style={styles.resendRow}
          >
            <Icon name="refresh" size={14} color={resendColor} />
            <Text style={resendStyle}>{t('resetPassword.resendCode')}</Text>
          </Pressable>
        </View>

        <CustomFormInput
          name="password"
          control={viewModel.control}
          label={t('resetPassword.passwordLabel')}
          placeholder={t('resetPassword.passwordPlaceholder')}
          secureTextEntry
          leftIcon="lock-outline"
          rules={{
            required: t('resetPassword.invalidPassword'),
            minLength: {
              value: 6,
              message: t('resetPassword.invalidPassword'),
            },
          }}
        />

        <CustomFormInput
          name="confirmPassword"
          control={viewModel.control}
          label={t('resetPassword.confirmPasswordLabel')}
          placeholder={t('resetPassword.confirmPasswordPlaceholder')}
          secureTextEntry
          leftIcon="lock-outline"
          rules={{
            required: t('resetPassword.invalidConfirmPassword'),
            validate: value =>
              value === viewModel.getValues('password') ||
              t('resetPassword.passwordMismatch'),
          }}
          returnKeyType="done"
          onSubmitEditing={handleReset}
        />

        <CustomButton
          mode="contained"
          onPress={handleReset}
          loading={viewModel.isLoading}
          style={styles.button}
        >
          {t('resetPassword.button')}
        </CustomButton>
      </AuthScreenLayout>

      <CustomDialog
        visible={errorDialog.visible}
        title={t('resetPassword.errorTitle')}
        message={errorDialog.message}
        confirmText={t('common.ok')}
        onConfirm={errorDialog.dismiss}
        onDismiss={errorDialog.dismiss}
        showCancel={false}
      />
    </>
  );
});

const styles = StyleSheet.create({
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  link: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
});

export default ResetPasswordScreen;
