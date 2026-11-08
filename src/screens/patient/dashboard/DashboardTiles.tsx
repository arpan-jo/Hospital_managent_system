import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies, useAppTheme } from '@app/ui';
import { aiPalette, withAlpha } from '../../../components/ai/aiPalette';

/** A colour a tile or a shortcut wears — each keeps its own, in light and dark alike. */
export type DashboardTone = 'amber' | 'green' | 'rose' | 'brand' | 'violet' | 'pink' | 'orange' | 'teal';

/** [ink, tint] per tone. */
const TONES: Record<Exclude<DashboardTone, 'brand'>, { light: [string, string]; dark: [string, string] }> = {
  amber: { light: ['#B27400', '#FFF4DB'], dark: ['#F5C26B', '#3A2E14'] },
  green: { light: ['#1B8A4B', '#E3F6EA'], dark: ['#6FD3A0', '#173126'] },
  rose: { light: ['#C2255C', '#FDEBF2'], dark: ['#F59BBE', '#3A1C28'] },
  violet: { light: ['#7048E8', '#F0EBFF'], dark: ['#B197FC', '#261E3D'] },
  pink: { light: ['#D6336C', '#FDEBF2'], dark: ['#F59BBE', '#3A1C28'] },
  orange: { light: ['#E8590C', '#FFF0E6'], dark: ['#FFA36B', '#3A2416'] },
  teal: { light: ['#0F7B6C', '#E3F5F2'], dark: ['#5FD3C2', '#16302C'] },
};

/** A tone this file does not know falls back to amber rather than to nothing. */
const useTone = (tone: DashboardTone | undefined): { ink: string; tint: string } => {
  const theme = useAppTheme();
  if (tone === 'brand') return { ink: theme.colors.primary, tint: theme.colors.primaryContainer };
  const pair = TONES[tone as keyof typeof TONES] ?? TONES.amber;
  const [ink, tint] = theme.dark ? pair.dark : pair.light;
  return { ink, tint };
};

export interface StatTileItem {
  key: string;
  label: string;
  value: string;
  icon: string;
  tone: DashboardTone;
  /** Something waits on the patient — the figure takes the tile's colour. */
  highlight?: boolean;
  onPress: () => void;
}

const StatTile = ({ item }: { item: StatTileItem }) => {
  const theme = useAppTheme();
  const { ink, tint } = useTone(item?.tone);

  return (
    <Pressable
      onPress={() => item?.onPress?.()}
      accessibilityRole="button"
      accessibilityLabel={`${item?.label ?? ''}: ${item?.value ?? ''}`}
      style={({ pressed }) => [styles.tile, { backgroundColor: tint, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: theme.colors.surface }]}>
          <Icon name={item?.icon || 'circle-outline'} size={19} color={ink} />
        </View>
        <Icon name="arrow-top-right" size={16} color={withAlpha(ink, 0.7)} />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.tileValue, { color: item?.highlight ? ink : theme.colors.onSurface }]}
      >
        {item?.value ?? ''}
      </Text>
      <Text numberOfLines={1} style={[styles.tileLabel, { color: theme.colors.onSurfaceVariant }]}>
        {item?.label ?? ''}
      </Text>
    </Pressable>
  );
};

/** The portal's figures, two to a row, each on its own colour. */
export const StatTiles = memo<{ items: StatTileItem[] }>(function StatTiles({ items }) {
  return (
    <View style={styles.grid}>
      {(items ?? []).map(item => (
        <StatTile key={item?.key} item={item} />
      ))}
    </View>
  );
});

export interface QuickActionItem {
  key: string;
  label: string;
  icon: string;
  tone?: DashboardTone;
  onPress: () => void;
}

export interface PromoItem extends QuickActionItem {
  hint: string;
  /** The brand wash, or the home-collection teal. */
  wash: 'brand' | 'teal';
}

