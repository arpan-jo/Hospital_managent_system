import React, { Fragment, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MedicalRecordRepository, PathologyResultRow } from '@app/core';
import { fontFamilies } from '@app/ui';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { ReportsStackParamList } from '../../../navigation/ReportsStackNavigator';
import {
  DetailCard,
  DetailFacts,
  DetailHeading,
  DetailNote,
  DetailProse,
  DetailTextSection,
  RecordDetailScreen,
  useRecordDetail,
} from './RecordDetail';
import { RECORD_TONE, formatRecordDate, formatRecordDateTime, recordTone } from './reportsUi';

/** Rows grouped by the test they came from, in the order they arrive. */
const groupByTest = (rows: PathologyResultRow[]) => {
  const groups: { name: string; rows: PathologyResultRow[] }[] = [];
  rows?.forEach(row => {
    const name = row?.itemName ?? '';
    const group = groups.find(item => item.name === name);
    if (group) group.rows.push(row);
    else groups.push({ name, rows: [row] });
  });
  return groups;
};

/**
 * A row's sub-heading shows where it changes — measured from the last row
 * that had one, so a row without a group does not repeat the heading after it.
 */
const withSubHeadings = (rows: PathologyResultRow[]) => {
  let current = '';
  return rows.map(row => {
    const name = (row?.groupName ?? '').trim();
    const heading = name && name !== current ? name : '';
    if (name) current = name;
    return { row, heading };
  });
};

