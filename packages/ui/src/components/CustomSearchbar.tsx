import React, { memo, useMemo } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Searchbar, useTheme } from 'react-native-paper';
import { fontFamilies } from '../theme/typography';

interface CustomSearchbarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}

export const CustomSearchbar = memo<CustomSearchbarProps>(
  function CustomSearchbar({
    value,
    onChangeText,
    placeholder = 'Search...',
    style,
  }) {
    const theme = useTheme();

    // Paper reads the typed text off `onSurfaceVariant` (a muted grey) and the
    // placeholder off `onSurface` (the solid one) — backwards for us, so both
    // are pinned here instead.
    const inputStyle = useMemo(
      () => [styles.input, { color: theme.colors.onSurface }],
      [theme.colors.onSurface],
    );

    const searchbarTheme = useMemo(
      () => ({ colors: { onSurface: theme.colors.onSurfaceVariant } }),
      [theme.colors.onSurfaceVariant],
    );

    return (
      <Searchbar
        placeholder={placeholder}
        onChangeText={onChangeText}
        value={value}
        style={[styles.search, style]}
        inputStyle={inputStyle}
        theme={searchbarTheme}
      />
    );
  },
);

const styles = StyleSheet.create({
  search: {
    borderRadius: 8,
    marginVertical: 8,
    height: 48,
    justifyContent: 'center',
  },
  input: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    minHeight: 0,
  },
});

export default CustomSearchbar;
