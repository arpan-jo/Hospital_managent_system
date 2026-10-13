import React, { memo } from 'react';
import { StyleSheet, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Chip } from 'react-native-paper';
import { fontFamilies } from '../theme/typography';

interface CustomChipProps {
  children: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  onClose?: () => void;
  icon?: string;
  /** Element shown in the leading 24px circle — an avatar, an initial, a logo. */
  avatar?: React.ReactNode;
  compact?: boolean;
  textColor?: string;
  /** Set false for filter rows that show selection through colour alone. */
  showSelectedCheck?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const CustomChip = memo<CustomChipProps>(function CustomChip({
  children,
  selected = false,
  onPress,
  onClose,
  icon,
  avatar,
  compact = false,
  textColor,
  showSelectedCheck = true,
  style,
  textStyle,
}) {
  return (
    <Chip
      selected={selected}
      onPress={onPress}
      onClose={onClose}
      icon={icon}
      avatar={avatar}
      compact={compact}
      showSelectedCheck={showSelectedCheck}
      style={[styles.chip, style]}
      textStyle={[styles.text, textColor ? { color: textColor } : null, textStyle]}
    >
      {children}
    </Chip>
  );
});

const styles = StyleSheet.create({
  chip: {
    margin: 4,
    borderRadius: 8,
  },
  text: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
  },
});
