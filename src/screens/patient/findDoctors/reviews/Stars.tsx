import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const STAR_COLOR = '#F5A524';

interface StarsProps {
  /** 0 to 5; a half shows as a half star when only shown. */
  value: number;
  size?: number;
  /** Makes the row a picker: each star sets the rating. */
  onPick?: (rating: number) => void;
}

/** Five stars — a reading, or, with `onPick`, the way to give one. */
export const Stars = memo<StarsProps>(function Stars({ value, size = 16, onPick }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const safe = Number.isFinite(value) ? Math.min(Math.max(value, 0), 5) : 0;

  return (
    <View
      style={styles.row}
      accessible={!onPick}
      accessibilityLabel={onPick ? undefined : t('reviews.starLabel', { count: Math.round(safe) })}
    >
      {[1, 2, 3, 4, 5].map(star => {
        // Picking is whole stars; a reading rounds to the nearest half.
        const shown = onPick ? Math.round(safe) : Math.round(safe * 2) / 2;
        const name = star <= shown ? 'star' : star - 0.5 === shown ? 'star-half-full' : 'star-outline';
        const color = star - 0.5 <= shown ? STAR_COLOR : theme.colors.outline;
        const icon = <Icon name={name} size={size} color={color} />;
        return onPick ? (
          <Pressable
            key={star}
            onPress={() => onPick(star)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t('reviews.starLabel', { count: star })}
            accessibilityState={{ selected: star === shown }}
            style={({ pressed }) => [styles.pick, { opacity: pressed ? 0.6 : 1 }]}
          >
            {icon}
          </Pressable>
        ) : (
          <View key={star}>{icon}</View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pick: {
    padding: 4,
  },
});

export default Stars;
