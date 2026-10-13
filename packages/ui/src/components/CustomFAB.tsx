import React, { memo } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { FAB } from 'react-native-paper';

interface CustomFABProps {
  icon: string;
  onPress: () => void;
  label?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export const CustomFAB = memo<CustomFABProps>(function CustomFAB({
  icon,
  onPress,
  label,
  style,
  disabled = false,
}) {
  return (
    <FAB
      icon={icon}
      onPress={onPress}
      label={label}
      disabled={disabled}
      style={[styles.fab, style]}
    />
  );
});

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
