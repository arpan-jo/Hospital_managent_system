import React, { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LabOrder } from '@app/core';
import { fontFamilies, useAppTheme } from '@app/ui';
import { aiPalette, withAlpha } from '../../../components/ai/aiPalette';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { HomeCollectionStackParamList } from '../../../navigation/HomeCollectionStackNavigator';
import RecordState from '../reports/RecordState';
import LabOrderCard from './LabOrderCard';
import { useLabOrders } from './useLabOrders';

/** The portal's "how it works", step by step. */
const HOW_IT_WORKS = [
  { icon: 'clipboard-check-outline', titleKey: 'homeCollection.how.pickTitle', hintKey: 'homeCollection.how.pickHint' },
  { icon: 'map-marker-outline', titleKey: 'homeCollection.how.whereTitle', hintKey: 'homeCollection.how.whereHint' },
  { icon: 'truck-fast-outline', titleKey: 'homeCollection.how.comeTitle', hintKey: 'homeCollection.how.comeHint' },
];

/**
 * Home Collection — lab tests ordered online and collected at home, as the
 * portal runs it: book one, and follow each order from request to report.
 * Laid out for a phone: the booking on the brand wash, the three steps, then
 * the orders still with the hospital and the ones done with.
 */
export const HomeCollectionIndex = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const months = useMonthNames();
  const navigation = useNavigation<NativeStackNavigationProp<HomeCollectionStackParamList>>();
  const viewModel = useLabOrders();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const palette = aiPalette(theme);
  const ink = palette.onGradient;
  const muted = theme.colors.onSurfaceVariant;

  const openNew = useCallback(() => navigation.navigate('NewLabOrder'), [navigation]);
  const openOrder = useCallback(
    (order: LabOrder) => {
      if (!order?.orderId) return;
      navigation.navigate('LabOrderDetail', { order });
    },
    [navigation],
  );

  const section = (titleKey: string, rows: LabOrder[], dim?: boolean) =>
    rows.length ? (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: dim ? muted : theme.colors.onSurface }]}>
          {t(titleKey)}
          <Text style={[styles.sectionCount, { color: muted }]}>{`  ${rows.length}`}</Text>
        </Text>
        {rows.map(order => (
          <LabOrderCard key={order?.orderId} order={order} months={months} onOpen={openOrder} />
        ))}
      </View>
    ) : null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title={t('homeCollection.title')} subtitle={t('homeCollection.subtitle')} leading="menu" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={viewModel.isRefreshing}
            onRefresh={viewModel.refresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* ── Book one ── */}
        <View style={[styles.hero, { backgroundColor: palette.base, experimental_backgroundImage: palette.gradient }]}>
          <View pointerEvents="none" style={[styles.ring, styles.ringLarge, { borderColor: ink }]} />
          <View pointerEvents="none" style={[styles.ring, styles.ringSmall, { borderColor: ink }]} />
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: withAlpha(ink, 0.16) }]}>
              <Icon name="home-heart" size={24} color={ink} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.heroTitle, { color: ink }]}>{t('homeCollection.heroTitle')}</Text>
              <Text style={[styles.heroHint, { color: withAlpha(ink, 0.82) }]}>{t('homeCollection.heroHint')}</Text>
            </View>
          </View>
          <Pressable
            onPress={openNew}
            accessibilityRole="button"
            style={({ pressed }) => [styles.heroButton, { backgroundColor: theme.colors.surface, opacity: pressed ? 0.9 : 1 }]}
          >
            <Icon name="plus" size={18} color={theme.colors.primary} />
            <Text style={[styles.heroButtonText, { color: theme.colors.primary }]}>{t('homeCollection.book')}</Text>
          </Pressable>
        </View>

        {/* ── How it works ── */}
        <View style={[styles.steps, { backgroundColor: theme.colors.surface }]}>
          {HOW_IT_WORKS.map((step, index) => (
            <View key={step.titleKey} style={styles.stepRow}>
              <View style={styles.stepRail}>
                <View style={[styles.stepIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Icon name={step.icon} size={17} color={theme.colors.primary} />
                </View>
                {index < HOW_IT_WORKS.length - 1 ? (
                  <View style={[styles.stepLine, { backgroundColor: theme.colors.outlineVariant }]} />
                ) : null}
              </View>
              <View style={[styles.flex, styles.stepText]}>
                <Text style={[styles.stepTitle, { color: theme.colors.onSurface }]}>
                  <Text style={{ color: theme.colors.primary }}>{`${index + 1}. `}</Text>
                  {t(step.titleKey)}
                </Text>
                <Text style={[styles.stepHint, { color: muted }]}>{t(step.hintKey)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── The orders ── */}
        {viewModel.isLoading ? (
          <RecordState loading />
        ) : viewModel.error !== null ? (
          <RecordState
            isError
            title={t('homeCollection.loadFailed')}
            hint={viewModel.error || t('reports.recordsLoadFailedHint')}
            actionLabel={t('reports.tryAgain')}
            onAction={viewModel.retry}
          />
        ) : !viewModel.orders.length ? (
          <RecordState icon="flask-outline" title={t('homeCollection.emptyTitle')} hint={t('homeCollection.emptyHint')} />
        ) : (
          <>
            {section('homeCollection.activeOrders', viewModel.active)}
            {section('homeCollection.pastOrders', viewModel.past, true)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 14,
  },
  hero: {
    borderRadius: 22,
    padding: 16,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    opacity: 0.18,
  },
  ringLarge: {
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -96,
    right: -50,
  },
  ringSmall: {
    width: 90,
    height: 90,
    borderRadius: 45,
    bottom: -50,
    right: 60,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
  },
  heroHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    marginTop: 2,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    minHeight: 48,
    marginTop: 16,
  },
  heroButtonText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14.5,
  },
  steps: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
  },
  stepRail: {
    alignItems: 'center',
    width: 34,
  },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 10,
    marginVertical: 3,
    borderRadius: 1,
  },
  stepText: {
    marginLeft: 12,
    paddingBottom: 12,
  },
  stepTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    marginTop: 2,
  },
  stepHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    marginTop: 2,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    marginTop: 2,
  },
  sectionCount: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
  },
});

export default HomeCollectionIndex;