const ResultRow = ({ row, isLast }: { row: PathologyResultRow; isLast: boolean }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const flagColor =
    row?.flag === 'high'
      ? theme.colors.error
      : row?.flag === 'low'
        ? theme.dark
          ? '#F5C26B'
          : '#B27400'
        : theme.colors.onSurface;

  return (
    <View
      style={[
        styles.resultRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.outlineVariant },
      ]}
    >
      <View style={styles.resultName}>
        <Text style={[styles.attribute, { color: theme.colors.onSurface }]}>{row?.attribute}</Text>
        {row?.normalRange ? (
          <Text style={[styles.range, { color: theme.colors.onSurfaceVariant }]}>
            {t('reports.normalRange')}: {row.normalRange}
          </Text>
        ) : null}
      </View>
      <View style={styles.resultValue}>
        <View style={styles.valueLine}>
          {row?.flag !== 'normal' ? (
            <Icon name={row?.flag === 'high' ? 'arrow-up' : 'arrow-down'} size={14} color={flagColor} />
          ) : null}
          <Text selectable style={[styles.value, { color: flagColor }]}>
            {row?.value || '—'}
          </Text>
        </View>
        {row?.unit ? (
          <Text style={[styles.unit, { color: theme.colors.onSurfaceVariant }]}>{row.unit}</Text>
        ) : null}
        {row?.flag !== 'normal' ? (
          <Text style={[styles.flagText, { color: flagColor }]}>
            {t(row?.flag === 'high' ? 'reports.flagHigh' : 'reports.flagLow')}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

/** One delivered lab report, as the portal opens it. */
export const PathologyReportScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const months = useMonthNames();
  const route = useRoute<RouteProp<ReportsStackParamList, 'PathologyReport'>>();
  const billRowId = route?.params?.billRowId ?? 0;
  const detail = useRecordDetail(MedicalRecordRepository.getPathologyReport, billRowId);
  const report = detail.data;
  const tone = recordTone('pathology', theme.dark);

  const groups = useMemo(() => groupByTest(report?.rows ?? []), [report?.rows]);
  const hasRows = (report?.rows?.length ?? 0) > 0;
  const signOff = [
    { label: t('reports.preparedBy'), value: report?.preparedByName },
    { label: t('reports.verifiedBy'), value: report?.verifiedByName },
    { label: t('reports.finalizedBy'), value: report?.finalizedByName },
    { label: t('reports.finalized'), value: formatRecordDateTime(report?.finalizedAt, months) },
  ].filter(item => item.value);

  return (
    <RecordDetailScreen
      title={report?.itemName || route?.params?.title || t('reports.labReport')}
      subtitle={[report?.patientName, report?.reportId].filter(Boolean).join(' · ')}
      isLoading={detail.isLoading}
      isRefreshing={detail.isRefreshing}
      error={detail.error}
      errorFallback={t('reports.reportOpenFailed')}
      onRetry={detail.retry}
      onRefresh={detail.refresh}
    >
      {report ? (
        <>
          <DetailCard>
            <View style={styles.summaryTop}>
              <View style={[styles.iconTile, { backgroundColor: tone.tint }]}>
                <Icon name={RECORD_TONE.pathology.icon} size={22} color={tone.color} />
              </View>
              <View style={styles.summaryText}>
                <Text style={[styles.summaryTitle, { color: theme.colors.onSurface }]}>
                  {report?.itemName || t('reports.labReport')}
                </Text>
                {report?.patientName ? (
                  <Text style={[styles.summaryMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {report.patientName}
                  </Text>
                ) : null}
              </View>
            </View>
            <DetailFacts
              facts={[
                { label: t('reports.delivered'), value: formatRecordDateTime(report?.deliveredAt, months) },
                { label: t('reports.billDate'), value: formatRecordDate(report?.billDate, months) },
                { label: t('reports.bill'), value: report?.billCode },
                { label: t('reports.department'), value: report?.department },
                { label: t('reports.sample'), value: report?.sampleType },
                { label: t('reports.patientId'), value: report?.patientCode },
              ]}
            />
          </DetailCard>

          {hasRows ? (
            <DetailCard>
              <DetailHeading icon="test-tube">{t('reports.results')}</DetailHeading>
              <View style={[styles.tableHead, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text style={[styles.tableHeadText, { color: theme.colors.onSurfaceVariant }]}>
                  {t('reports.test')}
                </Text>
                <Text style={[styles.tableHeadText, { color: theme.colors.onSurfaceVariant }]}>
                  {t('reports.result')}
                </Text>
              </View>
              {groups.map((group, groupIndex) => (
                <Fragment key={`${group.name}-${groupIndex}`}>
                  {/* The test's own name heads its rows only when the report merges several. */}
                  {groups.length > 1 && group.name ? (
                    <Text style={[styles.testHeading, { color: theme.colors.primary }]}>{group.name}</Text>
                  ) : null}
                  {withSubHeadings(group.rows).map(({ row, heading }, index) => (
                    <Fragment key={`${row?.attribute}-${index}`}>
                      {heading ? (
                        <Text style={[styles.subHeading, { color: theme.colors.onSurface }]}>{heading}</Text>
                      ) : null}
                      <ResultRow row={row} isLast={index === group.rows.length - 1} />
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </DetailCard>
          ) : null}

          {report?.manualContent ? (
            <DetailCard>
              <DetailProse text={report.manualContent} />
            </DetailCard>
          ) : null}

          <DetailTextSection title={t('reports.interpretation')} text={report?.interpretation} />
          <DetailTextSection title={t('reports.comments')} text={report?.comments} />
          <DetailTextSection title={t('reports.advice')} text={report?.advice} />

          {report?.documentFileName ? (
            <DetailNote icon="paperclip">
              <Text style={styles.noteStrong}>{report.documentFileName}</Text>
              {'\n'}
              {t('reports.scannedFile')}
            </DetailNote>
          ) : null}

          {!hasRows && !report?.manualContent && !report?.documentFileName ? (
            <DetailNote icon="information-outline">{t('reports.noResultDetails')}</DetailNote>
          ) : null}

          {signOff.length ? (
            <DetailCard>
              <View style={styles.signOff}>
                {signOff.map(item => (
                  <View key={item.label} style={styles.signItem}>
                    <Text style={[styles.signLabel, { color: theme.colors.onSurfaceVariant }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.signValue, { color: theme.colors.onSurface }]}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </DetailCard>
          ) : null}
        </>
      ) : null}
    </RecordDetailScreen>
  );
};

const styles = StyleSheet.create({
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
    marginLeft: 12,
  },
  summaryTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  summaryMeta: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    marginTop: 2,
  },
  tableHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 2,
  },
  tableHeadText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  testHeading: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 2,
  },
  subHeading: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    marginTop: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  resultName: {
    flex: 1,
  },
  attribute: {
    fontFamily: fontFamilies.medium,
    fontSize: 13.5,
  },
  range: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    marginTop: 2,
  },
  resultValue: {
    alignItems: 'flex-end',
    maxWidth: '45%',
  },
  valueLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  value: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    textAlign: 'right',
  },
  unit: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    marginTop: 1,
    textAlign: 'right',
  },
  flagText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10.5,
    marginTop: 1,
  },
  noteStrong: {
    fontFamily: fontFamilies.semibold,
  },
  signOff: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  signItem: {
    width: '50%',
    paddingRight: 8,
  },
  signLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
  },
  signValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    marginTop: 2,
  },
});

export default PathologyReportScreen;
