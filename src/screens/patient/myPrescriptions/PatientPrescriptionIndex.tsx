import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  FamilyMember,
  getFileUrl,
  PrescriptionAttachment,
  PrescriptionListItem,
  stripHonorific,
  useDownload,
  useStores,
} from '@app/core';
import { CustomAvatar, CustomChip, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { MyPrescriptionsStackParamList } from '../../../navigation/MyPrescriptionsStackNavigator';
import PrescriptionCard from './PrescriptionCard';
import PrescriptionFilterSheet from './PrescriptionFilterSheet';
import UploadDocumentSheet from './UploadDocumentSheet';
import {
  ALL_MEMBERS,
  UploadDocumentInput,
  useMyPrescriptionsViewModel,
} from './useMyPrescriptionsViewModel';

export const PatientPrescriptionIndex = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { toastStore } = useStores();
  const navigation =
    useNavigation<NativeStackNavigationProp<MyPrescriptionsStackParamList>>();
  const viewModel = useMyPrescriptionsViewModel();
  const { download } = useDownload();
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const notAvailableYet = useCallback(
    () => toastStore.show(t('common.comingSoon'), 'info'),
    [toastStore, t],
  );

  // Parked with the header button below until Today's Medicines ships.
  // const handleTodaysMedicines = useCallback(
  //   () => navigation.navigate('TodaysMedicines'),
  //   [navigation],
  // );

  const handleOpen = useCallback(
    (prescription: PrescriptionListItem) =>
      navigation.navigate('PrescriptionPreview', {
        prescriptionId: prescription.id,
      }),
    [navigation],
  );

  /** `url` is a blob name — the file itself is served by the download endpoint. */
  const handleViewAttachment = useCallback(
    (attachment: PrescriptionAttachment) => {
      const url = getFileUrl(attachment?.url);
      if (!url) {
        notAvailableYet();
        return;
      }

      navigation.navigate('FileViewer', {
        url,
        filename: attachment?.name ?? '',
        title: attachment?.title ?? '',
      });
    },
    [navigation, notAvailableYet],
  );

  /**
   * Saves a copy of the document, as the web's download button does — these
   * carry the member's code, so the Reports screen never lists them and this
   * is the only place to keep one. Answers either way, as Reports does.
   */
  const handleDownloadAttachment = useCallback(
    async (attachment: PrescriptionAttachment) => {
      const url = getFileUrl(attachment?.url);
      if (!url) {
        notAvailableYet();
        return;
      }

      const filePath = await download({ url, filename: attachment?.name ?? '' });
      toastStore.show(
        t(filePath ? 'myPrescriptions.downloadSaved' : 'myPrescriptions.downloadFailed'),
        filePath ? 'success' : 'error',
      );
    },
    [download, notAvailableYet, toastStore, t],
  );

  const handleDeleteAttachment = useCallback(
    async (attachment: PrescriptionAttachment) => {
      const deleted = await viewModel.removeAttachment(attachment?.id ?? '');
      toastStore.show(
        t(deleted ? 'myPrescriptions.documentDeleted' : 'myPrescriptions.deleteFailed'),
        deleted ? 'success' : 'error',
      );
    },
    [viewModel, toastStore, t],
  );

  const handleUploadDocument = useCallback(
    async (input: UploadDocumentInput) => {
      const uploaded = await viewModel.uploadDocument(input);
      toastStore.show(
        t(uploaded ? 'myPrescriptions.uploadSuccess' : 'myPrescriptions.uploadFailed'),
        uploaded ? 'success' : 'error',
      );
      return uploaded;
    },
    [viewModel, toastStore, t],
  );

  /** "14 records", plus the member's name once the list is narrowed to one. */
  const subtitle = useMemo(() => {
    const records = t('myPrescriptions.recordCount', {
      count: viewModel.totalCount,
    });
    return viewModel.selectedMemberName
      ? `${records} — ${viewModel.selectedMemberName}`
      : records;
  }, [t, viewModel.totalCount, viewModel.selectedMemberName]);

  const memberLabel = useCallback(
    (member: FamilyMember) =>
      member?.relationship === 'Myself'
        ? t('myPrescriptions.memberSelf', { name: member?.fullName ?? '' })
        : member?.fullName ?? '',
    [t],
  );

  const renderMemberChip = useCallback(
    (patientCode: string, label: string, member?: FamilyMember) => {
      const selected = viewModel.selectedPatientCode === patientCode;
      const photo = member ? getFileUrl(member?.photoUrl) : '';
      return (
        <CustomChip
          key={patientCode || 'all'}
          compact
          selected={selected}
          showSelectedCheck={false}
          onPress={() => viewModel.setSelectedPatientCode(patientCode)}
          textColor={selected ? theme.colors.onPrimary : theme.colors.onSurface}
          avatar={
            member ? (
              <CustomAvatar
                type={photo ? 'image' : 'text'}
                value={photo || stripHonorific(member?.fullName)}
                fallback={stripHonorific(member?.fullName)}
                size={24}
                // Reads off the chip, not the theme's default primary fill.
                style={{
                  backgroundColor: selected
                    ? theme.colors.onPrimary
                    : theme.colors.primaryContainer,
                }}
              />
            ) : undefined
          }
          style={[
            styles.chip,
            {
              backgroundColor: selected
                ? theme.colors.primary
                : theme.colors.background,
              borderColor: selected
                ? theme.colors.primary
                : theme.colors.outlineVariant,
            },
          ]}
          textStyle={styles.chipText}
        >
          {label}
        </CustomChip>
      );
    },
    [viewModel, theme.colors],
  );

  const keyExtractor = useCallback((item: PrescriptionListItem) => item?.id ?? '', []);

  const renderItem = useCallback(
    ({ item }: { item: PrescriptionListItem }) => (
      <PrescriptionCard
        prescription={item}
        isExpanded={viewModel.expandedId === item.id}
        attachments={viewModel.attachments}
        isLoadingAttachments={viewModel.isLoadingAttachments}
        onToggleAttachments={viewModel.toggleAttachments}
        onOpen={handleOpen}
        onAddAttachment={viewModel.openUpload}
        onViewAttachment={handleViewAttachment}
        onDownloadAttachment={handleDownloadAttachment}
        onDeleteAttachment={handleDeleteAttachment}
      />
    ),
    [
      viewModel.expandedId,
      viewModel.attachments,
      viewModel.isLoadingAttachments,
      viewModel.toggleAttachments,
      viewModel.openUpload,
      handleOpen,
      handleViewAttachment,
      handleDownloadAttachment,
      handleDeleteAttachment,
    ],
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
        // right={
        //   <Pressable
        //     onPress={handleTodaysMedicines}
        //     style={[styles.todayButton, { backgroundColor: theme.colors.primary }]}
        //     accessibilityRole="button"
        //   >
        //     <Icon name="pill" size={13} color={theme.colors.onPrimary} />
        //     <Text style={[styles.todayText, { color: theme.colors.onPrimary }]}>
        //       {t('myPrescriptions.todaysMedicines')}
        //     </Text>
        //   </Pressable>
        // }
      />

      <View style={[styles.memberCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.memberLabel, { color: theme.colors.onSurfaceVariant }]}>
          {t('myPrescriptions.member')}
        </Text>

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

        <Pressable
          onPress={viewModel.openFilters}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('myPrescriptions.filterTitle')}
          style={[
            styles.filterButton,
            {
              backgroundColor: viewModel.hasActiveFilters
                ? theme.colors.primaryContainer
                : theme.colors.background,
              borderColor: viewModel.hasActiveFilters
                ? theme.colors.primary
                : theme.colors.outlineVariant,
            },
          ]}
        >
          <Icon
            name="tune-variant"
            size={18}
            color={
              viewModel.hasActiveFilters ? theme.colors.primary : theme.colors.onSurface
            }
          />
        </Pressable>
      </View>

      <FlatList
        data={viewModel.prescriptions}
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
        // +100 clears the floating tab bar — this list is the Prescription tab now.
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        ListEmptyComponent={
          !viewModel.isLoading ? (
            <View style={styles.empty}>
              <View
                style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryContainer }]}
              >
                <Icon name="file-document-outline" size={24} color={theme.colors.primary} />
              </View>
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                {t('myPrescriptions.noPrescriptions')}
              </Text>
            </View>
          ) : null
        }
      />

      <PrescriptionFilterSheet
        visible={viewModel.isFilterVisible}
        onClose={viewModel.closeFilters}
        filters={viewModel.filters}
        doctors={viewModel.doctors}
        onApply={viewModel.applyFilters}
        onReset={viewModel.resetFilters}
      />

      <UploadDocumentSheet
        visible={viewModel.uploadTarget !== null}
        prescription={viewModel.uploadTarget}
        onClose={viewModel.closeUpload}
        onUpload={handleUploadDocument}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  todayText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  memberLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  chipScroll: {
    // Without this the row stretches to fill the card's cross axis.
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
  filterButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
  },
});

export default PatientPrescriptionIndex;