/** A wide card on a wash: the two things one books from home. */
const PromoCard = ({ item }: { item: PromoItem }) => {
  const theme = useAppTheme();
  const palette = aiPalette(theme);
  const teal = theme.dark
    ? { base: '#0B5A50', gradient: 'linear-gradient(135deg, #0B5A50 0%, #0F7B6C 100%)' }
    : { base: '#0F7B6C', gradient: 'linear-gradient(135deg, #0F7B6C 0%, #12B886 100%)' };
  const wash = item?.wash === 'teal' ? teal : { base: palette.base, gradient: palette.gradient };
  const ink = item?.wash === 'teal' ? '#FFFFFF' : palette.onGradient;

  return (
    <Pressable
      onPress={() => item?.onPress?.()}
      accessibilityRole="button"
      accessibilityLabel={item?.label}
      style={({ pressed }) => [
        styles.promo,
        { backgroundColor: wash.base, experimental_backgroundImage: wash.gradient, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      {/* The action's own icon, large and faint, as the card's art. */}
      <View pointerEvents="none" style={styles.promoArt}>
        <Icon name={item?.icon || 'stethoscope'} size={86} color={withAlpha(ink, 0.12)} />
      </View>
      <View style={[styles.promoIcon, { backgroundColor: withAlpha(ink, 0.18) }]}>
        <Icon name={item?.icon || 'stethoscope'} size={20} color={ink} />
      </View>
      <Text numberOfLines={2} style={[styles.promoLabel, { color: ink }]}>
        {item?.label ?? ''}
      </Text>
      <Text numberOfLines={2} style={[styles.promoHint, { color: withAlpha(ink, 0.82) }]}>
        {item?.hint ?? ''}
      </Text>
      <View style={[styles.promoGo, { backgroundColor: withAlpha(ink, 0.18) }]}>
        <Icon name="arrow-right" size={16} color={ink} />
      </View>
    </Pressable>
  );
};

/** A shortcut: a soft square in its own colour, its name under it. */
const Shortcut = ({ item }: { item: QuickActionItem }) => {
  const theme = useAppTheme();
  const { ink, tint } = useTone(item?.tone ?? 'brand');
  return (
    <Pressable
      onPress={() => item?.onPress?.()}
      accessibilityRole="button"
      accessibilityLabel={item?.label}
      style={({ pressed }) => [styles.shortcut, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.shortcutIcon, { backgroundColor: tint }]}>
        <Icon name={item?.icon || 'circle-outline'} size={24} color={ink} />
      </View>
      <Text numberOfLines={2} style={[styles.shortcutLabel, { color: theme.colors.onSurface }]}>
        {item?.label ?? ''}
      </Text>
    </Pressable>
  );
};

/**
 * The portal's quick actions: booking a visit and ordering a home collection
 * as two cards on their own washes, and the rest as a row of shortcuts.
 */
export const QuickActions = memo<{ primaries: PromoItem[]; items: QuickActionItem[] }>(function QuickActions({
  primaries,
  items,
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.actions}>
      <View style={styles.promos}>
        {(primaries ?? []).map(item => (
          <PromoCard key={item?.key} item={item} />
        ))}
      </View>
      <View style={[styles.shortcuts, { backgroundColor: theme.colors.surface }]}>
        {(items ?? []).map(item => (
          <Shortcut key={item?.key} item={item} />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  tile: {
    width: '48.3%',
    borderRadius: 22,
    padding: 14,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    marginTop: 14,
  },
  tileLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    marginTop: 1,
  },
  actions: {
    gap: 12,
  },
  promos: {
    flexDirection: 'row',
    gap: 12,
  },
  promo: {
    flex: 1,
    borderRadius: 22,
    padding: 14,
    minHeight: 150,
    overflow: 'hidden',
  },
  promoArt: {
    position: 'absolute',
    right: -14,
    bottom: -14,
  },
  promoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    marginTop: 12,
  },
  promoHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  promoGo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  shortcuts: {
    flexDirection: 'row',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  shortcutIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 7,
  },
});
