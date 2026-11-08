import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '@app/ui';
import { STAR_COLOR } from './Stars';

interface RatingChipProps {
  average?: number | null;
  count?: number | null;
}

/** "★ 4.5 (12)" for a doctor — nothing until someone has rated, as on the portal. */
export const RatingChip = memo<RatingChipProps>(function RatingChip({ average, count }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const reviews = Number(count ?? 0) || 0;
  if (!reviews || average === null || average === undefined || !Number.isFinite(average)) return null;
  const tint = theme.dark ? '#3A2E14' : '#FFF6E0';

  return (
    <View
      accessible
      accessibilityLabel={`${average.toFixed(1)} · ${t('reviews.count', { count: reviews })}`}
      style={[styles.chip, { backgroundColor: tint }]}
    >
      <Icon name="star" size={11} color={STAR_COLOR} />
      <Text style={[styles.average, { color: theme.colors.onSurface }]}>{average.toFixed(1)}</Text>
      <Text style={[styles.count, { color: theme.colors.onSurfaceVariant }]}>{`(${reviews})`}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  average: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  count: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
});

export default RatingChip;
