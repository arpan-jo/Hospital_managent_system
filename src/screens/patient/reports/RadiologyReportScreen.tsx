import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import { MedicalRecordRepository, reportHtmlHasText } from '@app/core';
import { fontFamilies } from '@app/ui';
import Barcode from '../../../components/Barcode';
import ReportHtmlView from '../../../components/ReportHtmlView';
import { ReportsStackParamList } from '../../../navigation/ReportsStackNavigator';
import { DetailCard, RecordDetailScreen, useRecordDetail } from './RecordDetail';
import { formatAge, formatSheetDateTime } from './reportsUi';

/** Screen padding, card padding and the barcode's own margin, either side. */
const BARCODE_INSET = 2 * (16 + 14 + 8);

/**
 * One delivered imaging report, drawn as the portal draws it — a copy of the
 * radiology desk's report sheet: barcode, patient band, the report itself and
 * who finalised it.
 */
export const RadiologyReportScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const route = useRoute<RouteProp<ReportsStackParamList, 'RadiologyReport'>>();
  const billRowId = route?.params?.billRowId ?? 0;
  const detail = useRecordDetail(MedicalRecordRepository.getRadiologyReport, billRowId);
  const report = detail.data;

  const identity = [
    { label: t('reports.patientId'), value: report?.patientCode },
    { label: t('reports.name'), value: report?.patientName },
    { label: t('reports.invoiceId'), value: report?.billCode },
    { label: t('reports.age'), value: formatAge(report?.patientDob) },
    { label: t('reports.gender'), value: report?.patientGender },
    { label: t('reports.contactNo'), value: report?.patientMobile },
    { label: t('reports.appointmentDate'), value: formatSheetDateTime(report?.appointmentDate) },
    { label: t('reports.reportDate'), value: formatSheetDateTime(report?.finalizedAt) },
  ];
  const muted = theme.colors.onSurfaceVariant;

  return (
    <RecordDetailScreen
      title={report?.itemName || route?.params?.title || t('reports.imagingReport')}
      subtitle={[report?.patientName, report?.reportId].filter(Boolean).join(' · ')}
      isLoading={detail.isLoading}
      isRefreshing={detail.isRefreshing}
      error={detail.error}
      errorFallback={t('reports.reportOpenFailed')}
      onRetry={detail.retry}
      onRefresh={detail.refresh}
    >
      {report ? (
        <DetailCard>
          <View style={styles.sheetTop}>
            <View style={[styles.sheetPill, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={[styles.sheetPillText, { color: theme.colors.onSurface }]}>
                {t('reports.radiologyReport')}
              </Text>
            </View>
            <Barcode value={report?.accessionNo} maxWidth={width - BARCODE_INSET} />
          </View>

          <View style={[styles.band, { borderColor: theme.colors.primary }]}>
            {identity.map(item => (
              <View key={item.label} style={styles.bandItem}>
                <Text style={[styles.bandLabel, { color: muted }]}>{item.label}</Text>
                <Text selectable style={[styles.bandValue, { color: theme.colors.onSurface }]}>
                  {item.value || '-'}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[styles.testName, { color: theme.colors.onSurface }]}>
            {t('reports.testName')}: {report?.itemName}
          </Text>

          <View style={[styles.reportBody, { borderColor: theme.colors.outlineVariant }]}>
            {reportHtmlHasText(report?.reportContent) ? (
              <ReportHtmlView html={report?.reportContent} />
            ) : (
              <Text style={[styles.emptyBody, { color: muted }]}>{t('reports.noReportText')}</Text>
            )}
          </View>

          <View style={[styles.signature, { borderTopColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.signatureName, { color: theme.colors.onSurface }]}>
              {report?.finalizedByName || '-'}
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: muted }]}>
              {t('reports.printingDate')}: {formatSheetDateTime(new Date(), 4)}
            </Text>
            <Text style={[styles.footerText, { color: muted }]}>{t('reports.pageOneOfOne')}</Text>
            <Text style={[styles.footerText, { color: muted }]}>{t('reports.poweredBy')}</Text>
          </View>
        </DetailCard>
      ) : null}
    </RecordDetailScreen>
  );
};

const styles = StyleSheet.create({
  sheetTop: {
    alignItems: 'center',
    gap: 10,
  },
  sheetPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  sheetPillText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  band: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    paddingTop: 10,
    marginTop: 14,
  },
  bandItem: {
    width: '50%',
    paddingRight: 8,
    paddingBottom: 10,
  },
  bandLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  bandValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
    marginTop: 1,
  },
  testName: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    marginTop: 14,
  },
  reportBody: {
    minHeight: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  emptyBody: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 56,
  },
  signature: {
    alignSelf: 'flex-end',
    minWidth: 140,
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 6,
    marginTop: 28,
  },
  signatureName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 18,
  },
  footerText: {
    fontFamily: fontFamilies.regular,
    fontSize: 9.5,
  },
});

export default RadiologyReportScreen;
