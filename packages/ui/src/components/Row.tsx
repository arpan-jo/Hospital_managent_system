import React, { memo, useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface RowProps {
  children: React.ReactNode;
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  gap?: number;
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Row = memo<RowProps>(function Row({
  children,
  alignItems = 'stretch',
  justifyContent = 'flex-start',
  gap = 0,
  wrap = true,
  style,
}) {
  const dynamicStyle = useMemo(
    () => [
      styles.row,
      { alignItems, justifyContent, gap, flexWrap: wrap ? 'wrap' : 'nowrap' } as ViewStyle,
      style,
    ],
    [alignItems, justifyContent, gap, wrap, style],
  );

  return <View style={dynamicStyle}>{children}</View>;
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    width: '100%',
  },
});

export default Row;
