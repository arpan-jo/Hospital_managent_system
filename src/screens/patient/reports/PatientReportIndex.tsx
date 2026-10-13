import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  PatientDocument,
  ReportCategory,
  REPORT_CATEGORIES,
  useDocumentViewer,
  useDownload,
  useStores,
} from '@app/core';
import { CustomChip, CustomDialog, CustomSearchbar, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import ReportCard from './ReportCard';
import UploadReportSheet from './UploadReportSheet';
import { ALL_CATEGORIES, UploadReportInput, useReportsViewModel } from './useReportsViewModel';

const CATEGORY_LABEL_KEY: Record<ReportCategory, string> = {
  Prescription: 'reports.categoryPrescription',
  Laboratory: 'reports.categoryLaboratory',
  'Radiology and Imaging': 'reports.categoryRadiology',
  Other: 'reports.categoryOther',
};

export const PatientReportIndex = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { toastStore } = useStores();
  const viewModel = useReportsViewModel();
  const { view } = useDocumentViewer();
  const { download } = useDownload();
  const [isUploadVisible, setUploadVisible] = useState(false);
  /** The document the delete confirmation is asking about, if any. */
  const [deleteTarget, setDeleteTarget] = useState<PatientDocument | null>(null);
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const openUpload = useCallback(() => setUploadVisible(true), []);
  const closeUpload = useCallback(() => setUploadVisible(false), []);

  const handleUpload = useCallback(
    async (input: UploadReportInput) => {
      const uploaded = await viewModel.uploadReport(input);
      toastStore.show(
        t(uploaded ? 'reports.uploadSuccess' : 'reports.uploadFailed'),
        uploaded ? 'success' : 'error',
      );
      return uploaded;
    },
    [viewModel, toastStore, t],
  );

  const fileMissing = useCallback(
    () => toastStore.show(t('reports.fileUnavailable'), 'error'),
    [toastStore, t],
  );

  const handleView = useCallback(
    (report: PatientDocument) => {
      if (!report?.url) {
        fileMissing();
        return;
      }
      view({ uri: report.url, filename: report?.fileName ?? '' });
    },
    [view, fileMissing],
  );

  const handleDownload = useCallback(
    async (report: PatientDocument) => {
      if (!report?.url) {
        fileMissing();
        return;
      }

      const filePath = await download({ url: report.url, filename: report?.fileName ?? '' });
      toastStore.show(
        t(filePath ? 'reports.downloadSaved' : 'reports.downloadFailed'),
        filePath ? 'success' : 'error',
      );
    },
    [download, fileMissing, toastStore, t],
  );

  const askDelete = useCallback((report: PatientDocument) => setDeleteTarget(report), []);
  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  const confirmDelete = useCallback(async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;

    const deleted = await viewModel.removeReport(target?.id ?? '');
    toastStore.show(
      t(deleted ? 'reports.deleteSuccess' : 'reports.deleteFailed'),
      deleted ? 'success' : 'error',
    );
  }, [deleteTarget, viewModel, toastStore, t]);

  /**
   * 'Other' is not something anyone uploads into — it only collects rows whose
   * category an older client spelled differently — so its chip appears only
   * when such a row exists. The rest match the web's filter row.
   */
  const chipCategories = useMemo(
    () =>
      [ALL_CATEGORIES, ...REPORT_CATEGORIES].filter(
        category => category !== 'Other' || (viewModel.counts?.Other ?? 0) > 0,
      ) as (ReportCategory | '')[],
    [viewModel.counts],
  );

  const keyExtractor = useCallback((item: PatientDocument) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: PatientDocument }) => (
      <ReportCard
        report={item}
        isDeleting={viewModel.deletingId === item?.id}
        onView={handleView}
        onDownload={handleDownload}
        onDelete={askDelete}
      />
    ),
    [viewModel.deletingId, handleView, handleDownload, askDelete],
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={t('reports.title')}
        subtitle={t('reports.recordCount', { count: viewModel.totalCount })}
        leading="menu"
        right={
          <Pressable
            onPress={openUpload}
            style={[styles.uploadButton, { backgroundColor: theme.colors.primary }]}
            accessibilityRole="button"
          >
            <Icon name="upload-outline" size={14} color={theme.colors.onPrimary} />
            <Text style={[styles.uploadText, { color: theme.colors.onPrimary }]}>
              {t('reports.upload')}
            </Text>
          </Pressable>
        }
      />

      <View style={styles.searchRow}>
        <CustomSearchbar
          value={viewModel.searchQuery}
          onChangeText={viewModel.setSearchQuery}
          placeholder={t('reports.searchPlaceholder')}
          style={styles.searchbar}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {chipCategories.map(category => {
          const selected = viewModel.selectedCategory === category;
          const count = category ? viewModel.counts[category] ?? 0 : viewModel.totalCount;
          return (
            <CustomChip
              key={category || 'all'}
              compact
              selected={selected}
              showSelectedCheck={false}
              onPress={() => viewModel.setSelectedCategory(category)}
              textColor={selected ? theme.colors.onPrimary : theme.colors.onSurface}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                  borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                },
              ]}
              textStyle={styles.chipText}
            >
              {`${category ? t(CATEGORY_LABEL_KEY[category]) : t('reports.all')} ${count}`}
            </CustomChip>
          );
        })}
      </ScrollView>

      <FlatList
        data={viewModel.reports}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={viewModel.isLoading}
            onRefresh={viewModel.refresh}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
          viewModel.reports.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          !viewModel.isLoading ? (
            <View style={styles.empty}>
              <View
                style={[styles.emptyIconWrap, { backgroundColor: theme.colors.primaryContainer }]}
              >
                <Icon
                  name={viewModel.error ? 'alert-circle-outline' : 'file-document-outline'}
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                {t(viewModel.error ? 'reports.loadFailedTitle' : 'reports.emptyTitle')}
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.colors.onSurfaceVariant }]}>
                {t(viewModel.error ? 'reports.loadFailedDesc' : 'reports.emptyDesc')}
              </Text>
            </View>
          ) : null
        }
      />

      <UploadReportSheet
        visible={isUploadVisible}
        onClose={closeUpload}
        onUpload={handleUpload}
      />

      <CustomDialog
        visible={!!deleteTarget}
        title={t('reports.deleteTitle')}
        message={t('reports.deleteMessage', { title: deleteTarget?.title ?? '' })}
        confirmText={t('reports.deleteConfirm')}
        cancelText={t('common.cancel')}
        onConfirm={confirmDelete}
        onDismiss={cancelDelete}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  uploadText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  searchRow: {
    paddingHorizontal: 16,
  },
  searchbar: {
    marginVertical: 0,
  },
  chipScroll: {
    // Without this the row stretches to fill the parent ScrollView's cross axis.
    flexGrow: 0,
    marginTop: 10,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    margin: 0,
    borderWidth: 1,
    borderRadius: 999,
  },
  chipText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    marginVertical: 6,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  emptyDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});

export default PatientReportIndex;
