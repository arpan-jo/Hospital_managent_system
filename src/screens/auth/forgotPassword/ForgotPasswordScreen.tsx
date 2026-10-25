import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  CustomFormInput,
  CustomButton,
  CustomDialog,
  fontFamilies,
} from '@app/ui';
import { useStores } from '@app/core';
import { useErrorDialog } from '../../../hooks/useErrorDialog';
import { AuthStackParamList } from '../../../navigation/AuthStackNavigator';
import AuthScreenLayout from '../AuthScreenLayout';
import { useForgotPasswordViewModel } from './useForgotPasswordViewModel';

export const ForgotPasswordScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { toastStore } = useStores();
  const viewModel = useForgotPasswordViewModel();
  const errorDialog = useErrorDialog();

  // Address the link went to, and the flag for the confirmation panel. A
  // link's reset happens on the web; a code's on the ResetPassword screen.
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** The server's own confirmation; '' when it sent none. */
  const [sentMessage, setSentMessage] = useState('');

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
    if (data?.phone) {
      toastStore.show(
        data?.message?.trim() || t('forgotPassword.codeSent'),
        'success',
      );
      navigation.navigate('ResetPassword', { phone: data.phone });
      return;
    }
    setSentMessage(data?.message?.trim() ?? '');
    setSentTo(data?.email?.trim() ?? '');
  }, [viewModel, errorDialog, toastStore, navigation, t]);

  const handleTryAgain = useCallback(() => setSentTo(null), []);

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
    <>
      <AuthScreenLayout
        title={
          sentTo ? t('forgotPassword.sentTitle') : t('forgotPassword.title')
        }
        subtitle={sentTo ? undefined : t('forgotPassword.description')}
        onBack={goBack}
        backLabel={t('forgotPassword.backToSignIn')}
      >
        {sentTo ? (
          <>
            <View style={styles.sentPanel}>
              <View style={badgeStyle}>
                <Icon
                  name="check-circle-outline"
                  size={36}
                  color={theme.colors.primary}
                />
              </View>

              <Text style={descriptionStyle}>
                {sentMessage || t('forgotPassword.sentDescription')}
              </Text>
              <Text style={emailStyle}>{sentTo}</Text>
              <Text style={descriptionStyle}>
                {t('forgotPassword.sentExpiry')}
              </Text>
            </View>

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
          </>
        ) : (
          <>
            <CustomFormInput
              name="identifier"
              control={viewModel.control}
              label={t('forgotPassword.identifierLabel')}
              placeholder={t('forgotPassword.identifierPlaceholder')}
              keyboardType="email-address"
              leftIcon="account-outline"
              rules={viewModel.rules?.identifier}
              returnKeyType="done"
              onSubmitEditing={handleSend}
            />

            <CustomButton
              mode="contained"
              onPress={handleSend}
              loading={viewModel.isLoading}
              style={styles.button}
            >
              {t('forgotPassword.button')}
            </CustomButton>

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
      </AuthScreenLayout>

      <CustomDialog
        visible={errorDialog.visible}
        title={t('forgotPassword.errorTitle')}
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
  sentPanel: {
    alignItems: 'center',
    marginTop: 8,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
  spamRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 24,
    marginBottom: 8,
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
