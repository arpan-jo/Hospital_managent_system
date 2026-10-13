import React, { memo, useMemo } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Divider } from 'react-native-paper';

interface CustomDividerProps {
  style?: ViewStyle;
  marginVertical?: number;
}

export const CustomDivider = memo<CustomDividerProps>(function CustomDivider({
  style,
  marginVertical = 12,
}) {
  const dividerStyle = useMemo(
    () => [styles.divider, { marginVertical }, style],
    [marginVertical, style],
  );

  return <Divider style={dividerStyle} />;
});

const styles = StyleSheet.create({
  divider: {
    height: 1,
    width: '100%',
  },
});
