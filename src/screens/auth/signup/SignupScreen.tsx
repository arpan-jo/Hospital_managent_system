import React, { useCallback, useMemo } from 'react';
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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStores } from '@app/core';
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
import { AuthStackParamList } from '../../../navigation/AuthStackNavigator';
import {
  getIdentifierKind,
  isValidIdentifier,
  useSignupViewModel,
} from './useSignupViewModel';

export const SignupScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { toastStore } = useStores();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const viewModel = useSignupViewModel();
  const errorDialog = useErrorDialog();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const isPhoneIdentifier = viewModel.identifierKind === 'phone';

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleSubmit = useCallback(async () => {
    const { data, error } = await viewModel.submit();
    if (!data) {
      if (error) {
        errorDialog.show(error);
      }
      return;
    }

    if (viewModel?.identifierKind === 'phone') {
      navigation.navigate('SetPassword', { identifier: data?.identifier });
    } else {
      toastStore.show(data?.message || t('signup.codeSent'), 'success');
      navigation.navigate('VerifyEmail', {
        identifier: data?.identifier,
        expiresInSeconds: data?.expiresInSeconds,
      });
    }
  }, [viewModel, navigation, toastStore, errorDialog, t]);

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
          <Pressable
            onPress={goBack}
            hitSlop={8}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={t('signup.signIn')}
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

          <Text style={titleStyle}>{t('signup.title')}</Text>
          <Text style={subtitleStyle}>{t('signup.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <CustomFormInput
            name="identifier"
            control={viewModel.control}
            label={t('signup.identifierLabel')}
            placeholder={t('signup.identifierPlaceholder')}
            leftIcon="email-outline"
            rules={{
              required: t('signup.invalidIdentifier'),
              validate: value =>
                isValidIdentifier(value) ||
                t(
                  getIdentifierKind(value) === 'phone'
                    ? 'signup.invalidPhone'
                    : 'signup.invalidEmail',
                ),
            }}
          />

          <CustomButton
            mode="contained"
            onPress={handleSubmit}
            loading={viewModel.isLoading}
            style={styles.button}
          >
            {isPhoneIdentifier
              ? t('signup.buttonContinue')
              : t('signup.button')}
          </CustomButton>
        </View>

        <View style={styles.signinRow}>
          <Text style={mutedStyle}>{t('signup.haveAccount')}</Text>
          <Pressable onPress={goBack} hitSlop={8} accessibilityRole="button">
            <Text style={linkStyle}>{t('signup.signIn')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <CustomDialog
        visible={errorDialog.visible}
        title={t('signup.errorTitle')}
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
    marginTop: 8,
  },
  logo: {
    width: 176,
    height: 32,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    textAlign: 'center',
    marginTop: 10,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  form: {
    marginTop: 24,
  },
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
  signinRow: {
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
  link: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
});

export default SignupScreen;
