import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PatientDocument, READ_CATEGORIES, getFileUrl, useDownload, useStores } from '@app/core';
import { CustomDialog, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { ReportsStackParamList } from '../../../navigation/ReportsStackNavigator';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { PathologySection, RadiologySection, VisitPrescriptionsSection } from './RecordSections';
import UploadReportSheet from './UploadReportSheet';
import UploadsSection from './UploadsSection';
import { formatBytes } from './reportsUi';
import { useUploadsViewModel } from './useUploadsViewModel';

type Section = 'uploads' | 'pathology' | 'radiology' | 'prescriptions';

/**
 * The portal's four sections, in its order: what the hospital issued, then the
 * patient's own files. The first is the one the page opens on.
 */
const SECTIONS: { key: Section; labelKey: string; subtitleKey: string; icon: string }[] = [
  {
    key: 'prescriptions',
    labelKey: 'reports.sectionPrescriptions',
    subtitleKey: 'reports.subtitlePrescriptions',
    icon: 'pill',
  },
  {
    key: 'pathology',
    labelKey: 'reports.sectionPathology',
    subtitleKey: 'reports.subtitlePathology',
    icon: 'flask-outline',
  },
  {
    key: 'radiology',
    labelKey: 'reports.sectionRadiology',
    subtitleKey: 'reports.subtitleRadiology',
    icon: 'radiology-box-outline',
  },
  {
    key: 'uploads',
    labelKey: 'reports.sectionUploads',
    subtitleKey: 'reports.subtitleUploads',
    icon: 'folder-open-outline',
  },
];

/** My Reports & Documents — the portal's Reports page. */
export const PatientReportIndex = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<ReportsStackParamList>>();
  const route = useRoute<RouteProp<ReportsStackParamList, 'ReportsHome'>>();
  const insets = useSafeAreaInsets();
  const { toastStore } = useStores();
  const { download } = useDownload();
  const months = useMonthNames();
  const uploads = useUploadsViewModel();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const [section, setSection] = useState<Section>(SECTIONS[0].key);
  /** A section is read when first opened and kept after, so going back to it is instant. */
  const [opened, setOpened] = useState<Section[]>([SECTIONS[0].key]);
  const [isUploadVisible, setUploadVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PatientDocument | null>(null);
  /** Bumped per section when a reviewed upload was saved to it, so it reads again. */
  const [reloadSignals, setReloadSignals] = useState<Partial<Record<Section, number>>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const openSection = useCallback((key: Section) => {
    setSection(key);
    setOpened(prev => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  const openUpload = useCallback(() => setUploadVisible(true), []);

  // An upload the AI read: its review opens, as the portal's does after the upload.
  const { read, clearRead } = uploads;
  useEffect(() => {
    if (!read?.documentId) return;
    if (read.kind === 'lab') {
      navigation.navigate('ReviewLabReport', {
        documentId: read.documentId,
        registrationId: read.registrationId,
        extraction: read.extraction,
        reportType: read.reportType ?? null,
      });
    } else {
      navigation.navigate('ReviewPrescription', {
        documentId: read.documentId,
        registrationId: read.registrationId,
        extraction: read.extraction,
      });
    }
    clearRead();
  }, [read, clearRead, navigation]);

  // Back from a saved review: that section opens and reads again — the portal's own move.
  const savedAt = route?.params?.saved?.at ?? 0;
  const savedSection = route?.params?.saved?.section;
  useEffect(() => {
    if (!savedAt || !savedSection) return;
    openSection(savedSection);
    setReloadSignals(previous => ({ ...previous, [savedSection]: savedAt }));
  }, [savedAt, savedSection, openSection]);
  const closeUpload = useCallback(() => setUploadVisible(false), []);

  /** Opened in the app — a PDF or an image is drawn, anything else gets a message there. */
  const previewDocument = useCallback(
    (document: PatientDocument) => {
      const url = getFileUrl(document?.url);
      if (!url) {
        toastStore.show(t('reports.fileUnavailable'), 'error');
        return;
      }
      navigation.navigate('FileViewer', {
        url,
        filename: document?.fileName ?? '',
        title: document?.title ?? '',
        subtitle: [document?.fileName, formatBytes(document?.sizeBytes)].filter(Boolean).join(' · '),
        notes: document?.notes ?? '',
        canDownload: true,
      });
    },
    [navigation, toastStore, t],
  );

  const downloadDocument = useCallback(
    async (document: PatientDocument) => {
      const url = getFileUrl(document?.url);
      if (!url) {
        toastStore.show(t('reports.fileUnavailable'), 'error');
        return;
      }
      if (downloadingId) return;
      setDownloadingId(document?.id ?? null);
      const { filePath, serverMessage } = await download({ url, filename: document?.fileName ?? '' });
      setDownloadingId(null);
      toastStore.show(
        filePath ? t('reports.downloadSaved') : serverMessage || t('reports.downloadFailed'),
        filePath ? 'success' : 'error',
      );
    },
    [download, downloadingId, toastStore, t],
  );

  const askDelete = useCallback((document: PatientDocument) => setDeleteTarget(document), []);
  const cancelDelete = useCallback(() => {
    if (!uploads.deletingId) setDeleteTarget(null);
  }, [uploads.deletingId]);

  /** The dialog stays open while it deletes, and after a failure — as on the portal. */
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || uploads.deletingId) return;
    const deleted = await uploads.remove(deleteTarget?.id ?? '');
    if (!deleted) return;
    // The server removes what the AI read off the file with it — the uploaded
    // prescription or lab report — so the sections already open read again.
    if (READ_CATEGORIES.includes(deleteTarget?.category ?? '')) {
      const at = Date.now();
      setReloadSignals(previous => ({ ...previous, prescriptions: at, pathology: at, radiology: at }));
    }
    setDeleteTarget(null);
  }, [deleteTarget, uploads]);

  const active = SECTIONS.find(item => item.key === section) ?? SECTIONS[0];
  const bottomPadding = insets.bottom + TAB_BAR_CLEARANCE;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={t('reports.title')}
        subtitle={
          section === 'uploads'
            ? t('reports.documentsStored', { count: uploads.total })
            : t(active.subtitleKey)
        }
        leading="menu"
        right={
          section === 'uploads' ? (
            <Pressable
              onPress={openUpload}
              accessibilityRole="button"
              style={[styles.uploadButton, { backgroundColor: theme.colors.primary }]}
            >
              <Icon name="plus" size={15} color={theme.colors.onPrimary} />
              <Text style={[styles.uploadText, { color: theme.colors.onPrimary }]}>
                {t('reports.upload')}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sectionScroll}
        contentContainerStyle={styles.sectionRow}
      >
        {SECTIONS.map(item => {
          const selected = item.key === section;
          return (
            <Pressable
              key={item.key}
              onPress={() => openSection(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[
                styles.sectionTab,
                {
                  backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                  borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                },
              ]}
            >
              <Icon
                name={item.icon}
                size={16}
                color={selected ? theme.colors.onPrimary : theme.colors.primary}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.sectionText,
                  { color: selected ? theme.colors.onPrimary : theme.colors.onSurface },
                ]}
              >
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Each section stays mounted once opened; the others are only hidden. */}
      <View style={[styles.body, section !== 'uploads' && styles.hidden]}>
        <UploadsSection
          viewModel={uploads}
          months={months}
          bottomPadding={bottomPadding}
          downloadingId={downloadingId}
          onUpload={openUpload}
          onPreview={previewDocument}
          onDownload={downloadDocument}
          onDelete={askDelete}
        />
      </View>
      {opened.includes('pathology') ? (
        <View style={[styles.body, section !== 'pathology' && styles.hidden]}>
          <PathologySection months={months} bottomPadding={bottomPadding} reloadSignal={reloadSignals.pathology} />
        </View>
      ) : null}
      {opened.includes('radiology') ? (
        <View style={[styles.body, section !== 'radiology' && styles.hidden]}>
          <RadiologySection months={months} bottomPadding={bottomPadding} reloadSignal={reloadSignals.radiology} />
        </View>
      ) : null}
      {opened.includes('prescriptions') ? (
        <View style={[styles.body, section !== 'prescriptions' && styles.hidden]}>
          <VisitPrescriptionsSection
            months={months}
            bottomPadding={bottomPadding}
            reloadSignal={reloadSignals.prescriptions}
          />
        </View>
      ) : null}

      <UploadReportSheet visible={isUploadVisible} onClose={closeUpload} onUpload={uploads.upload} />

      <CustomDialog
        visible={!!deleteTarget}
        title={t('reports.deleteTitle')}
        message={t('reports.deleteMessage', { title: deleteTarget?.title ?? '' })}
        confirmText={t('reports.delete')}
        cancelText={t('common.cancel')}
        loading={!!uploads.deletingId}
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
    gap: 4,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 8,
  },
  uploadText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  sectionScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  sectionRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  sectionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  sectionText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  body: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
});

export default PatientReportIndex;
