import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { VitalsRecord } from '@app/core';
import { fontFamilies } from '@app/ui';
import { formatRecordDateTime, recordTone } from '../reports/reportsUi';
import { HISTORY_METRICS, METRIC_LABEL_KEY, METRIC_UNIT, metricTone, metricValue } from './vitalsUi';

interface VitalsHistoryRowProps {
  record: VitalsRecord;
  months: string[];
}

/** The day and month in a tile, so the history reads like a timeline. */
const DateTile = ({ value, months }: { value: string; months: string[] }) => {
  const theme = useTheme();
  const tone = recordTone('vitals', theme.dark);
  const date = new Date(String(value ?? '').trim());
  const valid = !Number.isNaN(date.getTime());

  return (
    <View style={[styles.dateTile, { backgroundColor: tone.tint }]}>
      {valid ? (
        <>
          <Text style={[styles.dateDay, { color: tone.color }]}>{date.getDate()}</Text>
          <Text numberOfLines={1} style={[styles.dateMonth, { color: tone.color }]}>
            {months?.[date.getMonth()] ?? ''}
          </Text>
        </>
      ) : (
        <Icon name="heart-pulse" size={20} color={tone.color} />
      )}
    </View>
  );
};

/**
 * One sitting in the history: when, by whom, and a chip per measure taken —
 * the portal's history row, as a card.
 */
export const VitalsHistoryRow = memo<VitalsHistoryRowProps>(function VitalsHistoryRow({ record, months }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = theme.colors.onSurfaceVariant;
  const readings = HISTORY_METRICS.map(metric => ({ metric, value: metricValue(record, metric) })).filter(
    reading => reading.value,
  );

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.top}>
        <DateTile value={record?.recordedAt} months={months} />
        <View style={styles.topText}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.onSurface }]}>
            {record?.doctorName || t('vitals.recorded')}
          </Text>
          <Text numberOfLines={1} style={[styles.meta, { color: muted }]}>
            {formatRecordDateTime(record?.recordedAt, months)}
          </Text>
        </View>
        {record?.isUploaded ? (
          <View style={[styles.pill, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Icon name="cloud-upload-outline" size={12} color={muted} />
            <Text style={[styles.pillText, { color: muted }]}>{t('vitals.uploaded')}</Text>
          </View>
        ) : null}
      </View>

      {readings.length ? (
        <View style={styles.chips}>
          {readings.map(({ metric, value }) => {
            const tone = metricTone(metric, theme.dark);
            const unit = METRIC_UNIT[metric];
            const label = t(METRIC_LABEL_KEY[metric]);
            return (
              <View
                key={metric}
                accessible
                accessibilityLabel={`${label} ${value} ${unit}`.trim()}
                style={[styles.chip, { backgroundColor: tone.tint }]}
              >
                <Icon name={tone.icon} size={13} color={tone.color} />
                <Text style={[styles.chipValue, { color: theme.colors.onSurface }]}>
                  {/* BMI carries no unit, so its name says what the number is. */}
                  {unit ? value : `${label} ${value}`}
                  {unit ? <Text style={[styles.chipUnit, { color: muted }]}>{` ${unit}`}</Text> : null}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.none, { color: muted }]}>{t('vitals.noReadings')}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTile: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    lineHeight: 19,
  },
  dateMonth: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10.5,
  },
  topText: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 14.5,
  },
  meta: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  chipUnit: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  none: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    marginTop: 10,
  },
});

export default VitalsHistoryRow;
