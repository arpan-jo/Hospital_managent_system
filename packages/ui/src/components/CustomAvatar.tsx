import React, { memo, useCallback, useEffect, useState } from 'react';
import { ViewStyle, StyleSheet } from 'react-native';
import { Avatar } from 'react-native-paper';
import { getFileHeaders } from '@app/core';

interface CustomAvatarProps {
  type?: 'text' | 'image' | 'icon';
  value: string; // url, character, or icon name
  /** Initials shown when an image `value` is empty or fails to load. */
  fallback?: string;
  size?: number;
  style?: ViewStyle;
}

const toInitials = (value?: string): string =>
  String(value ?? '')
    .trim()
    .substring(0, 2)
    .toUpperCase() || '?';

export const CustomAvatar = memo<CustomAvatarProps>(function CustomAvatar({
  type = 'text',
  value,
  fallback,
  size = 40,
  style,
}) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => setHasImageError(false), [value]);

  const handleImageError = useCallback(() => setHasImageError(true), []);

  const avatarStyle = [styles.avatar, style];

  switch (type) {
    case 'image':
      return value && !hasImageError ? (
        <Avatar.Image
          // The stored-file endpoint is authenticated and `<Image>` sends no
          // header of its own; `getFileHeaders` supplies one for those urls
          // and nothing for a public one.
          source={{ uri: value, headers: getFileHeaders(value) }}
          size={size}
          style={avatarStyle}
          onError={handleImageError}
        />
      ) : (
        <Avatar.Text
          label={toInitials(fallback)}
          size={size}
          style={avatarStyle}
        />
      );
    case 'icon':
      return <Avatar.Icon icon={value} size={size} style={avatarStyle} />;
    default:
      return (
        <Avatar.Text
          label={toInitials(value)}
          size={size}
          style={avatarStyle}
        />
      );
  }
});

const styles = StyleSheet.create({
  avatar: {
    elevation: 1,
  },
});

export default CustomAvatar;
