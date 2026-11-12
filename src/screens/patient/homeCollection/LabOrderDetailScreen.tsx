import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LabOrder, LabOrderRepository, canCancelLabOrder, formatTaka, serverMessageOf, useStores } from '@app/core';
import { CustomButton, CustomDialog, fontFamilies } from '@app/ui';
import { useMonthNames } from '../../../hooks/useMonthNames';
import type { DrawerParamList } from '../../../navigation/DrawerNavigator';
import { HomeCollectionStackParamList } from '../../../navigation/HomeCollectionStackNavigator';
import { DetailCard, DetailFacts, DetailHeading, RecordDetailScreen } from '../reports/RecordDetail';
import { formatRecordDate, formatRecordDateTime } from '../reports/reportsUi';
import { HOME_TONE, StatusStepper } from './LabOrderCard';
import { eventLabel, slotLabel, visibleEvents } from './labOrderUi';

const noop = () => {};

/** The word for an order line's kind — a test's, or a container or instrument billed with it. */
const KIND_KEY: Record<string, string> = {
  pathology: 'homeCollection.kind.pathology',
  radiology: 'homeCollection.kind.radiology',
  instrument: 'homeCollection.kind.instrument',
};

/**
 * One home-collection order, as the portal's order sheet holds it — where it
 * stands, the hospital's note, the collector, where and when, every line with
 * the charge and the total, the bill, and the timeline — and, while the
 * hospital has not collected yet, the way to cancel it. All of it came with the
 * list; a cancel answers with the order as it now stands.
 */
