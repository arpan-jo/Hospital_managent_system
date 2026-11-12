import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BillItem, BillPayment, PortalBill, formatTaka } from '@app/core';
import { fontFamilies } from '@app/ui';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { BillsStackParamList } from '../../../navigation/BillsStackNavigator';
import type { DrawerParamList } from '../../../navigation/DrawerNavigator';
import { DetailCard, DetailHeading, RecordDetailScreen } from '../reports/RecordDetail';
import { useBadgeColors } from '../reports/RecordCard';
import { RECORD_TONE, formatRecordDate, formatRecordDateTime, recordTone } from '../reports/reportsUi';
import { billStatusKey, billStatusTone, paidShare, paymentIcon } from './billUi';

const noop = () => {};

/** The top of the bill: what it came to, its standing, and how much of it is paid. */
const SummaryHero = ({ bill }: { bill: PortalBill }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const tone = recordTone('bills', theme.dark);
  const statusKey = billStatusKey(bill);
  // The portal's sheet names a cancelled bill so, and any other by its payment status.
  const statusLabel = bill?.isCancelled ? t('bills.status.cancelled') : statusKey ? t(statusKey) : bill?.paymentStatus;
  // The status pill takes the list badge's colours.
  const status = useBadgeColors()[billStatusTone(bill)];
  const share = paidShare(bill);
  const muted = theme.colors.onSurfaceVariant;

  return (
    <DetailCard>
      <View style={styles.heroTop}>
        <View style={[styles.iconTile, { backgroundColor: tone.tint }]}>
          <Icon name={RECORD_TONE.bills.icon} size={22} color={tone.color} />
        </View>
        <View style={styles.heroText}>
          <Text style={[styles.heroLabel, { color: muted }]}>{t('bills.total')}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.heroAmount, { color: theme.colors.onSurface }]}>
            {formatTaka(bill?.billTotal)}
          </Text>
        </View>
        {statusLabel ? (
          <View style={[styles.pill, { backgroundColor: status.tint }]}>
            <Text style={[styles.pillText, { color: status.color }]}>{statusLabel}</Text>
          </View>
        ) : null}
      </View>

      {!bill?.isCancelled && (bill?.billTotal ?? 0) > 0 ? (
        <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
          <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: status.color }]} />
        </View>
      ) : null}

      <View style={styles.split}>
        <View style={styles.splitCell}>
          <Text style={[styles.splitLabel, { color: muted }]}>{t('bills.paid')}</Text>
          <Text style={[styles.splitValue, { color: theme.colors.onSurface }]}>{formatTaka(bill?.paidAmount)}</Text>
        </View>
        <View style={[styles.splitDivider, { backgroundColor: theme.colors.outlineVariant }]} />
        <View style={styles.splitCell}>
          <Text style={[styles.splitLabel, { color: muted }]}>{t('bills.due')}</Text>
          <Text
            style={[
              styles.splitValue,
              { color: (bill?.dueAmount ?? 0) > 0 && !bill?.isCancelled ? status.color : theme.colors.onSurface },
            ]}
          >
            {formatTaka(bill?.dueAmount)}
          </Text>
        </View>
      </View>

      {bill?.doctorName ? (
        <View style={[styles.doctor, { borderTopColor: theme.colors.outlineVariant }]}>
          <Icon name="stethoscope" size={15} color={muted} />
          <Text numberOfLines={1} style={[styles.doctorText, { color: muted }]}>
            {bill.doctorName}
          </Text>
        </View>
      ) : null}
    </DetailCard>
  );
};

/** One line of the receipt-style breakdown. */
const SumLine = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => {
  const theme = useTheme();
  const textStyle = strong ? styles.sumStrong : styles.sumText;
  return (
    <View style={styles.sumLine}>
      <Text style={[textStyle, { color: strong ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Text style={[textStyle, { color: theme.colors.onSurface }]}>{value}</Text>
    </View>
  );
};

/** One line of the bill; a cancelled one is struck through and counts for nothing. */
const ItemRow = ({ item }: { item: BillItem }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = theme.colors.onSurfaceVariant;
  const struck = item?.isCancelled ? styles.struck : null;
  const sub = [
    t('bills.quantityPrice', { quantity: item?.quantity ?? 0, price: formatTaka(item?.price) }),
    (item?.discount ?? 0) > 0 ? t('bills.discountAmount', { amount: formatTaka(item?.discount) }) : '',
    item?.isCancelled ? t('bills.status.cancelled') : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.row, { borderTopColor: theme.colors.outlineVariant }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: item?.isCancelled ? muted : theme.colors.onSurface }, struck]}>
          {item?.itemName || '—'}
        </Text>
        <Text style={[styles.rowMeta, { color: muted }]}>{sub}</Text>
      </View>
      <Text style={[styles.rowAmount, { color: item?.isCancelled ? muted : theme.colors.onSurface }, struck]}>
        {formatTaka(item?.total)}
      </Text>
    </View>
  );
};

