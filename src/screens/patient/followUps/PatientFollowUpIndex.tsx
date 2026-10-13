import React, { useCallback } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FOLLOW_UP_BUCKETS, FollowUp, FollowUpBucket } from '@app/core';
import { fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import FollowUpCard from './FollowUpCard';
import { useFollowUpsViewModel } from './useFollowUpsViewModel';

const TAB_LABEL_KEY: Record<FollowUpBucket, string> = {
  pending: 'followUps.tabUpcoming',
  overdue: 'followUps.tabOverdue',
  completed: 'followUps.tabCompleted',
  cancelled: 'followUps.tabCancelled',
};

/**
 * Patient's Follow-ups list — a drawer-level screen, not nested in a stack, so
 * cards are informational only (no "view details" push, unlike Appointments).
 */
export const PatientFollowUpIndex = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const viewModel = useFollowUpsViewModel();
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const keyExtractor = useCallback((item: FollowUp) => item?.id, []);
  const renderItem = useCallback(
    ({ item }: { item: FollowUp }) => <FollowUpCard followUp={item} />,
    [],
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={t('followUps.title')}
        leading="menu"
        subtitle={t('followUps.subtitle')}
      />

      {/* Four buckets do not fit the width as flexed pills, so the row scrolls
          the way the doctor's roster and the web's tab strip do. ScrollView's
          base style is flexGrow:1, which would stretch it to fill the column. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalStrip}
        contentContainerStyle={styles.tabRow}
      >
        {FOLLOW_UP_BUCKETS.map(bucket => {
          const selected = viewModel?.activeTab === bucket;
          return (
            <Pressable
              key={bucket}
              onPress={() => viewModel?.setActiveTab(bucket)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.tab,
                {
                  backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                  borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.tabText,
                  { color: selected ? theme.colors.onPrimary : theme.colors.onSurface },
                ]}
              >
                {t(TAB_LABEL_KEY[bucket])}
              </Text>
              <View
                style={[
                  styles.tabCount,
                  {
                    backgroundColor: selected
                      ? theme.colors.onPrimary
                      : theme.colors.primaryContainer,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabCountText,
                    {
                      color: selected
                        ? theme.colors.primary
                        : theme.colors.onPrimaryContainer,
                    },
                  ]}
                >
                  {viewModel?.counts?.[bucket] ?? 0}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={viewModel?.followUps}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={viewModel?.isLoading ?? false}
            onRefresh={viewModel?.refresh}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
          (viewModel?.followUps?.length ?? 0) === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          viewModel?.isLoading ? (
            <View style={styles.listLoader}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <View
                style={[styles.emptyIconWrap, { backgroundColor: theme.colors.primaryContainer }]}
              >
                <Icon
                  name="calendar-refresh-outline"
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                {t('followUps.emptyTitle')}
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.colors.onSurfaceVariant }]}>
                {viewModel?.error ?? t('followUps.emptyDesc')}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  horizontalStrip: {
    flexGrow: 0,
    flexShrink: 0,
  },
  tabRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tabText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
  },
  tabCount: {
    minWidth: 18,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignItems: 'center',
  },
  tabCountText: {
    fontFamily: fontFamilies.bold,
    fontSize: 9.5,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  listLoader: {
    paddingVertical: 40,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
  },
  emptyDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});

export default PatientFollowUpIndex;
