import React, { memo } from 'react';
import { StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Button } from 'react-native-paper';
import { fontFamilies } from '../theme/typography';

interface CustomButtonProps {
  mode?: 'text' | 'outlined' | 'contained' | 'elevated' | 'contained-tonal';
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  buttonColor?: string;
  textColor?: string;
}

export const CustomButton = memo<CustomButtonProps>(function CustomButton({
  mode = 'contained',
  onPress,
  loading = false,
  disabled = false,
  icon,
  children,
  style,
  labelStyle,
  buttonColor,
  textColor,
}) {
  return (
    <Button
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      icon={icon}
      style={[styles.button, style]}
      labelStyle={[styles.label, labelStyle]}
      buttonColor={buttonColor}
      textColor={textColor}
    >
      {children}
    </Button>
  );
});

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    marginVertical: 8,
    paddingVertical: 4,
  },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
  },
});
