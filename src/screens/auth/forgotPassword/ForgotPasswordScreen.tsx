import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Image, ScrollView, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  CustomFormInput,
  CustomButton,
  CustomThemeToggler,
  CustomDialog,
  fontFamilies,
} from '@app/ui';
import { images } from '../../../assets/images';
import { useErrorDialog } from '../../../hooks/useErrorDialog';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useKeyboardHeight } from '../../../hooks/useKeyboardHeight';
import { useForgotPasswordViewModel } from './useForgotPasswordViewModel';

export const ForgotPasswordScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const viewModel = useForgotPasswordViewModel();
  const errorDialog = useErrorDialog();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  // Address the link went to, and the flag for the confirmation panel. The
  // reset itself happens on the web, so this screen has nowhere to navigate.
  const [sentTo, setSentTo] = useState<string | null>(null);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleSend = useCallback(async () => {
    const { data, error } = await viewModel.submit();
    if (!data) {
      if (error) {
        errorDialog.show(error);
      }
      return;
    }
    setSentTo(data?.email?.trim() ?? '');
  }, [viewModel, errorDialog]);

  const handleTryAgain = useCallback(() => setSentTo(null), []);

  const containerStyle = useMemo(
    () => [styles.container, { backgroundColor: theme.colors.background }],
    [theme.colors.background],
  );

  const titleStyle = useMemo(
    () => [styles.title, { color: theme.colors.onSurface }],
    [theme.colors.onSurface],
  );

  const descriptionStyle = useMemo(
    () => [styles.description, { color: theme.colors.onSurfaceVariant }],
    [theme.colors.onSurfaceVariant],
  );

  const linkStyle = useMemo(
    () => [styles.link, { color: theme.colors.primary }],
    [theme.colors.primary],
  );

  const badgeStyle = useMemo(
    () => [styles.badge, { backgroundColor: theme.colors.primaryContainer }],
    [theme.colors.primaryContainer],
  );

  const emailStyle = useMemo(
    () => [styles.email, { color: theme.colors.onSurface }],
    [theme.colors.onSurface],
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
            accessibilityLabel={t('forgotPassword.backToSignIn')}
          >
            <Icon name="arrow-left" size={22} color={theme.colors.onSurface} />
          </Pressable>
          <CustomThemeToggler />
        </View>

        {sentTo ? (
          <>
            <View style={styles.hero}>
              <View style={badgeStyle}>
                <Icon
                  name="check-circle-outline"
                  size={36}
                  color={theme.colors.primary}
                />
              </View>

              <Text style={titleStyle}>{t('forgotPassword.sentTitle')}</Text>
              <Text style={descriptionStyle}>
                {t('forgotPassword.sentDescription')}
              </Text>
              <Text style={emailStyle}>{sentTo}</Text>
              <Text style={descriptionStyle}>
                {t('forgotPassword.sentExpiry')}
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.spamRow}>
                <Text style={descriptionStyle}>
                  {t('forgotPassword.sentSpam')}
                </Text>
                <Pressable
                  onPress={handleTryAgain}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={linkStyle}>{t('forgotPassword.tryAgain')}</Text>
                </Pressable>
              </View>

              <CustomButton
                mode="contained"
                onPress={goBack}
                style={styles.button}
              >
                {t('forgotPassword.backToSignInButton')}
              </CustomButton>
            </View>
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <Image
                source={images.logo}
                style={styles.logo}
                resizeMode="contain"
                accessibilityRole="image"
                accessibilityLabel="Hospital Management System"
              />

              <Text style={titleStyle}>{t('forgotPassword.title')}</Text>
              <Text style={descriptionStyle}>
                {t('forgotPassword.description')}
              </Text>
            </View>

            <View style={styles.form}>
              <CustomFormInput
                name="email"
                control={viewModel.control}
                label={t('forgotPassword.emailLabel')}
                placeholder={t('forgotPassword.emailPlaceholder')}
                keyboardType="email-address"
                leftIcon="email-outline"
                rules={{
                  required: t('forgotPassword.invalidEmail'),
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: t('forgotPassword.invalidEmail'),
                  },
                }}
              />

              <CustomButton
                mode="contained"
                onPress={handleSend}
                loading={viewModel.isLoading}
                style={styles.button}
              >
                {t('forgotPassword.button')}
              </CustomButton>
            </View>

            <Pressable
              onPress={goBack}
              hitSlop={8}
              style={styles.backLinkRow}
              accessibilityRole="button"
            >
              <Icon name="arrow-left" size={16} color={theme.colors.primary} />
              <Text style={linkStyle}>{t('forgotPassword.backToSignIn')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <CustomDialog
        visible={errorDialog.visible}
        title={t('forgotPassword.errorTitle')}
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
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    textAlign: 'center',
    marginTop: 12,
  },
  description: {
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  email: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  form: {
    marginTop: 28,
  },
  spamRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
  backLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  link: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
});

export default ForgotPasswordScreen;
