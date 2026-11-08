import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { VitalsRecord } from '@app/core';
import { fontFamilies } from '@app/ui';
import { formatRecordDateTime } from '../reports/reportsUi';
import { METRIC_LABEL_KEY, METRIC_UNIT, VitalsMetric, metricTone, metricValue } from './vitalsUi';

interface VitalsLatestCardProps {
  /** The patient's most recent sitting; nothing shows without one. */
  record?: VitalsRecord | null;
  months: string[];
}

/** One measure: its icon, its name, and the value with its unit — "—" when not taken. */
const Tile = ({ record, metric }: { record: VitalsRecord; metric: VitalsMetric }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const tone = metricTone(metric, theme.dark);
  const value = metricValue(record, metric);
  const unit = METRIC_UNIT[metric];

  return (
    <View style={[styles.tile, { backgroundColor: tone.tint }]}>
      <View style={[styles.tileIcon, { backgroundColor: theme.colors.surface }]}>
        <Icon name={tone.icon} size={14} color={tone.color} />
      </View>
      <Text numberOfLines={1} style={[styles.tileLabel, { color: theme.colors.onSurfaceVariant }]}>
        {t(METRIC_LABEL_KEY[metric])}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tileValue, { color: theme.colors.onSurface }]}>
        {value || '—'}
        {value && unit ? (
          <Text style={[styles.tileUnit, { color: theme.colors.onSurfaceVariant }]}>{` ${unit}`}</Text>
        ) : null}
      </Text>
    </View>
  );
};

/**
 * The portal's "Latest" readings, laid out for a phone: blood pressure up top,
 * then pulse, SpO₂ and temperature, then weight and BMI — all from the most
 * recent sitting.
 */
export const VitalsLatestCard = memo<VitalsLatestCardProps>(function VitalsLatestCard({ record, months }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const bpTone = metricTone('bp', theme.dark);

  if (!record) return null;

  const bp = metricValue(record, 'bp');
  const when = formatRecordDateTime(record?.recordedAt, months);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>{t('vitals.latest')}</Text>
        {record?.isUploaded ? (
          <View style={[styles.pill, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Icon name="cloud-upload-outline" size={12} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.pillText, { color: theme.colors.onSurfaceVariant }]}>{t('vitals.uploaded')}</Text>
          </View>
        ) : null}
      </View>
      {when ? (
        <View style={styles.whenRow}>
          <Icon name="clock-outline" size={13} color={theme.colors.onSurfaceVariant} />
          <Text numberOfLines={1} style={[styles.when, { color: theme.colors.onSurfaceVariant }]}>
            {when}
          </Text>
        </View>
      ) : null}

      <View style={[styles.hero, { backgroundColor: bpTone.tint }]}>
        <View style={[styles.heroIcon, { backgroundColor: theme.colors.surface }]}>
          <Icon name={bpTone.icon} size={24} color={bpTone.color} />
        </View>
        <View style={styles.heroText}>
          <Text style={[styles.heroLabel, { color: theme.colors.onSurfaceVariant }]}>
            {t('vitals.bloodPressure')}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.heroValue, { color: theme.colors.onSurface }]}>
            {bp || '—'}
            {bp ? (
              <Text style={[styles.heroUnit, { color: theme.colors.onSurfaceVariant }]}>{` ${METRIC_UNIT.bp}`}</Text>
            ) : null}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Tile record={record} metric="pulse" />
        <Tile record={record} metric="spo2" />
        <Tile record={record} metric="temp" />
      </View>
      <View style={styles.row}>
        <Tile record={record} metric="weight" />
        <Tile record={record} metric="bmi" />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
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
  whenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    marginBottom: 12,
  },
  when: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    marginLeft: 12,
  },
  heroLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
  },
  heroValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 26,
    marginTop: 2,
  },
  heroUnit: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  tile: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  tileIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    marginTop: 8,
  },
  tileValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    marginTop: 2,
  },
  tileUnit: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
});

export default VitalsLatestCard;
