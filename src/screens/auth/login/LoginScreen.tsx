import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Image, ScrollView, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { images } from '../../../assets/images';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useKeyboardHeight } from '../../../hooks/useKeyboardHeight';
import { AuthStackParamList } from '../../../navigation/AuthStackNavigator';
import { useLoginViewModel } from './useLoginViewModel';
import {
  CustomFormInput,
  CustomButton,
  CustomThemeToggler,
  CustomLanguageToggler,
  CustomDialog,
  fontFamilies,
} from '@app/ui';

export const LoginScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useTheme();
  const viewModel = useLoginViewModel();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [showError, setShowError] = useState(false);
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const handleLogin = useCallback(async () => {
    const error = await viewModel.submitLogin();
    if (error) {
      setShowError(true);
    }
  }, [viewModel]);

  const handleDismissError = useCallback(() => setShowError(false), []);

  const goToForgotPassword = useCallback(
    () => navigation.navigate('ForgotPassword'),
    [navigation],
  );

  const goToSignup = useCallback(
    () => navigation.navigate('Signup'),
    [navigation],
  );

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

  const linkStyle = useMemo(
    () => [styles.link, { color: theme.colors.primary }],
    [theme.colors.primary],
  );

  const mutedStyle = useMemo(
    () => [styles.muted, { color: theme.colors.onSurfaceVariant }],
    [theme.colors.onSurfaceVariant],
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

          <Text style={titleStyle}>{t('login.title')}</Text>
          <Text style={subtitleStyle}>{t('login.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <CustomFormInput
            name="email"
            control={viewModel.control}
            label={t('login.emailLabel')}
            placeholder={t('login.emailPlaceholder')}
            leftIcon="account-outline"
            rules={{ required: t('login.invalidEmail') }}
          />

          <CustomFormInput
            name="password"
            control={viewModel.control}
            label={t('login.passwordLabel')}
            placeholder={t('login.passwordPlaceholder')}
            secureTextEntry
            leftIcon="lock-outline"
            rules={{
              required: t('login.invalidPassword'),
              minLength: {
                value: 6,
                message: t('login.invalidPassword'),
              },
            }}
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
            style={styles.button}
          >
            {t('login.button')}
          </CustomButton>
        </View>

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
      </ScrollView>

      <CustomDialog
        visible={showError}
        title={t('login.errorTitle')}
        message={viewModel.errorMessage ?? ''}
        confirmText={t('common.ok')}
        onConfirm={handleDismissError}
        onDismiss={handleDismissError}
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
    justifyContent: 'flex-end',
    paddingTop: 4,
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
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 8,
  },
  muted: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  // Sits right under the sign-up link, not pinned to the bottom of the screen.
  languageSection: {
    alignItems: 'center',
    marginTop: 12,
  },
});

export default LoginScreen;
