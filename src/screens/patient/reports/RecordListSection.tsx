import React, { ReactNode, useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RecordPatient } from '@app/core';
import { CustomSearchbar } from '@app/ui';
import FilterPills, { FilterPill } from './FilterPills';
import RecordCard, { RecordAction, RecordBadge } from './RecordCard';
import RecordState from './RecordState';
import { RECORD_TONE, RecordKind } from './reportsUi';
import { EVERYONE, RecordListViewModel } from './useRecordList';

export type { BadgeTone, RecordAction, RecordBadge } from './RecordCard';

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
  /** Opens a record; without it a card is not pressable and shows no chevron. */
  onOpen?: (item: T) => void;
  /** Shown above the cards, scrolling with them — a summary of the list. */
  header?: ReactNode;
  /**
   * The header already lists something — the patient's own uploads — so an
   * empty list says nothing more ("no lab tests yet" under an uploaded one would
   * read wrong). Loading and failures still show.
   */
  headerHasItems?: boolean;
  /** Buttons beside the chevron, for the records that have any; null for the rest. */
  actionOf?: (item: T) => RecordAction | RecordAction[] | null;
}

/**
 * A hospital-issued list on the Reports page, as the portal draws each one:
 * family chips when the records span more than one person, a search, and a
 * card per record that opens it.
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
  actionOf,
  header,
  headerHasItems = false,
}: RecordListSectionProps<T>) {
  const theme = useTheme();
  const { t } = useTranslation();

  const patientPills: FilterPill[] = useMemo(
    () => [
      { key: EVERYONE, label: t('reports.everyone') },
      ...(viewModel.patients ?? []).map(patient => ({ key: patient.code, label: patient.name })),
    ],
    [viewModel.patients, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: T }) => (
      <RecordCard
        kind={kind}
        title={titleOf(item)}
        meta={metaOf(item)}
        badges={badgesOf(item)}
        onOpen={onOpen ? () => onOpen(item) : undefined}
        action={actionOf?.(item) ?? null}
      />
    ),
    [kind, metaOf, badgesOf, titleOf, onOpen, actionOf],
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
  ) : headerHasItems ? null : hasFilter && viewModel.hasRecords ? (
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
        ListHeaderComponent={header ? <>{header}</> : null}
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
});

export default RecordListSection;
