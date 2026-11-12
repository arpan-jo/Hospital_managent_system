import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text, Button, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '../theme/typography';

/**
 * What the question is: `default` asks, `danger` asks before something that
 * cannot be taken back (delete, cancel, sign out — its button is red), and
 * `error` tells of a failure.
 */
export type CustomDialogTone = 'default' | 'danger' | 'error';

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
  tone?: CustomDialogTone;
  /** A MaterialCommunityIcons name for the badge on top; each tone has its own otherwise. */
  icon?: string;
}

const TONE_ICON: Record<CustomDialogTone, string> = {
  default: 'help-circle-outline',
  danger: 'alert-circle-outline',
  error: 'alert-circle-outline',
};

/** Past this many characters two buttons no longer fit side by side on a small phone. */
const SIDE_BY_SIDE_MAX = 14;

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
  tone = 'default',
  icon,
}) {
  const theme = useTheme();
  const isRed = tone === 'danger' || tone === 'error';
  const accent = isRed ? theme.colors.error : theme.colors.primary;
  const badgeTint = isRed ? `${theme.colors.error}1F` : theme.colors.primaryContainer;
  const confirmColor = tone === 'danger' ? theme.colors.error : theme.colors.primary;
  const onConfirmColor = tone === 'danger' ? theme.colors.onError : theme.colors.onPrimary;

  const stacked =
    showCancel &&
    Math.max(String(confirmText ?? '').length, String(cancelText ?? '').length) > SIDE_BY_SIDE_MAX;

  const confirmButton = (
    <Button
      mode="contained"
      onPress={onConfirm}
      loading={loading}
      disabled={loading}
      buttonColor={confirmColor}
      textColor={onConfirmColor}
      style={[styles.action, !stacked && styles.actionFlex]}
      contentStyle={styles.actionContent}
      labelStyle={styles.actionLabel}
    >
      {confirmText}
    </Button>
  );

  const cancelButton = showCancel ? (
    <Button
      mode="outlined"
      onPress={onDismiss}
      textColor={theme.colors.onSurface}
      style={[
        styles.action,
        !stacked && styles.actionFlex,
        { borderColor: theme.colors.outlineVariant },
      ]}
      contentStyle={styles.actionContent}
      labelStyle={styles.actionLabel}
    >
      {cancelText}
    </Button>
  ) : null;

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        dismissable={dismissable}
        style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.body}>
          <View style={[styles.badge, { backgroundColor: badgeTint }]}>
            <Icon name={icon || TONE_ICON[tone] || TONE_ICON.default} size={28} color={accent} />
          </View>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
          ) : null}
        </View>

        {/* Side by side, Cancel first; stacked with the answer on top when a label is long. */}
        <View style={[styles.actions, stacked && styles.actionsStacked]}>
          {stacked ? (
            <>
              {confirmButton}
              {cancelButton}
            </>
          ) : (
            <>
              {cancelButton}
              {confirmButton}
            </>
          )}
        </View>
      </Dialog>
    </Portal>
  );
});

const styles = StyleSheet.create({
  dialog: {
    // Paper's MD3 dialog takes 7× the theme's roundness — a pill at ours.
    borderRadius: 24,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 19,
    lineHeight: 26,
    textAlign: 'center',
  },
  message: {
    fontFamily: fontFamilies.regular,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  action: {
    borderRadius: 12,
  },
  actionFlex: {
    flex: 1,
  },
  actionContent: {
    height: 46,
  },
  actionLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    marginHorizontal: 12,
  },
});
