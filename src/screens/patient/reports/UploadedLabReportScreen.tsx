import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { UploadedLabRow, getFileUrl, useStores } from '@app/core';
import { fontFamilies } from '@app/ui';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { ReportsStackParamList } from '../../../navigation/ReportsStackNavigator';
import { DetailCard, DetailFacts, DetailHeading, RecordDetailScreen } from './RecordDetail';
import { RECORD_TONE, formatRecordDate, recordTone } from './reportsUi';

const noop = () => {};

/** A result's ink and the word for it — only an out-of-range one is marked, as on the portal. */
const useFlag = (row: UploadedLabRow) => {
  const theme = useTheme();
  const { t } = useTranslation();
  if (row?.resultStatus === 'high') {
    return {
      label: t('reports.flagHigh'),
      icon: 'arrow-up',
      color: theme.colors.error,
      tint: theme.colors.errorContainer,
    };
  }
  if (row?.resultStatus === 'low') {
    return {
      label: t('reports.flagLow'),
      icon: 'arrow-down',
      color: theme.dark ? '#F5C26B' : '#B27400',
      tint: theme.dark ? '#3A2E14' : '#FEF3E0',
    };
  }
  return null;
};

/** One parameter: its name and range on the left, the result on the right, marked when out of range. */
const ResultRow = ({ row, first }: { row: UploadedLabRow; first: boolean }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const flag = useFlag(row);
  const muted = theme.colors.onSurfaceVariant;

  return (
    <View
      style={[
        styles.result,
        !first && styles.resultDivided,
        { borderTopColor: theme.colors.outlineVariant },
        flag ? { backgroundColor: flag.tint } : null,
      ]}
    >
      <View style={styles.resultText}>
        <Text style={[styles.resultName, { color: theme.colors.onSurface }]}>{row?.attribute || '—'}</Text>
        {row?.normalRange ? (
          <Text style={[styles.resultRange, { color: muted }]}>
            {t('reports.normalRange', { range: row.normalRange })}
          </Text>
        ) : null}
      </View>
      <View style={styles.resultValueBox}>
        <Text style={[styles.resultValue, { color: flag ? flag.color : theme.colors.onSurface }]}>
          {row?.resultValue || '—'}
          {row?.unit ? <Text style={[styles.resultUnit, { color: muted }]}>{` ${row.unit}`}</Text> : null}
        </Text>
        {flag ? (
          <View style={styles.flag}>
            <Icon name={flag.icon} size={12} color={flag.color} />
            <Text style={[styles.flagText, { color: flag.color }]}>{flag.label}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

/** A free-text part of the report, when the sheet had one. */
const TextPart = ({ icon, title, text }: { icon: string; title: string; text?: string | null }) => {
  const theme = useTheme();
  if (!(text ?? '').trim()) return null;
  return (
    <DetailCard>
      <DetailHeading icon={icon}>{title}</DetailHeading>
      <Text selectable style={[styles.body, { color: theme.colors.onSurface }]}>
        {text}
      </Text>
    </DetailCard>
  );
};

/**
 * One test from a lab report the patient uploaded, as the AI read it and they
 * confirmed it — the portal's sheet for it, laid out for a phone: the lab's
 * details, each result against its range, and the written parts. The original
 * file opens in the app. All of it came with the list, so nothing is read again.
 */
export const UploadedLabReportScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const months = useMonthNames();
  const { toastStore } = useStores();
  const navigation = useNavigation<NativeStackNavigationProp<ReportsStackParamList>>();
  const route = useRoute<RouteProp<ReportsStackParamList, 'UploadedLabReport'>>();
  const report = route?.params?.report;
  const kind = report?.reportType === 'radiology' ? 'radiology' : 'pathology';
  const tone = recordTone(kind, theme.dark);
  const rows = report?.rows ?? [];
  const flagged = rows.filter(row => row?.resultStatus === 'high' || row?.resultStatus === 'low').length;
  const date = formatRecordDate(report?.reportedAt || report?.createdAt, months);
  const fallbackTitle = t(kind === 'radiology' ? 'reports.imagingTest' : 'reports.labTest');

  const openOriginal = useCallback(() => {
    const url = getFileUrl(report?.fileUrl);
    if (!url) {
      toastStore.show(t('reports.fileUnavailable'), 'error');
      return;
    }
    navigation.navigate('FileViewer', {
      url,
      filename: report?.fileName ?? '',
      title: report?.testName || t('reports.originalFile'),
      subtitle: [report?.fileName, date].filter(Boolean).join(' · '),
      canDownload: true,
    });
  }, [navigation, report, date, toastStore, t]);

  return (
    <RecordDetailScreen
      title={report?.testName || fallbackTitle}
      subtitle={[report?.patientName, date, t('reports.uploadedByYou')].filter(Boolean).join(' · ')}
      isLoading={false}
      isRefreshing={false}
      error={report ? null : ''}
      errorFallback={t('reports.uploadOpenFailed')}
      onRetry={noop}
      onRefresh={noop}
    >
      {report ? (
        <>
          <DetailCard>
            <View style={styles.heroTop}>
              <View style={[styles.iconTile, { backgroundColor: tone.tint }]}>
                <Icon name={RECORD_TONE[kind].icon} size={22} color={tone.color} />
              </View>
              <View style={styles.heroText}>
                <Text style={[styles.heroTitle, { color: theme.colors.onSurface }]}>
                  {report?.testName || fallbackTitle}
                </Text>
                <View style={styles.pills}>
                  <View style={[styles.pill, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Icon name="cloud-upload-outline" size={12} color={theme.colors.onSurfaceVariant} />
                    <Text style={[styles.pillText, { color: theme.colors.onSurfaceVariant }]}>
                      {t('reports.uploadedByYou')}
                    </Text>
                  </View>
                  {report?.department ? (
                    <View style={[styles.pill, { backgroundColor: tone.tint }]}>
                      <Text style={[styles.pillText, { color: tone.color }]}>{report.department}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
            <DetailFacts
              facts={[
                { label: t('reports.labName'), value: report?.labName },
                { label: t('reports.reportNo'), value: report?.reportId },
                { label: t('reports.referredBy'), value: report?.referredBy },
                { label: t('reports.sample'), value: report?.sampleType },
                { label: t('reports.verifiedBy'), value: report?.verifiedBy },
              ]}
            />
            {report?.fileUrl ? (
              <Button
                mode="outlined"
                icon="file-document-outline"
                onPress={openOriginal}
                style={styles.original}
                labelStyle={styles.originalLabel}
              >
                {t('reports.originalFile')}
              </Button>
            ) : null}
          </DetailCard>

          {rows.length ? (
            <DetailCard>
              <View style={styles.resultsHead}>
                <DetailHeading icon="flask-outline">{t('reports.results')}</DetailHeading>
                {flagged ? (
                  <Text style={[styles.flaggedText, { color: theme.colors.error }]}>
                    {t('reports.outOfRange', { count: flagged })}
                  </Text>
                ) : null}
              </View>
              {rows.map((row, index) => {
                // A group's heading shows once, over its first row — as on the sheet.
                const group = row?.groupName && row.groupName !== rows[index - 1]?.groupName ? row.groupName : '';
                return (
                  <React.Fragment key={`${row?.serial}-${index}`}>
                    {group ? (
                      <Text style={[styles.group, { color: theme.colors.primary }]}>{group}</Text>
                    ) : null}
                    <ResultRow row={row} first={index === 0 || !!group} />
                  </React.Fragment>
                );
              })}
            </DetailCard>
          ) : null}

          <TextPart
            icon="text-box-outline"
            title={t(kind === 'radiology' ? 'reports.findings' : 'reports.reportText')}
            text={report?.manualContent}
          />
          <TextPart icon="lightbulb-outline" title={t('reports.interpretation')} text={report?.interpretation} />
          <TextPart icon="comment-text-outline" title={t('reports.comments')} text={report?.comments} />
        </>
      ) : null}
    </RecordDetailScreen>
  );
};

const styles = StyleSheet.create({
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    marginLeft: 12,
  },
  heroTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  original: {
    borderRadius: 12,
    marginTop: 12,
  },
  originalLabel: {
    fontFamily: fontFamilies.semibold,
  },
  resultsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  flaggedText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  group: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
    marginTop: 10,
    marginBottom: 2,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  resultDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resultText: {
    flex: 1,
  },
  resultName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  resultRange: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    marginTop: 2,
  },
  resultValueBox: {
    alignItems: 'flex-end',
    maxWidth: '45%',
  },
  resultValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    textAlign: 'right',
  },
  resultUnit: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  flagText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    lineHeight: 20,
  },
});

export default UploadedLabReportScreen;
