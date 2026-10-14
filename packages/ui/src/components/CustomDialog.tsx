import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Dialog, Portal, Text, Button } from 'react-native-paper';
import { fontFamilies } from '../theme/typography';

interface CustomDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onDismiss: () => void;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  /**
   * False for a question whose Cancel does something final (Discard): only the
   * buttons answer it then, never a stray tap outside or Android Back.
   */
  dismissable?: boolean;
  /** Shows the confirm button busy while its action runs. */
  loading?: boolean;
}

export const CustomDialog = memo<CustomDialogProps>(function CustomDialog({
  visible,
  title,
  message,
  onConfirm,
  onDismiss,
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = true,
  dismissable = true,
  loading = false,
}) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} dismissable={dismissable}>
        <Dialog.Title style={styles.title}>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={styles.message}>
            {message}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          {showCancel && (
            <Button onPress={onDismiss} labelStyle={styles.actionBtn}>
              {cancelText}
            </Button>
          )}
          <Button
            onPress={onConfirm}
            loading={loading}
            disabled={loading}
            labelStyle={styles.actionBtn}
          >
            {confirmText}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
});

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamilies.bold,
  },
  message: {
    fontFamily: fontFamilies.regular,
  },
  actionBtn: {
    fontFamily: fontFamilies.semibold,
  },
});
