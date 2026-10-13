import React, { memo, useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface ColProps {
  children: React.ReactNode;
  span?: number; // 1–12 (12-column grid)
  flex?: number | string;
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  style?: StyleProp<ViewStyle>;
}

export const Col = memo<ColProps>(function Col({
  children,
  span,
  flex,
  alignItems = 'stretch',
  justifyContent = 'flex-start',
  style,
}) {
  const dynamicStyle = useMemo(
    () => [
      styles.col,
      {
        alignItems,
        justifyContent,
        width: span ? `${(span / 12) * 100}%` : undefined,
        flex: flex !== undefined ? (flex as any) : (span ? undefined : 1),
      } as ViewStyle,
      style,
    ],
    [alignItems, justifyContent, span, flex, style],
  );

  return <View style={dynamicStyle}>{children}</View>;
});

const styles = StyleSheet.create({
  col: {
    flexDirection: 'column',
  },
});

export default Col;
