import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Image, ScrollView, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStores } from '@app/core';
import {
  CustomButton,
  CustomThemeToggler,
  CustomDialog,
  fontFamilies,
} from '@app/ui';
import { images } from '../../../assets/images';
import { useErrorDialog } from '../../../hooks/useErrorDialog';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useKeyboardHeight } from '../../../hooks/useKeyboardHeight';
import { AuthStackParamList } from '../../../navigation/AuthStackNavigator';
import OtpCodeInput from './OtpCodeInput';
import { useVerifyEmailViewModel } from './useVerifyEmailViewModel';

export const VerifyEmailScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'VerifyEmail'>>();
  const { identifier, expiresInSeconds } = route?.params ?? {};
  const { toastStore } = useStores();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const viewModel = useVerifyEmailViewModel(identifier, expiresInSeconds);
  const errorDialog = useErrorDialog();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleVerify = useCallback(async () => {
    const { status, message, code } = await viewModel.submit();
    if (status === 'invalid') {
      errorDialog.show(message || t('verifyEmail.invalidCode'));
      return;
    }
    toastStore.show(message || t('verifyEmail.verified'), 'success');
    navigation.replace('SetPassword', { identifier, code });
  }, [viewModel, navigation, identifier, toastStore, errorDialog, t]);

  const handleResend = useCallback(async () => {
    if (!viewModel.canResend) {
      return;
    }
    const { ok, message } = await viewModel.resend();
    if (ok) {
      toastStore.show(message || t('verifyEmail.codeResent'), 'success');
    } else {
      errorDialog.show(message || t('verifyEmail.resendFailed'));
    }
  }, [viewModel, toastStore, errorDialog, t]);

  const containerStyle = useMemo(
    () => [styles.container, { backgroundColor: theme.colors.background }],
    [theme.colors.background],
  );

  const titleStyle = useMemo(
    () => [styles.title, { color: theme.colors.onSurface }],
    [theme.colors.onSurface],
  );

  const subtitleStyle = useMemo(
    () => [styles.subtitle, { color: theme.colors.onSurfaceVariant }],
    [theme.colors.onSurfaceVariant],
  );

  const mutedStyle = useMemo(
    () => [styles.muted, { color: theme.colors.onSurfaceVariant }],
    [theme.colors.onSurfaceVariant],
  );

  const resendStyle = useMemo(
    () => [
      styles.resend,
      {
        color: viewModel.canResend
          ? theme.colors.primary
          : theme.colors.onSurfaceVariant,
      },
    ],
    [viewModel.canResend, theme.colors.primary, theme.colors.onSurfaceVariant],
  );

  const linkStyle = useMemo(
    () => [styles.link, { color: theme.colors.primary }],
    [theme.colors.primary],
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={containerStyle}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: (keyboardHeight || insets.bottom) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerActions}>
          <Pressable
            onPress={goBack}
            hitSlop={8}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={t('verifyEmail.backToEmail')}
          >
            <Icon name="arrow-left" size={22} color={theme.colors.onSurface} />
          </Pressable>
          <CustomThemeToggler />
        </View>

        <View style={styles.hero}>
          <Image
            source={images.logo}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Hospital Management System"
          />

          <Text style={titleStyle}>{t('verifyEmail.title')}</Text>
          <Text style={subtitleStyle}>
            {t('verifyEmail.subtitle', { identifier })}
          </Text>
        </View>

        <View style={styles.form}>
          <OtpCodeInput
            digits={viewModel.digits}
            onChangeDigit={viewModel.setDigit}
          />

          <View style={styles.expiryRow}>
            <Text style={mutedStyle}>
              {t('verifyEmail.expiresIn', { time: viewModel.timeLabel })}
            </Text>
            <Pressable
              onPress={handleResend}
              hitSlop={8}
              disabled={!viewModel.canResend || viewModel.isResending}
              accessibilityRole="button"
              style={styles.resendRow}
            >
              <Icon
                name="refresh"
                size={14}
                color={
                  viewModel.canResend
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
              />
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
        </View>

        <Pressable onPress={goBack} hitSlop={8} accessibilityRole="button">
          <Text style={[linkStyle, styles.backLink]}>
            {t('verifyEmail.backToEmail')}
          </Text>
        </Pressable>
      </ScrollView>

      <CustomDialog
        visible={errorDialog.visible}
        title={t('verifyEmail.errorTitle')}
        message={errorDialog.message}
        confirmText={t('common.ok')}
        onConfirm={errorDialog.dismiss}
        onDismiss={errorDialog.dismiss}
        showCancel={false}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginTop: 24,
  },
  logo: {
    width: 220,
    height: 40,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  form: {
    marginTop: 28,
  },
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
