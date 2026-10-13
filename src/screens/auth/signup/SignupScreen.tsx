import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStores } from '@app/core';
import {
  CustomFormInput,
  CustomButton,
  CustomDialog,
  fontFamilies,
} from '@app/ui';
import { useErrorDialog } from '../../../hooks/useErrorDialog';
import { AuthStackParamList } from '../../../navigation/AuthStackNavigator';
import AuthScreenLayout from '../AuthScreenLayout';
import { useSignupViewModel } from './useSignupViewModel';

export const SignupScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { toastStore } = useStores();
  const viewModel = useSignupViewModel();
  const errorDialog = useErrorDialog();

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

    toastStore.show(data?.message || t('signup.codeSent'), 'success');
    navigation.navigate('VerifyEmail', {
      email: data?.email,
      expiresInSeconds: data?.expiresInSeconds,
    });
  }, [viewModel, navigation, toastStore, errorDialog, t]);

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
      <AuthScreenLayout
        title={t('signup.title')}
        subtitle={t('signup.subtitle')}
        onBack={goBack}
        backLabel={t('signup.signIn')}
      >
        <CustomFormInput
          name="email"
          control={viewModel.control}
          label={t('signup.emailLabel')}
          placeholder={t('signup.emailPlaceholder')}
          keyboardType="email-address"
          leftIcon="email-outline"
          rules={viewModel.rules?.email}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <CustomButton
          mode="contained"
          onPress={handleSubmit}
          loading={viewModel.isLoading}
          style={styles.button}
        >
          {t('signup.button')}
        </CustomButton>

        <View style={styles.signinRow}>
          <Text style={mutedStyle}>{t('signup.haveAccount')}</Text>
          <Pressable onPress={goBack} hitSlop={8} accessibilityRole="button">
            <Text style={linkStyle}>{t('signup.signIn')}</Text>
          </Pressable>
        </View>
      </AuthScreenLayout>

      <CustomDialog
        visible={errorDialog.visible}
        title={t('signup.errorTitle')}
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
