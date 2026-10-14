import React, { useCallback, useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { RecordPatient } from '@app/core';
import { CustomSearchbar, fontFamilies } from '@app/ui';
import FilterPills, { FilterPill } from './FilterPills';
import RecordState from './RecordState';
import { RECORD_TONE, RecordKind, recordTone } from './reportsUi';
import { EVERYONE, RecordListViewModel } from './useRecordList';

export type BadgeTone = 'brand' | 'muted' | 'warn';

export interface RecordBadge {
  label: string;
  tone: BadgeTone;
}

interface RecordListSectionProps<T extends RecordPatient> {
  kind: RecordKind;
  viewModel: RecordListViewModel<T>;
  bottomPadding: number;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyHint: string;
  noMatchTitle: string;
  keyOf: (item: T) => string;
  titleOf: (item: T) => string;
  /** Joined with " · ", blanks left out. */
  metaOf: (item: T) => (string | null | undefined)[];
  badgesOf: (item: T) => RecordBadge[];
  onOpen: (item: T) => void;
}

/**
 * A hospital-issued list on the Reports page, as the portal draws each one:
 * family chips when the records span more than one person, a search, and a
 * card per record that opens it in full.
 */
export function RecordListSection<T extends RecordPatient>({
  kind,
  viewModel,
  bottomPadding,
  searchPlaceholder,
  emptyTitle,
  emptyHint,
  noMatchTitle,
  keyOf,
  titleOf,
  metaOf,
  badgesOf,
  onOpen,
}: RecordListSectionProps<T>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const tone = recordTone(kind, theme.dark);

  const badgeColors: Record<BadgeTone, { color: string; tint: string }> = useMemo(
    () => ({
      brand: { color: theme.colors.primary, tint: theme.colors.primaryContainer },
      muted: { color: theme.colors.onSurfaceVariant, tint: theme.colors.surfaceVariant },
      warn: theme.dark
        ? { color: '#F5C26B', tint: '#3A2E14' }
        : { color: '#B27400', tint: '#FEF3E0' },
    }),
    [theme],
  );

  const patientPills: FilterPill[] = useMemo(
    () => [
      { key: EVERYONE, label: t('reports.everyone') },
      ...(viewModel.patients ?? []).map(patient => ({ key: patient.code, label: patient.name })),
    ],
    [viewModel.patients, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: T }) => {
      const meta = metaOf(item)
        .map(part => (part ?? '').trim())
        .filter(Boolean)
        .join(' · ');
      const badges = badgesOf(item).filter(badge => badge.label);
      return (
        <Pressable
          onPress={() => onOpen(item)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: theme.colors.surface, opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <View style={[styles.iconTile, { backgroundColor: tone.tint }]}>
            <Icon name={RECORD_TONE[kind].icon} size={22} color={tone.color} />
          </View>
          <View style={styles.body}>
            <Text numberOfLines={1} style={[styles.title, { color: theme.colors.onSurface }]}>
              {titleOf(item)}
            </Text>
            {meta ? (
              <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
                {meta}
              </Text>
            ) : null}
            {badges.length ? (
              <View style={styles.badges}>
                {badges.map(badge => (
                  <View
                    key={`${badge.tone}-${badge.label}`}
                    style={[styles.badge, { backgroundColor: badgeColors[badge.tone].tint }]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.badgeText, { color: badgeColors[badge.tone].color }]}
                    >
                      {badge.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <Icon name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
        </Pressable>
      );
    },
    [theme, tone, kind, badgeColors, metaOf, badgesOf, titleOf, onOpen],
  );

  const hasFilter = !!viewModel.patientCode || viewModel.search.trim() !== '';
  const empty = viewModel.isLoading ? (
    <RecordState loading />
  ) : viewModel.error !== null ? (
    <RecordState
      isError
      title={t('reports.recordsLoadFailed')}
      hint={viewModel.error || t('reports.recordsLoadFailedHint')}
      actionLabel={t('reports.tryAgain')}
      onAction={viewModel.retry}
    />
  ) : hasFilter && viewModel.hasRecords ? (
    <RecordState icon="filter-variant" title={noMatchTitle} hint={t('reports.recordsNoMatchHint')} />
  ) : (
    <RecordState icon={RECORD_TONE[kind].icon} title={emptyTitle} hint={emptyHint} />
  );

  return (
    <View style={styles.container}>
      {/* A failed read replaces the whole section, filters included, as on the portal. */}
      {viewModel.error === null ? (
        <>
          <View style={styles.searchRow}>
            <CustomSearchbar
              value={viewModel.search}
              onChangeText={viewModel.setSearch}
              placeholder={searchPlaceholder}
              style={styles.searchbar}
            />
          </View>
          {viewModel.showPatients ? (
            <FilterPills
              items={patientPills}
              selected={viewModel.patientCode}
              onSelect={viewModel.setPatientCode}
            />
          ) : null}
        </>
      ) : null}

      <FlatList
        data={viewModel.isLoading || viewModel.error !== null ? [] : viewModel.items}
        keyExtractor={keyOf}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPadding }]}
        ListEmptyComponent={empty}
        refreshControl={
          <RefreshControl
            refreshing={viewModel.isRefreshing}
            onRefresh={viewModel.refresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchbar: {
    marginVertical: 0,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
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

export default RecordListSection;
