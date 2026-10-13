import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '@app/ui';
import { cardShadow, useWarningColors } from './profileConstants';

/** Small inline spinner shown while a tab's list is loading. */
export const SectionLoader = memo(function SectionLoader() {
  const theme = useTheme();

  return (
    <View style={styles.sectionLoader}>
      <ActivityIndicator size="small" color={theme.colors.primary} />
    </View>
  );
});

/** One icon + label + value row inside an information card. */
export const InfoRow = memo<{
  icon: string;
  label: string;
  value: string;
  last?: boolean;
  /** Amber tint, matching the emergency-contact card it sits in. */
  warning?: boolean;
}>(function InfoRow({ icon, label, value, last, warning }) {
  const theme = useTheme();
  const amber = useWarningColors(theme.dark);

  return (
    <View
      style={[
        styles.infoRow,
        !last && {
          borderBottomWidth: 1,
          borderBottomColor: warning ? amber.border : theme.colors.outlineVariant,
        },
      ]}
    >
      <View
        style={[
          styles.infoIconTile,
          { backgroundColor: warning ? amber.iconTile : theme.colors.primaryContainer },
        ]}
      >
        <Icon name={icon} size={15} color={warning ? amber.border : theme.colors.primary} />
      </View>
      <View style={styles.infoText}>
        <Text
          style={[
            styles.infoLabel,
            { color: warning ? amber.title : theme.colors.onSurfaceVariant },
          ]}
        >
          {label}
        </Text>
        <Text style={[styles.infoValue, { color: warning ? amber.value : theme.colors.onSurface }]}>
          {value || '—'}
        </Text>
      </View>
    </View>
  );
});

export const SectionCard = memo<{
  title: string;
  children: React.ReactNode;
  icon?: string;
  /** Amber treatment used for the emergency contact block. */
  warning?: boolean;
}>(function SectionCard({ title, children, icon, warning }) {
  const theme = useTheme();
  const amber = useWarningColors(theme.dark);

  return (
    <View
      style={[
        styles.sectionCard,
        cardShadow,
        {
          backgroundColor: warning ? amber.background : theme.colors.surface,
          borderColor: warning ? amber.border : 'transparent',
          borderWidth: warning ? 1 : 0,
        },
      ]}
    >
      <View style={styles.sectionTitleRow}>
        {warning || icon ? (
          <Icon
            name={warning ? 'alert-outline' : (icon as string)}
            size={15}
            color={warning ? amber.border : theme.colors.primary}
          />
        ) : null}
        <Text
          style={[styles.sectionTitle, { color: warning ? amber.title : theme.colors.onSurface }]}
        >
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
});

/** "3 conditions on record" on the left, a compact add pill on the right. */
export const ListHeader = memo<{ title: string; actionLabel: string; onAction: () => void }>(
  function ListHeader({ title, actionLabel, onAction }) {
    const theme = useTheme();

    return (
      <View style={styles.listHeaderRow}>
        <Text style={[styles.listCount, { color: theme.colors.onSurfaceVariant }]}>{title}</Text>
        <Pressable
          onPress={onAction}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={[styles.addPill, { backgroundColor: theme.colors.primary }]}
        >
          <Icon name="plus" size={13} color={theme.colors.onPrimary} />
          <Text style={[styles.addPillText, { color: theme.colors.onPrimary }]}>{actionLabel}</Text>
        </Pressable>
      </View>
    );
  },
);

/** Shown in place of a list that has nothing in it yet. */
export const EmptyState = memo<{
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}>(function EmptyState({ icon, title, description, actionLabel, onAction }) {
  const theme = useTheme();

  return (
    <View style={[styles.empty, { borderColor: theme.colors.outlineVariant }]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryContainer }]}>
        <Icon name={icon} size={22} color={theme.colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>{title}</Text>
      {description ? (
        <Text style={[styles.emptyDesc, { color: theme.colors.onSurfaceVariant }]}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={[styles.emptyAction, { borderColor: theme.colors.primary }]}
        >
          <Icon name="plus" size={14} color={theme.colors.primary} />
          <Text style={[styles.emptyActionText, { color: theme.colors.primary }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  sectionLoader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoIconTile: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
  },
  infoValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    marginTop: 1,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 18,
    marginBottom: 12,
  },
  listCount: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addPillText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  empty: {
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 26,
    marginTop: 4,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    marginTop: 12,
  },
  emptyDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 14,
  },
  emptyActionText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
});
