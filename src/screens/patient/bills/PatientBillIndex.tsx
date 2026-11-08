import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BillsRepository, PortalBill, formatTaka, totalDueOf } from '@app/core';
import { fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { BillsStackParamList } from '../../../navigation/BillsStackNavigator';
import RecordListSection, { RecordBadge } from '../reports/RecordListSection';
import { formatRecordDate } from '../reports/reportsUi';
import { useRecordList } from '../reports/useRecordList';
import { billSearch, billStatusKey, billStatusTone, isBillDue } from './billUi';

/**
 * My Bills — every bill raised at the hospital for the account, as the portal
 * lists them: what each came to, whether it is paid, and what is still owed.
 * Read only; nothing is paid from here.
 */
export const PatientBillIndex = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<BillsStackParamList>>();
  const insets = useSafeAreaInsets();
  const months = useMonthNames();
  const viewModel = useRecordList(BillsRepository.getBills, billSearch);
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  // Owed across every bill on the account, as the portal sums it — the filters do not change it.
  const { allItems } = viewModel;
  const totalDue = useMemo(() => totalDueOf(allItems ?? []), [allItems]);
  const dueCount = useMemo(() => (allItems ?? []).filter(isBillDue).length, [allItems]);

  const badgesOf = useCallback(
    (bill: PortalBill): RecordBadge[] => {
      const statusKey = billStatusKey(bill);
      return [
        ...(viewModel.showPatients ? [{ label: bill?.patientName ?? '', tone: 'brand' as const }] : []),
        { label: statusKey ? t(statusKey) : bill?.paymentStatus ?? '', tone: billStatusTone(bill) },
        ...(isBillDue(bill)
          ? [{ label: t('bills.dueAmount', { amount: formatTaka(bill?.dueAmount) }), tone: 'warn' as const }]
          : []),
      ];
    },
    [viewModel.showPatients, t],
  );

  const openBill = useCallback(
    (bill: PortalBill) => {
      if (!bill?.billId) return;
      navigation.navigate('BillDetail', { bill });
    },
    [navigation],
  );

  const dueInk = theme.dark ? '#F5C26B' : '#B27400';
  const dueTint = theme.dark ? '#3A2E14' : '#FEF3E0';
  const dueBanner =
    totalDue > 0 ? (
      <View style={[styles.due, { backgroundColor: dueTint }]}>
        <View style={[styles.dueIcon, { backgroundColor: theme.colors.surface }]}>
          <Icon name="alert-circle-outline" size={22} color={dueInk} />
        </View>
        <View style={styles.dueText}>
          <Text style={[styles.dueLabel, { color: theme.colors.onSurfaceVariant }]}>{t('bills.totalDue')}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.dueAmount, { color: dueInk }]}>
            {formatTaka(totalDue)}
          </Text>
        </View>
        {dueCount > 0 ? (
          <View style={[styles.dueCount, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.dueCountText, { color: dueInk }]}>
              {t('bills.dueBills', { count: dueCount })}
            </Text>
          </View>
        ) : null}
      </View>
    ) : null;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t('bills.title')} subtitle={t('bills.subtitle')} leading="menu" />
      <RecordListSection<PortalBill>
        kind="bills"
        viewModel={viewModel}
        bottomPadding={insets.bottom + 24}
        searchPlaceholder={t('bills.search')}
        emptyTitle={t('bills.emptyTitle')}
        emptyHint={t('bills.emptyHint')}
        noMatchTitle={t('bills.noMatch')}
        keyOf={bill => String(bill?.billId)}
        titleOf={bill =>
          `${bill?.billCode || t('bills.billFallback', { id: bill?.billId ?? '' })} · ${formatTaka(bill?.billTotal)}`
        }
        metaOf={bill => [
          formatRecordDate(bill?.billDate, months),
          bill?.billType,
          bill?.doctorName,
          t('bills.itemCount', { count: bill?.items?.length ?? 0 }),
        ]}
        badgesOf={badgesOf}
        onOpen={openBill}
        header={dueBanner}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  due: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  dueIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueText: {
    flex: 1,
    marginHorizontal: 12,
  },
  dueLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
  },
  dueAmount: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    marginTop: 1,
  },
  dueCount: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dueCountText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
  },
});

export default PatientBillIndex;
