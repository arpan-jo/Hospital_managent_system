import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  PrescriptionPageRepository,
  getDestinationPath,
  openFile,
  useStores,
} from '@app/core';
import { fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { MyPrescriptionsStackParamList } from '../../../navigation/MyPrescriptionsStackNavigator';
// The printed sheet is built by the same page builder the doctor's preview
// uses on the web, and rendered to PDF by the same endpoint — so the copy a
// patient saves is the copy the doctor handed over, not a second page drawn
// here that would drift from it.
import { buildPrescriptionPageHtml } from './prescriptionPage/prescriptionHtml';
import PrescriptionPaper from './PrescriptionPaper';
import { usePrescriptionPreviewViewModel } from './usePrescriptionPreviewViewModel';

export const PrescriptionPreviewScreen = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<MyPrescriptionsStackParamList, 'PrescriptionPreview'>>();
  // Params are read defensively: a deep link can land here without them.
  const { prescriptionId = '' }: Partial<MyPrescriptionsStackParamList['PrescriptionPreview']> =
    route.params ?? {};
  const viewModel = usePrescriptionPreviewViewModel(prescriptionId);
  const { toastStore } = useStores();
  const [isBuildingPdf, setBuildingPdf] = useState(false);
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const printable = viewModel?.printable;

  /**
   * Renders the record to PDF and hands it to the phone, which is what offers
   * both saving it and printing it — the app does not need a viewer of its own,
   * the page is already on screen above.
   */
  const handleSharePdf = useCallback(async () => {
    if (!printable || isBuildingPdf) return;

    setBuildingPdf(true);
    try {
      const html = buildPrescriptionPageHtml({
        layout: printable?.layout,
        patient: printable?.patient,
        sectionData: printable?.sectionData,
        // The desk's two columns are the page's two columns.
        assessmentSections: (printable?.printSections ?? []).filter(
          section => section?.column === 'left',
        ),
        prescriptionSections: (printable?.printSections ?? []).filter(
          section => section?.column === 'right',
        ),
        prescriptionCode: printable?.prescriptionCode,
        translate: t,
      });

      const dataUri = await PrescriptionPageRepository.generatePrescriptionPdf({
        html,
        widthIn: printable?.layout?.page?.width ?? 8.27,
        heightIn: printable?.layout?.page?.height ?? 11.69,
        // The route's id *is* the prescription id, despite the payload calling
        // it a consultation. Sent so the server names its copy the same way.
        prescriptionId: Number(prescriptionId) || null,
      });

      const filename = `${printable?.prescriptionCode || 'prescription'}.pdf`;
      const path = getDestinationPath(filename, 'cache');

      await ReactNativeBlobUtil.fs.writeFile(
        path,
        dataUri.split(',')[1] ?? '',
        'base64',
      );
      await openFile(path, filename);
    } catch (error: any) {
      console.log('sharePrescriptionPdf error ==>', error?.message);
      toastStore?.show(t('prescriptionPreview.pdfFailed'), 'error');
    } finally {
      setBuildingPdf(false);
    }
  }, [printable, prescriptionId, isBuildingPdf, toastStore, t]);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={t('prescriptionPreview.title')}
        subtitle={viewModel.document?.rxId}
        leading="back"
        // Shown only when there is a designed page to print the record on.
        right={
          printable ? (
            <Pressable
              onPress={handleSharePdf}
              disabled={isBuildingPdf}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('prescriptionPreview.sharePdf')}
            >
              {isBuildingPdf ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Icon
                  name="tray-arrow-down"
                  size={21}
                  color={theme.colors.primary}
                />
              )}
            </Pressable>
          ) : undefined
        }
      />

      {!viewModel.document ? (
        <View style={styles.placeholder}>
          {viewModel.isLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
              {t('prescriptionPreview.notFound')}
            </Text>
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          // +100 clears the floating tab bar, which overlays this screen inside
          // the Prescription tab's stack.
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
        >
          <PrescriptionPaper document={viewModel.document} />
        </ScrollView>
      )}

    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  empty: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
  },
});

export default PrescriptionPreviewScreen;
