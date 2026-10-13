import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Image,
  ScrollView,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import { Text } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { images } from '../../../assets/images';
import { useErrorDialog } from '../../../hooks/useErrorDialog';
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
  AppLightTheme,
  fontFamilies,
  useAppTheme,
} from '@app/ui';

/** How far the form sheet rides up over the hero. */
const SHEET_OVERLAP = 28;

export const LoginScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const viewModel = useLoginViewModel();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const errorDialog = useErrorDialog();
  const scrollRef = useRef<ScrollView>(null);
  const heroHeight = useRef(0);
  // The hero is a dark block in both themes, so the status bar is always light.
  useFocusedStatusBar('light-content');

  // Brand blue in light; in dark `primary` turns pale, so its container tone
  // carries the hero instead.
  const heroColor = theme.dark
    ? theme.colors.primaryContainer
    : theme.colors.primary;
  const heroInk = theme.dark
    ? theme.colors.onPrimaryContainer
    : theme.colors.onPrimary;

  /**
   * On a short screen the hero would leave the password field and the button
   * under the keyboard, so it scrolls away while typing and the sheet takes
   * the top of the screen.
   */
  useEffect(() => {
    if (keyboardHeight > 0) {
      scrollRef.current?.scrollTo({
        y: Math.max(heroHeight.current - SHEET_OVERLAP - insets.top - 8, 0),
        animated: true,
      });
    }
  }, [keyboardHeight, insets.top]);

  const handleHeroLayout = useCallback((event: LayoutChangeEvent) => {
    heroHeight.current = event?.nativeEvent?.layout?.height ?? 0;
  }, []);

  const handleLogin = useCallback(async () => {
    const error = await viewModel.submitLogin();
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

  const containerStyle = useMemo(
    () => [styles.container, { backgroundColor: heroColor }],
    [heroColor],
  );

  const heroStyle = useMemo(
    () => [styles.hero, { paddingTop: insets.top + 4 }],
    [insets.top],
  );

  const ringLargeStyle = useMemo(
    () => [styles.ring, styles.ringLarge, { borderColor: heroInk }],
    [heroInk],
  );

  const ringSmallStyle = useMemo(
    () => [styles.ring, styles.ringSmall, { borderColor: heroInk }],
    [heroInk],
  );

  const glowStyle = useMemo(
    () => [styles.glow, { backgroundColor: heroInk }],
    [heroInk],
  );

  const titleStyle = useMemo(
    () => [styles.title, { color: heroInk }],
    [heroInk],
  );

  const subtitleStyle = useMemo(
    () => [styles.subtitle, { color: heroInk }],
    [heroInk],
  );

  const sheetStyle = useMemo(
    () => [
      styles.sheet,
      {
        backgroundColor: theme.colors.surface,
        paddingBottom: (keyboardHeight || insets.bottom) + 24,
      },
    ],
    [theme.colors.surface, keyboardHeight, insets.bottom],
  );

  // Paper paints an outlined field in the page background; on the sheet that
  // leaves a tinted patch behind the floating label.
  const inputStyle = useMemo(
    () => ({ backgroundColor: theme.colors.surface }),
    [theme.colors.surface],
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
    <View style={containerStyle}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <View style={heroStyle} onLayout={handleHeroLayout}>
          <View pointerEvents="none" style={ringLargeStyle} />
          <View pointerEvents="none" style={ringSmallStyle} />
          <View pointerEvents="none" style={glowStyle} />

          <View style={styles.headerActions}>
            <CustomThemeToggler iconColor={heroInk} />
          </View>

          <View style={styles.logoPlate}>
            <Image
              source={images.logo}
              style={styles.logo}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="Hospital Management System"
            />
          </View>

          <Text style={titleStyle} accessibilityRole="header">
            {t('login.title')}
          </Text>
          <Text style={subtitleStyle}>{t('login.subtitle')}</Text>
        </View>

        <View style={sheetStyle}>
          <CustomFormInput
            name="email"
            control={viewModel.control}
            label={t('login.emailLabel')}
            placeholder={t('login.emailPlaceholder')}
            keyboardType="email-address"
            leftIcon="email-outline"
            rules={viewModel.rules?.email}
            inputStyle={inputStyle}
          />

          <CustomFormInput
            name="password"
            control={viewModel.control}
            label={t('login.passwordLabel')}
            placeholder={t('login.passwordPlaceholder')}
            secureTextEntry
            leftIcon="lock-outline"
            rules={viewModel.rules?.password}
            inputStyle={inputStyle}
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
            style={styles.button}
          >
            {t('login.button')}
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
        </View>
      </ScrollView>

      <CustomDialog
        visible={errorDialog.visible}
        title={t('login.errorTitle')}
        message={errorDialog.message}
        confirmText={t('common.ok')}
        onConfirm={errorDialog.dismiss}
        onDismiss={errorDialog.dismiss}
        showCancel={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: SHEET_OVERLAP + 32,
    overflow: 'hidden',
  },
  // Echo of the rings behind the web's sign-in card.
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  ringLarge: {
    width: 340,
    height: 340,
    borderRadius: 170,
    top: -130,
    right: -130,
    opacity: 0.16,
  },
  ringSmall: {
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: -70,
    left: -90,
    opacity: 0.12,
  },
  glow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    top: -50,
    left: -70,
    opacity: 0.07,
  },
  headerActions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  // The wordmark is drawn for a white ground (navy tagline, a cut-out cross),
  // so its plate is the light surface in both themes.
  logoPlate: {
    backgroundColor: AppLightTheme.colors.surface,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 8,
  },
  logo: {
    width: 200,
    height: 36,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 26,
    textAlign: 'center',
    marginTop: 24,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    opacity: 0.85,
  },
  sheet: {
    flexGrow: 1,
    marginTop: -SHEET_OVERLAP,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
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
