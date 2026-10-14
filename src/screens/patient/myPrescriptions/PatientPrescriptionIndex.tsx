import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  FamilyMember,
  PatientPrescriptionRepository,
  PortalPrescription,
  PrescriptionAttachment,
  formatLongDate,
  getFileUrl,
  stripHonorific,
  useDownload,
  useStores,
} from '@app/core';
import { CustomAvatar, CustomButton, CustomChip, CustomDialog, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { MyPrescriptionsStackParamList } from '../../../navigation/MyPrescriptionsStackNavigator';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import PrescriptionCard from './PrescriptionCard';
import PrescriptionFilterSheet from './PrescriptionFilterSheet';
import UploadDocumentSheet from './UploadDocumentSheet';
import TodayMedicinesPanel from './TodayMedicinesPanel';
import { ALL_MEMBERS, useMyPrescriptionsViewModel } from './useMyPrescriptionsViewModel';
import { VISIT_LABEL_KEY, prescriptionDay } from './prescriptionUi';

/** My Prescriptions: every prescription on the account, each opened as its PDF. */
export const PatientPrescriptionIndex = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { toastStore } = useStores();
  const navigation = useNavigation<NativeStackNavigationProp<MyPrescriptionsStackParamList>>();
  const viewModel = useMyPrescriptionsViewModel();
  const monthNames = useMonthNames();
  const { download } = useDownload();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  /** Whose PDF is being saved — one at a time, as the button shows. */
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<PrescriptionAttachment | null>(null);
  /** The portal's "Today's Medicines" toggle — the panel opens above the list. */
  const [showToday, setShowToday] = useState(false);

  /** The prescription itself is the PDF the server draws, as on the portal. */
  const openPrescription = useCallback(
    (prescription: PortalPrescription) => {
      if (!prescription?.id) return;
      const day = prescriptionDay(prescription?.prescribedAt);
      navigation.navigate('FileViewer', {
        url: PatientPrescriptionRepository.getPdfUrl(prescription.id),
        filename: PatientPrescriptionRepository.getPdfFileName(prescription?.code),
        title: t('myPrescriptions.preview'),
        subtitle: [
          prescription?.code,
          prescription?.patientName,
          day ? formatLongDate(day, monthNames) : '',
          t(VISIT_LABEL_KEY[prescription?.visitType ?? 'opd'] ?? VISIT_LABEL_KEY.opd),
        ]
          .filter(Boolean)
          .join(' · '),
        canDownload: true,
        fresh: true,
      });
    },
    [navigation, t, monthNames],
  );

  const downloadPrescription = useCallback(
    async (prescription: PortalPrescription) => {
      if (!prescription?.id || downloadingId !== null) return;
      setDownloadingId(prescription.id);
      const { filePath, serverMessage } = await download({
        url: PatientPrescriptionRepository.getPdfUrl(prescription.id),
        filename: PatientPrescriptionRepository.getPdfFileName(prescription?.code),
      });
      setDownloadingId(null);
      toastStore.show(
        filePath ? t('myPrescriptions.downloadSaved') : serverMessage || t('myPrescriptions.downloadFailed'),
        filePath ? 'success' : 'error',
      );
    },
    [download, downloadingId, toastStore, t],
  );

  /** `url` is a stored file's id — the file itself is served by the download endpoint. */
  const viewAttachment = useCallback(
    (attachment: PrescriptionAttachment) => {
      const url = getFileUrl(attachment?.url);
      if (!url) return;
      navigation.navigate('FileViewer', {
        url,
        filename: attachment?.name ?? '',
        title: attachment?.title ?? '',
        canDownload: true,
      });
    },
    [navigation],
  );

  const downloadAttachment = useCallback(
    async (attachment: PrescriptionAttachment) => {
      const url = getFileUrl(attachment?.url);
      if (!url) return;
      const { filePath, serverMessage } = await download({ url, filename: attachment?.name ?? '' });
      toastStore.show(
        filePath ? t('myPrescriptions.downloadSaved') : serverMessage || t('myPrescriptions.downloadFailed'),
        filePath ? 'success' : 'error',
      );
    },
    [download, toastStore, t],
  );

  const confirmDeleteAttachment = useCallback(() => {
    const id = attachmentToDelete?.id ?? '';
    setAttachmentToDelete(null);
    if (id) viewModel.removeAttachment(id);
  }, [attachmentToDelete, viewModel]);

  /** "14 records", plus the member's name once the list is narrowed to one. */
  const subtitle = useMemo(() => {
    if (viewModel.isLoading || !viewModel.totalCount) return undefined;
    const records = t('myPrescriptions.recordCount', { count: viewModel.totalCount });
    return viewModel.selectedMemberName ? `${records} — ${viewModel.selectedMemberName}` : records;
  }, [t, viewModel.isLoading, viewModel.totalCount, viewModel.selectedMemberName]);

  const memberLabel = useCallback(
    (member: FamilyMember) =>
      member?.relationship === 'Myself'
        ? t('myPrescriptions.memberSelf', { name: member?.fullName ?? '' })
        : member?.fullName ?? '',
    [t],
  );

  /** Tapping the chosen member again goes back to everyone, as on the portal. */
  const selectMember = useCallback(
    (patientCode: string) =>
      viewModel.setSelectedPatientCode(current =>
        current === patientCode ? ALL_MEMBERS : patientCode,
      ),
    [viewModel],
  );

  const renderMemberChip = (patientCode: string, label: string, member?: FamilyMember) => {
    const selected = viewModel.selectedPatientCode === patientCode;
    const photo = member ? getFileUrl(member?.photoUrl) : '';
    return (
      <CustomChip
        key={patientCode || 'all'}
        compact
        selected={selected}
        showSelectedCheck={false}
        onPress={() => (member ? selectMember(patientCode) : viewModel.setSelectedPatientCode(ALL_MEMBERS))}
        textColor={selected ? theme.colors.onPrimary : theme.colors.onSurface}
        avatar={
          member ? (
            <CustomAvatar
              type={photo ? 'image' : 'text'}
              value={photo || stripHonorific(member?.fullName)}
              fallback={stripHonorific(member?.fullName)}
              size={24}
              style={{ backgroundColor: selected ? theme.colors.onPrimary : theme.colors.primaryContainer }}
            />
          ) : undefined
        }
        style={[
          styles.chip,
          {
            backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
            borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
          },
        ]}
        textStyle={styles.chipText}
      >
        {label}
      </CustomChip>
    );
  };

  const renderItem = useCallback(
    ({ item }: { item: PortalPrescription }) => (
      <PrescriptionCard
        prescription={item}
        isExpanded={viewModel.expandedId === item?.id}
        attachments={viewModel.attachments}
        isLoadingAttachments={viewModel.isLoadingAttachments}
        isDownloading={downloadingId === item?.id}
        onToggleAttachments={viewModel.toggleAttachments}
        onOpen={openPrescription}
        onDownload={downloadPrescription}
        onAddAttachment={viewModel.openUpload}
        onViewAttachment={viewAttachment}
        onDownloadAttachment={downloadAttachment}
        onDeleteAttachment={setAttachmentToDelete}
      />
    ),
    [
      viewModel.expandedId,
      viewModel.attachments,
      viewModel.isLoadingAttachments,
      viewModel.toggleAttachments,
      viewModel.openUpload,
      downloadingId,
      openPrescription,
      downloadPrescription,
      viewAttachment,
      downloadAttachment,
    ],
  );

  const isFiltered = viewModel.hasActiveFilters || viewModel.selectedPatientCode !== ALL_MEMBERS;
  const muted = theme.colors.onSurfaceVariant;

  const emptyState = viewModel.isLoading ? (
    <View style={styles.state}>
      <ActivityIndicator size="small" color={theme.colors.primary} />
    </View>
  ) : viewModel.error !== null ? (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: theme.colors.errorContainer }]}>
        <Icon name="alert-circle-outline" size={26} color={theme.colors.error} />
      </View>
      <Text style={[styles.stateTitle, { color: theme.colors.onSurface }]}>
        {viewModel.error || t('myPrescriptions.loadFailed')}
      </Text>
      <CustomButton mode="outlined" onPress={viewModel.retry} style={styles.stateButton}>
        {t('myPrescriptions.tryAgain')}
      </CustomButton>
    </View>
  ) : (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: theme.colors.primaryContainer }]}>
        <Icon name="pill" size={26} color={theme.colors.primary} />
      </View>
      <Text style={[styles.stateTitle, { color: theme.colors.onSurface }]}>
        {t(isFiltered ? 'myPrescriptions.noMatch' : 'myPrescriptions.noPrescriptions')}
      </Text>
      {isFiltered ? (
        <CustomButton mode="outlined" onPress={viewModel.clearFilters} style={styles.stateButton}>
          {t('myPrescriptions.clearFilters')}
        </CustomButton>
      ) : (
        <Text style={[styles.stateHint, { color: muted }]}>{t('myPrescriptions.emptyHint')}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={t('myPrescriptions.title')}
        subtitle={subtitle}
        leading="menu"
        right={
          <Pressable
            onPress={viewModel.openFilters}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('myPrescriptions.filterTitle')}
            style={[
              styles.filterButton,
              {
                backgroundColor: viewModel.hasActiveFilters ? theme.colors.primary : theme.colors.surface,
                borderColor: viewModel.hasActiveFilters ? theme.colors.primary : theme.colors.outlineVariant,
              },
            ]}
          >
            <Icon
              name="tune-variant"
              size={18}
              color={viewModel.hasActiveFilters ? theme.colors.onPrimary : theme.colors.onSurface}
            />
          </Pressable>
        }
      />

      {/* The portal shows the member chips only when the account has more than one profile. */}
      {viewModel.members?.length > 1 ? (
        <View style={[styles.memberCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.memberLabel, { color: muted }]}>{t('myPrescriptions.member')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            {renderMemberChip(ALL_MEMBERS, t('myPrescriptions.allMembers'))}
            {viewModel.members.map(member =>
              renderMemberChip(member?.patientCode ?? '', memberLabel(member), member),
            )}
          </ScrollView>
        </View>
      ) : null}

      <Pressable
        onPress={() => setShowToday(value => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showToday }}
        style={[
          styles.todayToggle,
          showToday
            ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
            : { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
        ]}
      >
        <Icon name="pill" size={16} color={showToday ? theme.colors.onPrimary : theme.colors.primary} />
        <Text style={[styles.todayText, { color: showToday ? theme.colors.onPrimary : theme.colors.onSurface }]}>
          {t('todayMedicines.title')}
        </Text>
        <Icon
          name={showToday ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={showToday ? theme.colors.onPrimary : muted}
        />
      </Pressable>

      {isFiltered ? (
        <View style={styles.activeRow}>
          <Icon name="filter-variant" size={14} color={theme.colors.primary} />
          <Text style={[styles.activeText, { color: muted }]}>{t('myPrescriptions.filtersOn')}</Text>
          <Pressable onPress={viewModel.clearFilters} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.clear, { color: theme.colors.primary }]}>{t('myPrescriptions.clear')}</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={viewModel.prescriptions}
        keyExtractor={item => String(item?.id ?? '')}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={viewModel.isRefreshing}
            onRefresh={viewModel.refresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        ListHeaderComponent={
          showToday ? (
            <TodayMedicinesPanel
              patientCode={viewModel.selectedPatientCode || null}
              patientName={viewModel.selectedMemberName || null}
            />
          ) : null
        }
        ListEmptyComponent={emptyState}
      />

      <PrescriptionFilterSheet
        visible={viewModel.isFilterVisible}
        onClose={viewModel.closeFilters}
        filters={viewModel.filters}
        doctors={viewModel.doctors}
        onApply={viewModel.applyFilters}
      />

      <UploadDocumentSheet
        visible={viewModel.uploadTarget !== null}
        prescription={viewModel.uploadTarget}
        onClose={viewModel.closeUpload}
        onUpload={viewModel.uploadDocument}
      />

      <CustomDialog
        visible={!!attachmentToDelete}
        title={t('myPrescriptions.deleteTitle')}
        message={t('myPrescriptions.deleteMessage', {
          name: attachmentToDelete?.title || attachmentToDelete?.name || '',
        })}
        confirmText={t('myPrescriptions.deleteFile')}
        cancelText={t('common.cancel')}
        onConfirm={confirmDeleteAttachment}
        onDismiss={() => setAttachmentToDelete(null)}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  memberLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  chipScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  chipRow: {
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    margin: 0,
    borderWidth: 1,
    borderRadius: 999,
  },
  chipText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    marginVertical: 5,
  },
  todayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  todayText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  activeText: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  clear: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  listContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 24,
  },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  stateTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    textAlign: 'center',
  },
  stateHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  stateButton: {
    marginTop: 18,
    borderRadius: 12,
    minWidth: 150,
  },
});

export default PatientPrescriptionIndex;
