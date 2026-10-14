import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStores } from '@app/core';
import { CustomButton, CustomDialog, fontFamilies } from '@app/ui';
import { useErrorDialog } from '../../../hooks/useErrorDialog';
import { AuthStackParamList } from '../../../navigation/AuthStackNavigator';
import AuthScreenLayout from '../AuthScreenLayout';
import OtpCodeInput from './OtpCodeInput';
import { useVerifyEmailViewModel } from './useVerifyEmailViewModel';

export const VerifyEmailScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'VerifyEmail'>>();
  const { email, expiresInSeconds } = route?.params ?? {};
  const { toastStore } = useStores();
  const viewModel = useVerifyEmailViewModel(email, expiresInSeconds);
  const errorDialog = useErrorDialog();

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleVerify = useCallback(async () => {
    const { status, message, code } = await viewModel.submit();
    if (status === 'incomplete') {
      errorDialog.show(t('verifyEmail.invalidCode'));
      return;
    }
    if (status === 'rejected' || !code) {
      errorDialog.show(message || t('verifyEmail.verifyFailed'));
      return;
    }
    toastStore.show(message || t('verifyEmail.verified'), 'success');
    navigation.replace('SetPassword', { email, code });
  }, [viewModel, navigation, email, toastStore, errorDialog, t]);

  const handleResend = useCallback(async () => {
    if (!viewModel.isExpired) {
      return;
    }
    const { ok, message } = await viewModel.resend();
    if (ok) {
      toastStore.show(message || t('verifyEmail.codeResent'), 'success');
    } else {
      errorDialog.show(message || t('verifyEmail.resendFailed'));
    }
  }, [viewModel, toastStore, errorDialog, t]);

  const expiryStyle = useMemo(
    () => [
      styles.muted,
      {
        color: viewModel.isExpired
          ? theme.colors.error
          : theme.colors.onSurfaceVariant,
      },
    ],
    [viewModel.isExpired, theme.colors.error, theme.colors.onSurfaceVariant],
  );

  const resendColor = viewModel.isExpired
    ? theme.colors.primary
    : theme.colors.onSurfaceVariant;

  const resendStyle = useMemo(
    () => [styles.resend, { color: resendColor }],
    [resendColor],
  );

  const linkStyle = useMemo(
    () => [styles.link, styles.backLink, { color: theme.colors.primary }],
    [theme.colors.primary],
  );

  return (
    <>
      <AuthScreenLayout
        title={t('verifyEmail.title')}
        subtitle={t('verifyEmail.subtitle', { email })}
        onBack={goBack}
        backLabel={t('verifyEmail.backToEmail')}
      >
        <OtpCodeInput
          digits={viewModel.digits}
          onChangeDigit={viewModel.setDigit}
        />

        <View style={styles.expiryRow}>
          <Text style={expiryStyle}>
            {viewModel.isExpired
              ? t('verifyEmail.expired')
              : t('verifyEmail.expiresIn', { time: viewModel.timeLabel })}
          </Text>
          <Pressable
            onPress={handleResend}
            hitSlop={8}
            disabled={!viewModel.isExpired || viewModel.isResending}
            accessibilityRole="button"
            style={styles.resendRow}
          >
            <Icon name="refresh" size={14} color={resendColor} />
            <Text style={resendStyle}>{t('verifyEmail.resendCode')}</Text>
          </Pressable>
        </View>

        <CustomButton
          mode="contained"
          onPress={handleVerify}
          loading={viewModel.isLoading}
          style={styles.button}
        >
          {t('verifyEmail.button')}
        </CustomButton>

        <Pressable onPress={goBack} hitSlop={8} accessibilityRole="button">
          <Text style={linkStyle}>{t('verifyEmail.backToEmail')}</Text>
        </Pressable>
      </AuthScreenLayout>

      <CustomDialog
        visible={errorDialog.visible}
        title={t('verifyEmail.errorTitle')}
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
  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  muted: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resend: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  button: {
    marginTop: 20,
    paddingVertical: 6,
  },
  link: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  backLink: {
    textAlign: 'center',
    marginTop: 20,
  },
});

export default VerifyEmailScreen;
