import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '@app/ui';

/** A tile's colours; each figure keeps its own, in light and dark alike. */
export type StatTone = 'amber' | 'green' | 'rose' | 'brand';

const TONES: Record<Exclude<StatTone, 'brand'>, { light: [string, string]; dark: [string, string] }> = {
  amber: { light: ['#B27400', '#FEF3E0'], dark: ['#F5C26B', '#3A2E14'] },
  green: { light: ['#1B8A4B', '#E6F6EC'], dark: ['#6FD3A0', '#173126'] },
  rose: { light: ['#C2255C', '#FDEBF2'], dark: ['#F59BBE', '#3A1C28'] },
};

export interface StatTileItem {
  key: string;
  label: string;
  value: string;
  icon: string;
  tone: StatTone;
  /** Draws the figure in the tile's colour — something waits on the patient. */
  highlight?: boolean;
  onPress: () => void;
}

const StatTile = ({ item }: { item: StatTileItem }) => {
  const theme = useTheme();
  // A tone this file does not know falls back to amber rather than to nothing.
  const tone = item?.tone === 'brand' ? null : TONES[item?.tone as keyof typeof TONES] ?? TONES.amber;
  const [color, tint] = tone
    ? theme.dark
      ? tone.dark
      : tone.light
    : [theme.colors.primary, theme.colors.primaryContainer];

  return (
    <Pressable
      onPress={() => item?.onPress?.()}
      accessibilityRole="button"
      accessibilityLabel={`${item?.label ?? ''}: ${item?.value ?? ''}`}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.colors.surface, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: tint }]}>
          <Icon name={item?.icon || 'circle-outline'} size={20} color={color} />
        </View>
        <Icon name="chevron-right" size={18} color={theme.colors.outline} />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.tileValue, { color: item?.highlight ? color : theme.colors.onSurface }]}
      >
        {item?.value ?? ''}
      </Text>
      <Text numberOfLines={1} style={[styles.tileLabel, { color: theme.colors.onSurfaceVariant }]}>
        {item?.label ?? ''}
      </Text>
    </Pressable>
  );
};

/** The portal's figures, two to a row. */
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
  onPress: () => void;
}

/**
 * The portal's quick actions: the two things one books — a visit and a home
 * collection — lead as wide cards side by side, and the rest sit under them
 * as round shortcuts.
 */
export const QuickActions = memo<{ primaries: (QuickActionItem & { hint: string })[]; items: QuickActionItem[] }>(
  function QuickActions({ primaries, items }) {
    const theme = useTheme();

    return (
      <View style={[styles.actionsCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.primaries}>
          {(primaries ?? []).map(primary => (
            <Pressable
              key={primary?.key}
              onPress={() => primary?.onPress?.()}
              accessibilityRole="button"
              accessibilityLabel={primary?.label}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: theme.colors.primaryContainer, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <View style={styles.primaryTop}>
                <View style={[styles.primaryIcon, { backgroundColor: theme.colors.primary }]}>
                  <Icon name={primary?.icon || 'stethoscope'} size={20} color={theme.colors.onPrimary} />
                </View>
                <Icon name="arrow-right" size={18} color={theme.colors.primary} />
              </View>
              <Text numberOfLines={2} style={[styles.primaryLabel, { color: theme.colors.onPrimaryContainer }]}>
                {primary?.label ?? ''}
              </Text>
              <Text numberOfLines={2} style={[styles.primaryHint, { color: theme.colors.onSurfaceVariant }]}>
                {primary?.hint ?? ''}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.shortcuts}>
          {(items ?? []).map(item => (
            <Pressable
              key={item?.key}
              onPress={() => item?.onPress?.()}
              accessibilityRole="button"
              accessibilityLabel={item?.label}
              style={({ pressed }) => [styles.shortcut, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                <Icon name={item?.icon || 'circle-outline'} size={22} color={theme.colors.primary} />
              </View>
              <Text numberOfLines={2} style={[styles.shortcutLabel, { color: theme.colors.onSurface }]}>
                {item?.label ?? ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  tile: {
    width: '48.3%',
    borderRadius: 18,
    padding: 14,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    marginTop: 12,
  },
  tileLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    marginTop: 2,
  },
  actionsCard: {
    borderRadius: 20,
    padding: 12,
  },
  primaries: {
    flexDirection: 'row',
    gap: 10,
  },
  primary: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
  },
  primaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  primaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  primaryHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 1,
  },
  shortcuts: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 2,
  },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  shortcutIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 6,
  },
});
