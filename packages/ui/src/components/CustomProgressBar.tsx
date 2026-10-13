import React, { memo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { ProgressBar, Text, useTheme } from 'react-native-paper';
import { fontFamilies } from '../theme/typography';

interface CustomProgressBarProps {
  progress: number; // 0 to 1
  label?: string;
  style?: ViewStyle;
}

export const CustomProgressBar = memo<CustomProgressBarProps>(function CustomProgressBar({
  progress,
  label,
  style,
}) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.header}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>
            {label}
          </Text>
          <Text style={[styles.percent, { color: theme.colors.primary }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      )}
      <ProgressBar
        progress={progress}
        color={theme.colors.primary}
        style={styles.bar}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  percent: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
  bar: {
    height: 8,
    borderRadius: 4,
  },
});
