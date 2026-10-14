import React, { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { DOCUMENT_CATEGORIES, PatientDocument } from '@app/core';
import { CustomSearchbar } from '@app/ui';
import DocumentCard from './DocumentCard';
import FilterPills, { FilterPill } from './FilterPills';
import RecordState from './RecordState';
import { CATEGORY_LABEL_KEY } from './reportsUi';
import { ALL_CATEGORIES, UploadsViewModel } from './useUploadsViewModel';

interface UploadsSectionProps {
  viewModel: UploadsViewModel;
  months: string[];
  bottomPadding: number;
  downloadingId: string | null;
  onUpload: () => void;
  onPreview: (document: PatientDocument) => void;
  onDownload: (document: PatientDocument) => void;
  onDelete: (document: PatientDocument) => void;
}

/** "My Uploads" — the files the patient added themselves. */
export const UploadsSection = ({
  viewModel,
  months,
  bottomPadding,
  downloadingId,
  onUpload,
  onPreview,
  onDownload,
  onDelete,
}: UploadsSectionProps) => {
  const theme = useTheme();
  const { t } = useTranslation();

  /** "All" always counts; a category shows a count only when it has one, as on the portal. */
  const pills: FilterPill[] = useMemo(
    () => [
      { key: ALL_CATEGORIES, label: t('reports.all'), count: viewModel.total },
      ...DOCUMENT_CATEGORIES.map(category => {
        const count = viewModel.counts?.[category] ?? 0;
        return {
          key: category,
          label: t(CATEGORY_LABEL_KEY[category] ?? category),
          count: count > 0 ? count : undefined,
        };
      }),
    ],
    [viewModel.total, viewModel.counts, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: PatientDocument }) => (
      <DocumentCard
        document={item}
        months={months}
        isDownloading={downloadingId === item?.id}
        isDeleting={viewModel.deletingId === item?.id}
        onPreview={onPreview}
        onDownload={onDownload}
        onDelete={onDelete}
      />
    ),
    [months, downloadingId, viewModel.deletingId, onPreview, onDownload, onDelete],
  );

  const empty = viewModel.isLoading ? (
    <RecordState loading />
  ) : viewModel.error !== null ? (
    <RecordState
      isError
      title={t('reports.loadFailed')}
      hint={viewModel.error || t('reports.loadFailedHint')}
      actionLabel={t('reports.tryAgain')}
      onAction={viewModel.retry}
    />
  ) : viewModel.hasFilter ? (
    <RecordState
      icon="filter-variant"
      title={t('reports.noMatchTitle')}
      hint={t('reports.noMatchHint')}
    />
  ) : (
    <RecordState
      icon="folder-open-outline"
      title={t('reports.emptyTitle')}
      hint={t('reports.emptyHint')}
      actionLabel={t('reports.uploadFirst')}
      actionIcon="upload-outline"
      actionMode="contained"
      onAction={onUpload}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <CustomSearchbar
          value={viewModel.search}
          onChangeText={viewModel.setSearch}
          placeholder={t('reports.searchDocuments')}
          style={styles.searchbar}
        />
      </View>
      <FilterPills items={pills} selected={viewModel.category} onSelect={viewModel.setCategory} />

      <FlatList
        data={viewModel.isLoading || viewModel.error !== null ? [] : viewModel.documents}
        keyExtractor={item => item?.id}
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
};

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

export default UploadsSection;