/** One payment made against the bill — how much, how, and when. */
const PaymentRow = ({ payment, months }: { payment: BillPayment; months: string[] }) => {
  const theme = useTheme();
  const tone = recordTone('bills', theme.dark);
  const muted = theme.colors.onSurfaceVariant;
  const when = [formatRecordDateTime(payment?.paidAt, months), payment?.reference].filter(Boolean).join(' · ');

  return (
    <View style={[styles.row, { borderTopColor: theme.colors.outlineVariant }]}>
      <View style={[styles.payIcon, { backgroundColor: tone.tint }]}>
        <Icon name={paymentIcon(payment?.method)} size={17} color={tone.color} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>{payment?.method || '—'}</Text>
        {when ? <Text style={[styles.rowMeta, { color: muted }]}>{when}</Text> : null}
      </View>
      <Text style={[styles.rowAmount, { color: theme.colors.onSurface }]}>{formatTaka(payment?.amount)}</Text>
    </View>
  );
};

/**
 * One bill, as the portal's bill sheet holds it — what it came to, what was
 * paid and what is owed, every item and every payment — laid out for a phone.
 * All of it came with the list, so nothing is read again here.
 */
export const BillDetailScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const months = useMonthNames();
  const navigation = useNavigation<NativeStackNavigationProp<BillsStackParamList>>();
  const route = useRoute<RouteProp<BillsStackParamList, 'BillDetail'>>();
  const bill = route?.params?.bill;
  const items = bill?.items ?? [];
  const payments = bill?.payments ?? [];

  // The portal links a bill to its reports. Here the Reports tab opens on the
  // bill's own tests: the lab sections, searched by the bill's code.
  const billCode = bill?.billCode ?? '';
  const openReports = useCallback(() => {
    if (!billCode) return;
    navigation
      ?.getParent?.<DrawerNavigationProp<DrawerParamList>>()
      ?.navigate?.('MainTabs', {
        screen: 'ReportsTab',
        params: {
          screen: 'ReportsHome',
          params: {
            bill: { code: billCode, at: Date.now() },
          },
        },
      });
  }, [navigation, billCode]);

  return (
    <RecordDetailScreen
      title={bill?.billCode || t('bills.billFallback', { id: bill?.billId ?? '' })}
      subtitle={[bill?.patientName, formatRecordDate(bill?.billDate, months), bill?.billType]
        .filter(Boolean)
        .join(' · ')}
      isLoading={false}
      isRefreshing={false}
      error={bill ? null : ''}
      errorFallback={t('bills.openFailed')}
      onRetry={noop}
      onRefresh={noop}
    >
      {bill ? (
        <>
          <SummaryHero bill={bill} />

          <DetailCard>
            <DetailHeading icon="calculator-variant-outline">{t('bills.summaryTitle')}</DetailHeading>
            <SumLine label={t('bills.subtotal')} value={formatTaka(bill?.subtotal)} />
            {(bill?.totalDiscount ?? 0) > 0 ? (
              <SumLine label={t('bills.discount')} value={`− ${formatTaka(bill?.totalDiscount)}`} />
            ) : null}
            <View style={[styles.sumRule, { backgroundColor: theme.colors.outlineVariant }]} />
            <SumLine label={t('bills.total')} value={formatTaka(bill?.billTotal)} strong />
          </DetailCard>

          <DetailCard>
            <DetailHeading icon="format-list-bulleted">
              {t('bills.itemsTitle')}
              {items.length ? ` (${items.length})` : ''}
            </DetailHeading>
            {items.length ? (
              items.map((item, index) => <ItemRow key={`${item?.billRowId}-${index}`} item={item} />)
            ) : (
              <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>{t('bills.noItems')}</Text>
            )}
          </DetailCard>

          <DetailCard>
            <DetailHeading icon="cash-check">{t('bills.paymentsTitle')}</DetailHeading>
            {payments.length ? (
              payments.map((payment, index) => (
                <PaymentRow key={`${payment?.paymentId}-${index}`} payment={payment} months={months} />
              ))
            ) : (
              <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
                {t('bills.noPayments')}
              </Text>
            )}
          </DetailCard>

          {bill?.billCode ? (
            <Button
              mode="outlined"
              icon="file-chart-outline"
              onPress={openReports}
              style={styles.reports}
              labelStyle={styles.reportsLabel}
            >
              {t('bills.viewReports')}
            </Button>
          ) : null}
        </>
      ) : null}
    </RecordDetailScreen>
  );
};

const styles = StyleSheet.create({
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginHorizontal: 12,
  },
  heroLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
  },
  heroAmount: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    marginTop: 1,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 14,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  split: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  splitCell: {
    flex: 1,
  },
  splitDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginHorizontal: 14,
  },
  splitLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  splitValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    marginTop: 2,
  },
  doctor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    paddingTop: 12,
  },
  doctorText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  sumLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  sumText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
  },
  sumStrong: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  sumRule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  payIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  rowMeta: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
  },
  rowAmount: {
    fontFamily: fontFamilies.bold,
    fontSize: 13.5,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  empty: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    paddingVertical: 6,
  },
  reports: {
    borderRadius: 12,
  },
  reportsLabel: {
    fontFamily: fontFamilies.semibold,
  },
});

export default BillDetailScreen;
