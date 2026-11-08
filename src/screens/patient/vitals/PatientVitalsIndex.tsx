import React, { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { VitalsRecord, VitalsRepository } from '@app/core';
import { fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useMonthNames } from '../../../hooks/useMonthNames';
import FilterPills, { FilterPill } from '../reports/FilterPills';
import RecordState from '../reports/RecordState';
import { RECORD_TONE } from '../reports/reportsUi';
import { useRecordList } from '../reports/useRecordList';
import VitalsHistoryRow from './VitalsHistoryRow';
import VitalsLatestCard from './VitalsLatestCard';
import VitalsTrendCard from './VitalsTrendCard';

/** The page has no search box. */
const noSearch = () => [];

/**
 * My Vitals — what was measured at the patient's OPD visits (and read off the
 * prescriptions they uploaded), as the portal runs it: one family member at a
 * time, the first by default so two people's readings never mix; the latest
 * sitting, the trend, and the history newest first.
 */
export const PatientVitalsIndex = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const months = useMonthNames();
  const viewModel = useRecordList(VitalsRepository.getVitals, noSearch);
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const { allItems, patients, patientCode, setPatientCode } = viewModel;
  const activeCode = patientCode || patients?.[0]?.code || '';

  // The backend sends them oldest first: the last is the latest, and the history runs backwards.
  const rows = useMemo(
    () => (allItems ?? []).filter(record => !activeCode || record?.patientCode === activeCode),
    [allItems, activeCode],
  );
  const latest = rows.length ? rows[rows.length - 1] : null;
  const history = useMemo(() => [...rows].reverse(), [rows]);

  const patientPills: FilterPill[] = useMemo(
    () => (patients ?? []).map(patient => ({ key: patient?.code ?? '', label: patient?.name ?? '' })),
    [patients],
  );

  const renderItem = useCallback(
    ({ item }: { item: VitalsRecord }) => <VitalsHistoryRow record={item} months={months} />,
    [months],
  );

  const ready = !viewModel.isLoading && viewModel.error === null;

  const header =
    ready && latest ? (
      <>
        <VitalsLatestCard record={latest} months={months} />
        <VitalsTrendCard records={rows} months={months} />
        <Text style={[styles.heading, { color: theme.colors.onSurface }]}>{t('vitals.history')}</Text>
      </>
    ) : null;

  const empty = viewModel.isLoading ? (
    <RecordState loading />
  ) : viewModel.error !== null ? (
    <RecordState
      isError
      title={t('reports.recordsLoadFailed')}
      hint={viewModel.error || t('reports.recordsLoadFailedHint')}
      actionLabel={t('reports.tryAgain')}
      onAction={viewModel.retry}
    />
  ) : (
    <RecordState icon={RECORD_TONE.vitals.icon} title={t('vitals.emptyTitle')} hint={t('vitals.emptyHint')} />
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t('vitals.title')} subtitle={t('vitals.subtitle')} leading="menu" />
      {ready && viewModel.showPatients ? (
        <View style={styles.pills}>
          <FilterPills items={patientPills} selected={activeCode} onSelect={setPatientCode} />
        </View>
      ) : null}
      <FlatList
        data={ready ? history : []}
        keyExtractor={(item, index) => `${item?.id ?? 'v'}-${index}`}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        refreshControl={
          <RefreshControl
            refreshing={viewModel.isRefreshing}
            onRefresh={viewModel.refresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pills: {
    marginBottom: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
  heading: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    marginTop: 4,
    marginBottom: 10,
  },
});

export default PatientVitalsIndex;
