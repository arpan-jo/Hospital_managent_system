import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CustomButton, fontFamilies } from '@app/ui';

interface RecordStateProps {
  /** A spinner in place of everything else. */
  loading?: boolean;
  icon?: string;
  /** Red, for a failure. */
  isError?: boolean;
  title?: string;
  hint?: string;
  actionLabel?: string;
  actionIcon?: string;
  /** Outlined for "Try again", filled for a call to action. */
  actionMode?: 'outlined' | 'contained';
  onAction?: () => void;
}

/** The loading, empty and error states every list and record on the Reports page uses. */
export const RecordState = ({
  loading,
  icon = 'folder-open-outline',
  isError,
  title,
  hint,
  actionLabel,
  actionIcon,
  actionMode = 'outlined',
  onAction,
}: RecordStateProps) => {
  const theme = useTheme();

  if (loading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.state}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: isError ? theme.colors.errorContainer : theme.colors.primaryContainer },
        ]}
      >
        <Icon
          name={isError ? 'alert-circle-outline' : icon}
          size={26}
          color={isError ? theme.colors.error : theme.colors.primary}
        />
      </View>
      {title ? (
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
      ) : null}
      {hint ? (
        <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>{hint}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <CustomButton mode={actionMode} icon={actionIcon} onPress={onAction} style={styles.button}>
          {actionLabel}
        </CustomButton>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    textAlign: 'center',
  },
  hint: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
  },
  button: {
    marginTop: 18,
    borderRadius: 12,
    minWidth: 160,
  },
});

export default RecordState;
