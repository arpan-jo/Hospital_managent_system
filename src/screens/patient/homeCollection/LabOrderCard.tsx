import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LAB_ORDER_STEPS, LabOrder, formatTaka } from '@app/core';
import { fontFamilies } from '@app/ui';
import { formatRecordDate, formatRecordDateTime } from '../reports/reportsUi';
import { STATUS_LABEL_KEY, orderTitle, slotLabel } from './labOrderUi';

/** Done steps in green, the current one in the brand colour — as on the portal. */
const DONE = { light: '#1B8A4B', dark: '#6FD3A0' };
/** The home-collection teal, in light and dark. */
export const HOME_TONE = { light: ['#0F7B6C', '#E3F5F2'], dark: ['#5FD3C2', '#16302C'] } as const;

/**
 * Requested → Confirmed → Collected → Completed, the current step marked; a
 * cancelled order shows that alone. Compact shows only the current step's name.
 */
export const StatusStepper = memo<{ status: string; compact?: boolean }>(function StatusStepper({ status, compact }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = theme.colors.onSurfaceVariant;

  if (status === 'cancelled') {
    return (
      <View style={[styles.cancelled, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Icon name="cancel" size={12} color={muted} />
        <Text style={[styles.cancelledText, { color: muted }]}>{t('homeCollection.status.cancelled')}</Text>
      </View>
    );
  }

  const index = LAB_ORDER_STEPS.indexOf(status as (typeof LAB_ORDER_STEPS)[number]);
  const done = theme.dark ? DONE.dark : DONE.light;
  const last = LAB_ORDER_STEPS.length - 1;

  // In full, each step is a column — its dot on the line, its name under it — so
  // all four fit a phone's width.
  if (!compact) {
    return (
      <View style={styles.full}>
        {LAB_ORDER_STEPS.map((step, i) => {
          const isDone = i < index;
          const isNow = i === index;
          const dotColor = isDone ? done : isNow ? theme.colors.primary : theme.colors.surfaceVariant;
          const leftColor = i === 0 ? 'transparent' : i <= index ? done : theme.colors.outlineVariant;
          const rightColor = i === last ? 'transparent' : i < index ? done : theme.colors.outlineVariant;
          return (
            <View key={step} style={styles.fullStep}>
              <View style={styles.fullTrack}>
                <View style={[styles.half, { backgroundColor: leftColor }]} />
                <View style={[styles.dot, { backgroundColor: dotColor }, isNow && { borderColor: theme.colors.primaryContainer }]}>
                  {isDone ? (
                    <Icon name="check" size={11} color={theme.colors.onPrimary} />
                  ) : (
                    <Text style={[styles.dotText, { color: isNow ? theme.colors.onPrimary : muted }]}>{i + 1}</Text>
                  )}
                </View>
                <View style={[styles.half, { backgroundColor: rightColor }]} />
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.fullText,
                  {
                    color: isNow ? theme.colors.primary : isDone ? theme.colors.onSurface : muted,
                    fontFamily: isNow ? fontFamilies.semibold : fontFamilies.regular,
                  },
                ]}
              >
                {t(STATUS_LABEL_KEY[step])}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.stepper}>
      {LAB_ORDER_STEPS.map((step, i) => {
        const isDone = i < index;
        const isNow = i === index;
        const dotColor = isDone ? done : isNow ? theme.colors.primary : theme.colors.surfaceVariant;
        return (
          <React.Fragment key={step}>
            <View style={styles.step}>
              <View style={[styles.dot, { backgroundColor: dotColor }, isNow && { borderColor: theme.colors.primaryContainer }]}>
                {isDone ? (
                  <Icon name="check" size={11} color={theme.colors.onPrimary} />
                ) : (
                  <Text style={[styles.dotText, { color: isNow ? theme.colors.onPrimary : muted }]}>{i + 1}</Text>
                )}
              </View>
              {!compact || isNow ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.stepText,
                    { color: isNow ? theme.colors.primary : muted, fontFamily: isNow ? fontFamilies.semibold : fontFamilies.regular },
                  ]}
                >
                  {t(STATUS_LABEL_KEY[step])}
                </Text>
              ) : null}
            </View>
            {i < LAB_ORDER_STEPS.length - 1 ? (
              <View style={[styles.bar, { backgroundColor: isDone ? done : theme.colors.outlineVariant }]} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
});

interface LabOrderCardProps {
  order: LabOrder;
  months: string[];
  onOpen: (order: LabOrder) => void;
}

/** One order on the list: its tests, when, for whom, what it comes to, who collects, and where it stands. */
export const LabOrderCard = memo<LabOrderCardProps>(function LabOrderCard({ order, months, onOpen }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = theme.colors.onSurfaceVariant;
  const cancelled = order?.status === 'cancelled';
  const [toneInk, toneTint] = theme.dark ? HOME_TONE.dark : HOME_TONE.light;
  const slot = slotLabel(order?.preferredTime, t);
  const when = order?.preferredDate
    ? [formatRecordDate(order.preferredDate, months), slot].filter(Boolean).join(' · ')
    : formatRecordDateTime(order?.createdAt, months);
  const meta = [when, order?.patientName, formatTaka(order?.totalAmount)].filter(Boolean).join(' · ');
  const done = theme.dark ? DONE.dark : DONE.light;

  return (
    <Pressable
      onPress={() => onOpen(order)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.colors.surface, opacity: pressed ? 0.92 : cancelled ? 0.85 : 1 },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.icon, { backgroundColor: cancelled ? theme.colors.surfaceVariant : toneTint }]}>
          <Icon name="home-heart" size={22} color={cancelled ? muted : toneInk} />
        </View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.onSurface }]}>
            {orderTitle(order) || t('homeCollection.orderNumber', { id: order?.orderId ?? '' })}
          </Text>
          {meta ? (
            <Text numberOfLines={2} style={[styles.meta, { color: muted }]}>
              {meta}
            </Text>
          ) : null}
          {order?.collectorName && !cancelled ? (
            <View style={styles.collector}>
              <Icon name="account-check-outline" size={13} color={done} />
              <Text numberOfLines={1} style={[styles.collectorText, { color: done }]}>
                {[order.collectorName, formatRecordDateTime(order?.scheduledAt, months)].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ) : null}
        </View>
        <Icon name="chevron-right" size={20} color={muted} />
      </View>
      <View style={[styles.cardFoot, { borderTopColor: theme.colors.outlineVariant }]}>
        <StatusStepper status={order?.status ?? ''} compact />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  full: {
    flexDirection: 'row',
  },
  fullStep: {
    flex: 1,
    alignItems: 'center',
  },
  fullTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  half: {
    flex: 1,
    height: 2,
  },
  fullText: {
    fontSize: 11.5,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dotText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
  },
  stepText: {
    fontSize: 11.5,
  },
  bar: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginHorizontal: 5,
    minWidth: 8,
  },
  cancelled: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cancelledText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
  },
  card: {
    borderRadius: 18,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
  },
  meta: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    marginTop: 2,
  },
  collector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  collectorText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  cardFoot: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 10,
  },
});

export default LabOrderCard;