export const LabOrderDetailScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const months = useMonthNames();
  const { toastStore } = useStores();
  const navigation = useNavigation<NativeStackNavigationProp<HomeCollectionStackParamList>>();
  const route = useRoute<RouteProp<HomeCollectionStackParamList, 'LabOrderDetail'>>();
  const [order, setOrder] = useState<LabOrder | null>(route?.params?.order ?? null);
  const [asking, setAsking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const muted = theme.colors.onSurfaceVariant;
  const [toneInk, toneTint] = theme.dark ? HOME_TONE.dark : HOME_TONE.light;
  const done = theme.dark ? '#6FD3A0' : '#1B8A4B';
  const doneTint = theme.dark ? '#173126' : '#E6F6EC';
  const warnInk = theme.dark ? '#F5C26B' : '#8A5A00';
  const warnTint = theme.dark ? '#3A2E14' : '#FEF3E0';

  const confirmCancel = useCallback(async () => {
    const orderId = order?.orderId ?? 0;
    if (!orderId || isCancelling) return;
    setIsCancelling(true);
    try {
      const updated = await LabOrderRepository.cancel(orderId);
      setOrder(previous => updated ?? (previous ? { ...previous, status: 'cancelled' } : previous));
      setAsking(false);
      // The backend answers with the order and no words of its own.
      toastStore.show(t('homeCollection.cancelled'), 'success');
    } catch (e: any) {
      console.log('cancelLabOrder error ==>', e?.message);
      toastStore.show(serverMessageOf(e) || t('common.somethingWentWrong'), 'error');
    } finally {
      setIsCancelling(false);
    }
  }, [order?.orderId, isCancelling, toastStore, t]);

  const openBills = useCallback(
    () => navigation?.getParent?.<DrawerNavigationProp<DrawerParamList>>()?.navigate?.('Bills'),
    [navigation],
  );

  const tests = (order?.items ?? []).filter(item => item?.kind !== 'instrument');
  const instruments = (order?.items ?? []).filter(item => item?.kind === 'instrument');
  const events = visibleEvents(order);

  return (
    <RecordDetailScreen
      title={t('homeCollection.orderNumber', { id: order?.orderId ?? '' })}
      subtitle={[order?.patientName, formatRecordDateTime(order?.createdAt, months)].filter(Boolean).join(' · ')}
      isLoading={false}
      isRefreshing={false}
      error={order ? null : ''}
      errorFallback={t('homeCollection.openFailed')}
      onRetry={noop}
      onRefresh={noop}
    >
      {order ? (
        <>
          {/* ── Where it stands ── */}
          <DetailCard>
            <View style={styles.heroTop}>
              <View style={[styles.heroIcon, { backgroundColor: toneTint }]}>
                <Icon name="home-heart" size={22} color={toneInk} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.heroLabel, { color: muted }]}>{t('homeCollection.total')}</Text>
                <Text style={[styles.heroAmount, { color: theme.colors.onSurface }]}>{formatTaka(order?.totalAmount)}</Text>
              </View>
            </View>
            <View style={[styles.stepperBox, { backgroundColor: theme.colors.background }]}>
              <StatusStepper status={order?.status ?? ''} />
            </View>
            {order?.staffNote ? (
              <View style={[styles.note, { backgroundColor: warnTint }]}>
                <Icon name="information-outline" size={16} color={warnInk} />
                <Text style={[styles.noteText, { color: warnInk }]}>
                  <Text style={styles.noteLabel}>{`${t('homeCollection.hospitalNote')}: `}</Text>
                  {order.staffNote}
                </Text>
              </View>
            ) : null}
            {order?.collectorName ? (
              <View style={[styles.note, { backgroundColor: doneTint }]}>
                <Icon name="account-check-outline" size={18} color={done} />
                <View style={styles.flex}>
                  <Text style={[styles.collectorLabel, { color: done }]}>{t('homeCollection.collector')}</Text>
                  <Text style={[styles.collectorName, { color: theme.colors.onSurface }]}>
                    {[order.collectorName, formatRecordDateTime(order?.scheduledAt, months)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>
            ) : null}
          </DetailCard>

          {/* ── Where and when ── */}
          <DetailCard>
            <DetailHeading icon="map-marker-outline">{t('homeCollection.whereWhen')}</DetailHeading>
            <DetailFacts
              facts={[
                { label: t('homeCollection.address'), value: order?.address },
                { label: t('homeCollection.phone'), value: order?.phone },
                {
                  label: t('homeCollection.preferredDate'),
                  value: order?.preferredDate ? formatRecordDate(order.preferredDate, months) : '',
                },
                { label: t('homeCollection.preferredTime'), value: slotLabel(order?.preferredTime, t) },
                { label: t('homeCollection.note'), value: order?.note },
              ]}
            />
          </DetailCard>

          {/* ── What it is for and what it comes to ── */}
          <DetailCard>
            <DetailHeading icon="flask-outline">
              {t('homeCollection.tests')}
              {tests.length ? ` (${tests.length})` : ''}
            </DetailHeading>
            {[...tests, ...instruments].map((item, index) => (
              <View
                key={`${item?.itemId}-${index}`}
                style={[styles.line, index > 0 && styles.lineDivided, { borderTopColor: theme.colors.outlineVariant }]}
              >
                <View style={styles.flex}>
                  <Text style={[styles.lineName, { color: theme.colors.onSurface }]}>{item?.itemName || '—'}</Text>
                  {KIND_KEY[item?.kind ?? ''] ? (
                    <Text style={[styles.lineKind, { color: muted }]}>{t(KIND_KEY[item?.kind ?? ''])}</Text>
                  ) : null}
                </View>
                <Text style={[styles.lineAmount, { color: theme.colors.onSurface }]}>{formatTaka(item?.price)}</Text>
              </View>
            ))}
            {(order?.homeCollectionFee ?? 0) > 0 ? (
              <View style={[styles.line, styles.lineDivided, { borderTopColor: theme.colors.outlineVariant }]}>
                <Text style={[styles.lineName, styles.flex, { color: theme.colors.onSurface }]}>
                  {t('homeCollection.charge')}
                </Text>
                <Text style={[styles.lineAmount, { color: theme.colors.onSurface }]}>
                  {formatTaka(order?.homeCollectionFee)}
                </Text>
              </View>
            ) : null}
            <View style={[styles.totalRow, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text style={[styles.totalLabel, { color: theme.colors.onPrimaryContainer }]}>{t('homeCollection.total')}</Text>
              <Text style={[styles.totalLabel, { color: theme.colors.onPrimaryContainer }]}>{formatTaka(order?.totalAmount)}</Text>
            </View>
            {order?.billId ? (
              <Pressable onPress={openBills} accessibilityRole="button" style={styles.bill}>
                <Icon name="receipt" size={15} color={theme.colors.primary} />
                <Text style={[styles.billText, { color: theme.colors.primary }]}>
                  {t('homeCollection.billLine', { id: order.billId })}
                </Text>
                <Icon name="chevron-right" size={16} color={theme.colors.primary} />
              </Pressable>
            ) : null}
          </DetailCard>

          {/* ── What happened ── */}
          {events.length ? (
            <DetailCard>
              <DetailHeading icon="timeline-clock-outline">{t('homeCollection.timeline')}</DetailHeading>
              {events.map((event, index) => (
                <View key={`${event?.eventId}-${index}`} style={styles.event}>
                  <View style={styles.eventRail}>
                    <View style={[styles.eventDot, { backgroundColor: theme.colors.primary }]} />
                    {index < events.length - 1 ? (
                      <View style={[styles.eventLine, { backgroundColor: theme.colors.outlineVariant }]} />
                    ) : null}
                  </View>
                  <View style={[styles.flex, styles.eventBody]}>
                    <Text style={[styles.eventTitle, { color: theme.colors.onSurface }]}>{eventLabel(event, t)}</Text>
                    <Text style={[styles.eventMeta, { color: muted }]}>
                      {[
                        formatRecordDateTime(event?.createdAt, months),
                        event?.eventType !== 'created' ? event?.note : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </View>
              ))}
            </DetailCard>
          ) : null}

          {canCancelLabOrder(order) ? (
            <CustomButton
              mode="outlined"
              icon="cancel"
              onPress={() => setAsking(true)}
              disabled={isCancelling}
              textColor={theme.colors.error}
              style={[styles.cancelButton, { borderColor: theme.colors.error }]}
            >
              {t('homeCollection.cancelOrder')}
            </CustomButton>
          ) : null}

          <CustomDialog
            visible={asking}
            title={t('homeCollection.cancelTitle')}
            tone="danger"
            icon="close-circle-outline"
            message={t('homeCollection.cancelMessage')}
            confirmText={t('homeCollection.cancelOrder')}
            cancelText={t('common.cancel')}
            loading={isCancelling}
            onConfirm={confirmCancel}
            onDismiss={() => {
              if (!isCancelling) setAsking(false);
            }}
          />
        </>
      ) : null}
    </RecordDetailScreen>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  heroAmount: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
  },
  stepperBox: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 14,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  noteText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  noteLabel: {
    fontFamily: fontFamilies.semibold,
  },
  collectorLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
  },
  collectorName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  lineDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  lineName: {
    fontFamily: fontFamilies.medium,
    fontSize: 13.5,
  },
  lineKind: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    marginTop: 1,
  },
  lineAmount: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  totalLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 14.5,
  },
  bill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  billText: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
  },
  event: {
    flexDirection: 'row',
  },
  eventRail: {
    alignItems: 'center',
    width: 14,
  },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  eventLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  eventBody: {
    marginLeft: 10,
    paddingBottom: 12,
  },
  eventTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  eventMeta: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 1,
  },
  cancelButton: {
    borderRadius: 12,
    marginTop: 4,
  },
});

export default LabOrderDetailScreen;
