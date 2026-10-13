import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStores } from '@app/core';
import {
  CustomInput,
  CustomFormInput,
  CustomButton,
  CustomDialog,
} from '@app/ui';
import { useErrorDialog } from '../../../hooks/useErrorDialog';
import { AuthStackParamList } from '../../../navigation/AuthStackNavigator';
import AuthScreenLayout from '../AuthScreenLayout';
import { useSetPasswordViewModel } from './useSetPasswordViewModel';

const noop = () => {};

export const SetPasswordScreen = observer(() => {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'SetPassword'>>();
  const { email } = route?.params ?? {};
  const { toastStore } = useStores();
  const viewModel = useSetPasswordViewModel(route?.params);
  const errorDialog = useErrorDialog();

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
      // Account exists but the auto-login didn't take, so they are told to
      // sign in themselves.
      toastStore.show(t('setPassword.accountCreatedSignIn'), 'success');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } else if (status === 'created') {
      // Signed in already — the root navigator swaps to the app stack, so
      // there's no navigation to do here.
      toastStore.show(t('setPassword.accountCreated'), 'success');
    }
  }, [viewModel, navigation, toastStore, errorDialog, t]);

  return (
    <>
      <AuthScreenLayout
        title={t('setPassword.title')}
        subtitle={t('setPassword.subtitle')}
        onBack={goBack}
        backLabel={t('setPassword.back')}
      >
        <CustomInput
          label={t('setPassword.emailLabel')}
          value={email ?? ''}
          onChangeText={noop}
          disabled
          leftIcon="email-outline"
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
          returnKeyType="done"
          onSubmitEditing={handleCreateAccount}
        />

        <CustomButton
          mode="contained"
          onPress={handleCreateAccount}
          loading={viewModel.isLoading}
          style={styles.button}
        >
          {t('setPassword.button')}
        </CustomButton>
      </AuthScreenLayout>

      <CustomDialog
        visible={errorDialog.visible}
        title={t('setPassword.errorTitle')}
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
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
});

export default SetPasswordScreen;
