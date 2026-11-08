import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { TodayQueueEntry, to12Hour } from '@app/core';
import { fontFamilies } from '@app/ui';
import { statusTone } from './appointmentUi';

interface TodayQueueCardProps {
  /** Today's appointments still waiting — nothing shows when there are none. */
  entries: TodayQueueEntry[];
}

/**
 * The portal's "Today's queue": for each appointment today, the patient's token,
 * the token the doctor is seeing now, and how many are still ahead. It is
 * information, not a promise of a time.
 */
export const TodayQueueCard = memo<TodayQueueCardProps>(function TodayQueueCard({ entries }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const live = statusTone('completed', theme.dark);
  const muted = theme.colors.onSurfaceVariant;

  if (!entries?.length) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <Icon name="timer-outline" size={17} color={theme.colors.primary} />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>{t('appointments.queueTitle')}</Text>
        <View style={[styles.livePill, { backgroundColor: live.tint }]}>
          <View style={[styles.liveDot, { backgroundColor: live.color }]} />
          <Text style={[styles.liveText, { color: live.color }]}>{t('appointments.queueLive')}</Text>
        </View>
      </View>

      {entries.map(entry => {
        const isCalled = Boolean(entry?.isCalled);
        const meta = [
          entry?.time ? to12Hour(entry.time) : '',
          entry?.roomNumber ? t('appointments.queueRoom', { room: entry.roomNumber }) : '',
          entry?.patientName ?? '',
        ]
          .filter(Boolean)
          .join(' · ');
        const outlook = isCalled
          ? t('appointments.queueCalled')
          : entry?.nowServingToken === null || entry?.nowServingToken === undefined
            ? t('appointments.queueNotStarted')
            : t('appointments.queueAhead', { count: entry?.aheadCount ?? 0 });

        return (
          <View
            key={String(entry?.appointmentId)}
            style={[
              styles.row,
              isCalled
                ? { backgroundColor: live.tint, borderColor: live.color }
                : { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.outlineVariant },
            ]}
          >
            <Text numberOfLines={1} style={[styles.doctor, { color: theme.colors.onSurface }]}>
              {entry?.doctorName || t('appointments.queueDoctor')}
            </Text>
            {meta ? (
              <Text numberOfLines={1} style={[styles.meta, { color: muted }]}>
                {meta}
              </Text>
            ) : null}

            <View style={styles.numbers}>
              <View>
                <Text style={[styles.label, { color: muted }]}>{t('appointments.queueYourToken')}</Text>
                <Text style={[styles.token, { color: theme.colors.primary }]}>
                  {entry?.tokenNumber ? `#${entry.tokenNumber}` : '—'}
                </Text>
              </View>
              <View>
                <Text style={[styles.label, { color: muted }]}>{t('appointments.queueNowServing')}</Text>
                <Text style={[styles.token, { color: theme.colors.onSurface }]}>
                  {entry?.nowServingToken ? `#${entry.nowServingToken}` : '—'}
                </Text>
              </View>
              <Text
                numberOfLines={2}
                style={[styles.outlook, { color: isCalled ? live.color : theme.colors.onSurface }]}
              >
                {outlook}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10.5,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  doctor: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  meta: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
  },
  numbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 10,
  },
  label: {
    fontFamily: fontFamilies.regular,
    fontSize: 10.5,
  },
  token: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    marginTop: 1,
  },
  outlook: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
});

export default TodayQueueCard;
