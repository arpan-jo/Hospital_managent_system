import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CustomButton, CustomInput, fontFamilies } from '@app/ui';
import { useLinkMobileViewModel } from './useLinkMobileViewModel';

interface LinkMobileCardProps {
  /** After a number is proven — the profile is read again, with whatever came with it. */
  onLinked?: () => void;
}

/**
 * The portal's "Already registered at the hospital?" card: a number, a code by
 * SMS, and the counter registrations carrying that number become the account's.
 */
export const LinkMobileCard = memo<LinkMobileCardProps>(function LinkMobileCard({ onLinked }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const viewModel = useLinkMobileViewModel(onLinked);
  const isBusy = viewModel.isSending || viewModel.isLinking;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
      ]}
    >
      <View style={styles.headRow}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name="cellphone-check" size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            {t('linkMobile.title')}
          </Text>
          <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            {t('linkMobile.description')}
          </Text>
        </View>
      </View>

      <CustomInput
        label={t('linkMobile.phoneLabel')}
        placeholder="01XXXXXXXXX"
        value={viewModel.phone}
        onChangeText={viewModel.setPhone}
        keyboardType="phone-pad"
        leftIcon="cellphone"
        error={viewModel.phoneError}
        disabled={viewModel.isCodeSent || isBusy}
        returnKeyType="send"
        onSubmitEditing={viewModel.isCodeSent ? undefined : viewModel.sendCode}
      />

      {viewModel.isCodeSent ? (
        <>
          <View style={styles.sentRow}>
            <Text style={[styles.sentText, { color: theme.colors.onSurfaceVariant }]}>
              {t('linkMobile.codeSentTo', { phone: viewModel.sentTo })}
            </Text>
            <Pressable
              onPress={viewModel.changeNumber}
              disabled={isBusy}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={[styles.linkText, { color: theme.colors.primary }]}>
                {t('linkMobile.changeNumber')}
              </Text>
            </Pressable>
          </View>

          <CustomInput
            label={t('linkMobile.codeLabel')}
            placeholder="123456"
            value={viewModel.code}
            onChangeText={viewModel.setCode}
            keyboardType="numeric"
            leftIcon="message-processing-outline"
            error={viewModel.codeError}
            disabled={viewModel.isLinking}
            returnKeyType="done"
            onSubmitEditing={viewModel.verify}
          />

          <CustomButton
            mode="contained"
            onPress={viewModel.verify}
            loading={viewModel.isLinking}
            disabled={isBusy}
          >
            {t('linkMobile.verify')}
          </CustomButton>
          <CustomButton
            mode="text"
            onPress={viewModel.sendCode}
            loading={viewModel.isSending}
            disabled={isBusy}
          >
            {t('linkMobile.resendCode')}
          </CustomButton>
        </>
      ) : (
        <CustomButton
          mode="contained"
          onPress={viewModel.sendCode}
          loading={viewModel.isSending}
          disabled={isBusy}
        >
          {t('linkMobile.sendCode')}
        </CustomButton>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
  },
  description: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  sentText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
  },
  linkText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
});

export default LinkMobileCard;
