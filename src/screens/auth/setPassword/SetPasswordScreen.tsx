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
  CustomInput,
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
import { useSetPasswordViewModel } from './useSetPasswordViewModel';

const noop = () => {};

export const SetPasswordScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'SetPassword'>>();
  const { identifier } = route?.params ?? {};
  const { toastStore } = useStores();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const viewModel = useSetPasswordViewModel(route?.params);
  const errorDialog = useErrorDialog();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleCreateAccount = useCallback(async () => {
    const { status, message } = await viewModel.submit();

    if (status === 'failed') {
      errorDialog.show(message || t('setPassword.accountFailed'));
    } else if (status === 'createdNeedsLogin') {
      // Account exists but the auto-login didn't take. Keep the local string
      // here: it has to tell them to sign in, which no backend message does.
      toastStore.show(t('setPassword.accountCreatedSignIn'), 'success');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } else if (status === 'created') {
      // Signed in already — the root navigator swaps to the app stack, so
      // there's no navigation to do here.
      toastStore.show(message || t('setPassword.accountCreated'), 'success');
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
            accessibilityLabel={t('setPassword.back')}
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

          <Text style={titleStyle}>{t('setPassword.title')}</Text>
          <Text style={subtitleStyle}>{t('setPassword.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <CustomInput
            label={t('setPassword.identifierLabel')}
            value={identifier}
            onChangeText={noop}
            disabled
            leftIcon="account-outline"
          />

          <CustomFormInput
            name="password"
            control={viewModel.control}
            label={t('setPassword.passwordLabel')}
            placeholder={t('setPassword.passwordPlaceholder')}
            secureTextEntry
            leftIcon="lock-outline"
            rules={{
              required: t('setPassword.invalidPassword'),
              minLength: {
                value: 6,
                message: t('setPassword.invalidPassword'),
              },
            }}
          />

          <CustomFormInput
            name="confirmPassword"
            control={viewModel.control}
            label={t('setPassword.confirmPasswordLabel')}
            placeholder={t('setPassword.confirmPasswordPlaceholder')}
            secureTextEntry
            leftIcon="lock-outline"
            rules={{
              required: t('setPassword.invalidConfirmPassword'),
              validate: value =>
                value === viewModel.getValues('password') ||
                t('setPassword.passwordMismatch'),
            }}
          />

          <CustomButton
            mode="contained"
            onPress={handleCreateAccount}
            loading={viewModel.isLoading}
            style={styles.button}
          >
            {t('setPassword.button')}
          </CustomButton>
        </View>
      </ScrollView>

      <CustomDialog
        visible={errorDialog.visible}
        title={t('setPassword.errorTitle')}
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
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
});

export default SetPasswordScreen;
