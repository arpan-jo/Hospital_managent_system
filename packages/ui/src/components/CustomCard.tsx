import React, { memo } from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { getFileHeaders } from '@app/core';
import { fontFamilies } from '../theme/typography';

interface CustomCardProps {
  title: string;
  subtitle?: string;
  coverImage?: string;
  content?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const CustomCard = memo<CustomCardProps>(function CustomCard({
  title,
  subtitle,
  coverImage,
  content,
  actions,
  children,
  onPress,
  style,
}) {
  const theme = useTheme();

  return (
    <Card onPress={onPress} style={[styles.card, style]}>
      {coverImage && (
        <Card.Cover
          // A stored blob needs the bearer header; a public url gets none.
          source={{ uri: coverImage, headers: getFileHeaders(coverImage) }}
          style={styles.cover}
        />
      )}
      <Card.Content style={styles.content}>
        <Text variant="titleLarge" style={[styles.title, { color: theme.colors.onSurface }]}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            {subtitle}
          </Text>
        )}
        {content && (
          <Text variant="bodyLarge" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
            {content}
          </Text>
        )}
        {children}
      </Card.Content>
      {actions && <Card.Actions>{actions}</Card.Actions>}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
  },
  cover: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  content: {
    paddingVertical: 12,
  },
  title: {
    fontFamily: fontFamilies.bold,
  },
  subtitle: {
    fontFamily: fontFamilies.medium,
    marginTop: 2,
  },
  body: {
    fontFamily: fontFamilies.regular,
    marginTop: 8,
  },
});
