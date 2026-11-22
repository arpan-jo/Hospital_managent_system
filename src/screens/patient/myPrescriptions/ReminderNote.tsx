import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '@app/ui';

interface ReminderNoteProps {
  icon: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  /** 'warning' when reminders cannot come at all; 'info' when they only may come late. */
  tone?: 'warning' | 'info';
}

/** A one-line note on why medicine reminders may not come, with the button that fixes it. */
export const ReminderNote = memo<ReminderNoteProps>(function ReminderNoteView({
  icon,
  message,
  actionLabel,
  onAction,
  tone = 'info',
}) {
  const theme = useTheme();
  const isWarning = tone === 'warning';
  const ink = isWarning ? theme.colors.onErrorContainer : theme.colors.onSurfaceVariant;

  return (
    <View
      style={[
        styles.note,
        isWarning
          ? { backgroundColor: theme.colors.errorContainer, borderColor: theme.colors.errorContainer }
          : { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
      ]}
    >
      <Icon name={icon} size={18} color={isWarning ? theme.colors.error : theme.colors.primary} />
      <Text style={[styles.message, { color: ink }]}>{message}</Text>
      <Pressable
        onPress={onAction}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        style={styles.action}
      >
        <Text style={[styles.actionText, { color: isWarning ? theme.colors.error : theme.colors.primary }]}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  message: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },
  action: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  actionText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
});

export default ReminderNote;
