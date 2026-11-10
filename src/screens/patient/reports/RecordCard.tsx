import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '@app/ui';
import { RECORD_TONE, RecordKind, recordTone } from './reportsUi';

export type BadgeTone = 'brand' | 'muted' | 'warn';

export interface RecordBadge {
  label: string;
  tone: BadgeTone;
}

/** A second thing a card can do beside opening — a radiology test's images, removing an upload. */
export interface RecordAction {
  icon: string;
  /** Read out by the screen reader; the button shows only its icon. */
  label: string;
  /** Shows a spinner in place of the icon; presses are ignored by the caller. */
  isBusy?: boolean;
  /** Drawn in the error colour — the action takes something away. */
  destructive?: boolean;
  onPress: () => void;
}

/** A badge's ink and fill, from the theme so it holds in light and dark alike. */
export const useBadgeColors = (): Record<BadgeTone, { color: string; tint: string }> => {
  const theme = useTheme();
  return useMemo(
    () => ({
      brand: { color: theme.colors.primary, tint: theme.colors.primaryContainer },
      muted: { color: theme.colors.onSurfaceVariant, tint: theme.colors.surfaceVariant },
      warn: theme.dark ? { color: '#F5C26B', tint: '#3A2E14' } : { color: '#B27400', tint: '#FEF3E0' },
    }),
    [theme],
  );
};

interface RecordCardProps {
  kind: RecordKind;
  title: string;
  /** Joined with " · ", blanks left out. */
  meta: (string | null | undefined)[];
  badges: RecordBadge[];
  /** Without it the card is not pressable and shows no chevron. */
  onOpen?: () => void;
  /** One button, or a few side by side — e.g. preview and remove, as the portal's row has. */
  action?: RecordAction | RecordAction[] | null;
}

/** One record on a list — the kind's icon tile, a title, a meta line, badges, and what it can do. */
export const RecordCard = memo<RecordCardProps>(function RecordCard({ kind, title, meta, badges, onOpen, action }) {
  const theme = useTheme();
  const tone = recordTone(kind, theme.dark);
  const badgeColors = useBadgeColors();
  const metaLine = (meta ?? [])
    .map(part => String(part ?? '').trim())
    .filter(Boolean)
    .join(' · ');
  const shownBadges = (badges ?? []).filter(badge => badge?.label);
  const actions = (Array.isArray(action) ? action : action ? [action] : []).filter(Boolean);

  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      accessibilityRole={onOpen ? 'button' : undefined}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.colors.surface, opacity: onOpen && pressed ? 0.92 : 1 },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: tone.tint }]}>
        <Icon name={RECORD_TONE[kind]?.icon ?? 'file-outline'} size={22} color={tone.color} />
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.colors.onSurface }]}>
          {title}
        </Text>
        {metaLine ? (
          <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
            {metaLine}
          </Text>
        ) : null}
        {shownBadges.length ? (
          <View style={styles.badges}>
            {shownBadges.map(badge => (
              <View
                key={`${badge.tone}-${badge.label}`}
                style={[styles.badge, { backgroundColor: badgeColors[badge.tone]?.tint }]}
              >
                <Text numberOfLines={1} style={[styles.badgeText, { color: badgeColors[badge.tone]?.color }]}>
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {actions.map((item, index) => {
        const color = item?.destructive ? theme.colors.error : tone.color;
        const tint = item?.destructive ? theme.colors.errorContainer : tone.tint;
        return (
          // Not `disabled` while busy: a disabled button lets the press
          // through to the card, which would open the record instead.
          <Pressable
            key={`${item?.icon}-${index}`}
            onPress={() => item?.onPress?.()}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={item?.label ?? ''}
            accessibilityState={{ busy: !!item?.isBusy }}
            style={({ pressed }) => [styles.action, { backgroundColor: tint, opacity: pressed ? 0.7 : 1 }]}
          >
            {item?.isBusy ? (
              <ActivityIndicator size={16} color={color} />
            ) : (
              <Icon name={item?.icon || 'image-outline'} size={19} color={color} />
            )}
          </Pressable>
        );
      })}
      {onOpen ? <Icon name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    marginHorizontal: 12,
  },
  action: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  meta: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 3,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  badgeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
});

export default RecordCard;
