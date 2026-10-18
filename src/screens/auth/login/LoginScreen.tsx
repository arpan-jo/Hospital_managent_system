import React, { useCallback, useMemo } from 'react';
import { Image, StyleSheet, View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { images } from '../../../assets/images';
import { useErrorDialog } from '../../../hooks/useErrorDialog';
import { AuthStackParamList } from '../../../navigation/AuthStackNavigator';
import AuthScreenLayout from '../AuthScreenLayout';
import { useLoginViewModel } from './useLoginViewModel';
import {
  CustomFormInput,
  CustomButton,
  CustomLanguageToggler,
  CustomDialog,
  fontFamilies,
} from '@app/ui';

// A render function, not an image source: Paper tints image icons to the
// label colour, and Google's "G" has to keep its own colours.
const renderGoogleIcon = () => (
  <Image source={images.google} style={styles.googleIcon} />
);

export const LoginScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useTheme();
  const viewModel = useLoginViewModel();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const errorDialog = useErrorDialog();

  const handleLogin = useCallback(async () => {
    const error = await viewModel.submitLogin();
    if (error) {
      errorDialog.show(error);
    }
  }, [viewModel, errorDialog]);

  const handleGoogleLogin = useCallback(async () => {
    const error = await viewModel.submitGoogleLogin();
    if (error) {
      errorDialog.show(error);
    }
  }, [viewModel, errorDialog]);

  const goToForgotPassword = useCallback(
    () => navigation.navigate('ForgotPassword'),
    [navigation],
  );

  const goToSignup = useCallback(
    () => navigation.navigate('Signup'),
    [navigation],
  );

  const linkStyle = useMemo(
    () => [styles.link, { color: theme.colors.primary }],
    [theme.colors.primary],
  );

  const mutedStyle = useMemo(
    () => [styles.muted, { color: theme.colors.onSurfaceVariant }],
    [theme.colors.onSurfaceVariant],
  );

  return (
    <>
      <AuthScreenLayout title={t('login.title')} subtitle={t('login.subtitle')}>
        <CustomFormInput
          name="email"
          control={viewModel.control}
          label={t('login.emailLabel')}
          placeholder={t('login.emailPlaceholder')}
          keyboardType="email-address"
          leftIcon="email-outline"
          rules={viewModel.rules?.email}
        />

        <CustomFormInput
          name="password"
          control={viewModel.control}
          label={t('login.passwordLabel')}
          placeholder={t('login.passwordPlaceholder')}
          secureTextEntry
          leftIcon="lock-outline"
          rules={viewModel.rules?.password}
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />

        <Pressable
          onPress={goToForgotPassword}
          hitSlop={8}
          style={styles.forgotWrap}
          accessibilityRole="button"
        >
          <Text style={linkStyle}>{t('login.forgotPassword')}</Text>
        </Pressable>

        <CustomButton
          mode="contained"
          onPress={handleLogin}
          loading={viewModel.isLoading}
          disabled={viewModel.isGoogleLoading}
          style={styles.button}
        >
          {t('login.button')}
        </CustomButton>

        <CustomButton
          mode="outlined"
          onPress={handleGoogleLogin}
          loading={viewModel.isGoogleLoading}
          disabled={viewModel.isLoading}
          icon={renderGoogleIcon}
          style={styles.googleButton}
        >
          {t('login.googleButton')}
        </CustomButton>

        <View style={styles.signupRow}>
          <Text style={mutedStyle}>{t('login.noAccount')}</Text>
          <Pressable
            onPress={goToSignup}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={linkStyle}>{t('login.createAccount')}</Text>
          </Pressable>
        </View>

        <View style={styles.languageSection}>
          <CustomLanguageToggler />
        </View>
      </AuthScreenLayout>

      <CustomDialog
        visible={errorDialog.visible}
        title={t('login.errorTitle')}
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
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  link: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  button: {
    marginTop: 16,
    paddingVertical: 6,
  },
  googleButton: {
    paddingVertical: 6,
  },
  googleIcon: {
    width: 18,
    height: 18,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  muted: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  // Pushed to the foot of the sheet, clear of the form.
  languageSection: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 28,
  },
});

export default LoginScreen;
