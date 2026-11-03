import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Modal, Portal, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CustomButton, fontFamilies } from '@app/ui';
import { useAppUpdate } from '../hooks/useAppUpdate';

/**
 * "Update available" — Update opens the Play Store page; Later, Back or a tap
 * outside closes it until the next launch. Rendered once at the app's root, so
 * it shows over whichever screen the app opens on, signed in or not.
 */
export const AppUpdateDialog = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isVisible, update, dismiss } = useAppUpdate();

  return (
    <Portal>
      <Modal
        visible={isVisible}
        onDismiss={dismiss}
        contentContainerStyle={[styles.card, { backgroundColor: theme.colors.surface }]}
      >
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name="cellphone-arrow-down" size={34} color={theme.colors.primary} />
        </View>

        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {t('appUpdate.title')}
        </Text>
        <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
          {t('appUpdate.message')}
        </Text>

        <CustomButton icon="google-play" onPress={update} style={styles.updateButton}>
          {t('appUpdate.update')}
        </CustomButton>
        <CustomButton
          mode="text"
          onPress={dismiss}
          textColor={theme.colors.onSurfaceVariant}
          style={styles.laterButton}
        >
          {t('appUpdate.later')}
        </CustomButton>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 12,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    textAlign: 'center',
  },
  message: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  updateButton: {
    alignSelf: 'stretch',
    marginTop: 22,
    marginBottom: 4,
  },
  laterButton: {
    alignSelf: 'stretch',
    marginVertical: 0,
  },
});

export default AppUpdateDialog;
