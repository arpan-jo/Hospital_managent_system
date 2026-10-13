import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '@app/ui';
import { cardShadow } from './profileConstants';

interface RecordCardProps {
  /** Status/severity colour — drives the left strip and the badge. */
  accent: string;
  icon: string;
  title: string;
  badgeLabel: string;
  /** Small caption under the title, e.g. "Diagnosed: May 14, 2022". */
  meta?: string;
  metaIcon?: string;
  /** Labelled block below the divider — notes for a condition, reaction for an allergy. */
  detailLabel?: string;
  detailText?: string;
  removeLabel: string;
  onRemove: () => void;
}

/** One medical-history or allergy entry. Both lists render the same shape. */
export const RecordCard = memo<RecordCardProps>(function RecordCard({
  accent,
  icon,
  title,
  badgeLabel,
  meta,
  metaIcon,
  detailLabel,
  detailText,
  removeLabel,
  onRemove,
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        cardShadow,
        { backgroundColor: theme.colors.surface, borderLeftColor: accent },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconTile, { backgroundColor: `${accent}1A` }]}>
          <Icon name={icon} size={15} color={accent} />
        </View>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
          {meta ? (
            <View style={styles.metaRow}>
              {metaIcon ? (
                <Icon name={metaIcon} size={11} color={theme.colors.onSurfaceVariant} />
              ) : null}
              <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
                {meta}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.badge, { backgroundColor: `${accent}1A` }]}>
          <Text style={[styles.badgeText, { color: accent }]}>{badgeLabel}</Text>
        </View>
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
          style={styles.removeButton}
        >
          <Icon name="trash-can-outline" size={16} color={theme.colors.onSurfaceVariant} />
        </Pressable>
      </View>

      {detailText ? (
        <View style={[styles.detailBlock, { borderTopColor: theme.colors.outlineVariant }]}>
          <Text style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>
            {detailLabel}
          </Text>
          <Text style={[styles.detailText, { color: theme.colors.onSurface }]}>{detailText}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meta: {
    flexShrink: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
  },
  removeButton: {
    padding: 2,
  },
  detailBlock: {
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
  },
  detailLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  detailText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
});

export default RecordCard;
