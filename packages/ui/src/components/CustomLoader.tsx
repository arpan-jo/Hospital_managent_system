import React, { memo, useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { ActivityIndicator, Text, Portal, useTheme } from 'react-native-paper';
import { fontFamilies } from '../theme/typography';

interface CustomLoaderProps {
  visible: boolean;
  message?: string;
  isFullScreen?: boolean;
  style?: ViewStyle;
}

export const CustomLoader = memo<CustomLoaderProps>(function CustomLoader({
  visible,
  message,
  isFullScreen = true,
  style,
}) {
  const theme = useTheme();

  const backdropStyle = useMemo(
    () => [
      isFullScreen ? styles.fullscreen : styles.inline,
      style,
      { backgroundColor: isFullScreen ? 'rgba(0,0,0,0.4)' : 'transparent' } as ViewStyle,
    ],
    [isFullScreen, style],
  );

  const boxStyle = useMemo(
    () => [styles.box, { backgroundColor: theme.colors.elevation.level3 }],
    [theme.colors.elevation.level3],
  );

  if (!visible) { return null; }

  const content = (
    <View style={backdropStyle}>
      <View style={boxStyle}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        {message && (
          <Text style={[styles.text, { color: theme.colors.onSurface }]}>
            {message}
          </Text>
        )}
      </View>
    </View>
  );

  return isFullScreen ? <Portal>{content}</Portal> : content;
});

const styles = StyleSheet.create({
  fullscreen: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  inline: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 120,
    maxWidth: '80%',
  },
  text: {
    marginTop: 16,
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    textAlign: 'center',
  },
});
