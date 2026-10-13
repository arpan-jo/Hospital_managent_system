import React, { memo } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Badge } from 'react-native-paper';
import { fontFamilies } from '../theme/typography';

interface CustomBadgeProps {
  children?: string | number;
  visible?: boolean;
  size?: number;
  style?: ViewStyle;
}

export const CustomBadge = memo<CustomBadgeProps>(function CustomBadge({
  children,
  visible = true,
  size = 20,
  style,
}) {
  return (
    <Badge visible={visible} size={size} style={[styles.badge, style]}>
      {children}
    </Badge>
  );
});

const styles = StyleSheet.create({
  badge: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
});
