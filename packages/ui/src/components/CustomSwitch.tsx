import React, { memo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Switch, Text, useTheme } from 'react-native-paper';
import { fontFamilies } from '../theme/typography';

interface CustomSwitchProps {
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  style?: ViewStyle;
  disabled?: boolean;
}

export const CustomSwitch = memo<CustomSwitchProps>(function CustomSwitch({
  label,
  value,
  onValueChange,
  style,
  disabled = false,
}) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      <Text variant="bodyLarge" style={[styles.label, { color: theme.colors.onSurface }]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: '100%',
  },
  label: {
    fontFamily: fontFamilies.semibold,
  },
});
