import React, { useCallback } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DOSE_SLOTS } from '@app/core';
import { CustomSwitch, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import MedicineDoseCard from './MedicineDoseCard';
import ReminderScheduleSheet from './ReminderScheduleSheet';
import { MedicineDose, useTodaysMedicinesViewModel } from './useTodaysMedicinesViewModel';

export const TodaysMedicinesScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const viewModel = useTodaysMedicinesViewModel();
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const renderItem = useCallback(
    ({ item }: { item: MedicineDose }) => (
      <View style={styles.gridItem}>
        <MedicineDoseCard
          dose={item}
          slot={viewModel.activeSlot}
          taken={viewModel.isTaken(item?.id ?? '', viewModel.activeSlot)}
          onToggleTaken={viewModel.toggleTaken}
        />
      </View>
    ),
    [viewModel],
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={t('todaysMedicines.title')}
        subtitle={t('todaysMedicines.dosesTaken', {
          taken: viewModel.takenCount,
          total: viewModel.totalDoses,
        })}
        leading="back"
        right={
          <Pressable
            onPress={viewModel.openSchedule}
            style={[styles.scheduleButton, { borderColor: theme.colors.outlineVariant }]}
            accessibilityRole="button"
          >
            <Icon name="clock-outline" size={13} color={theme.colors.onSurface} />
            <Text style={[styles.scheduleText, { color: theme.colors.onSurface }]}>
              {t('todaysMedicines.schedule')}
            </Text>
          </Pressable>
        }
      />

      <View style={styles.controlRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {DOSE_SLOTS.map(slot => {
            const selected = viewModel.activeSlot === slot;
            return (
              <Pressable
                key={slot}
                onPress={() => viewModel.setActiveSlot(slot)}
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
                  {`${t(`todaysMedicines.slots.${slot}`)} ${viewModel.countsBySlot[slot] ?? 0}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <CustomSwitch
          label={t('todaysMedicines.alerts')}
          value={viewModel.alertsEnabled}
          onValueChange={viewModel.setAlertsEnabled}
          style={styles.alerts}
        />
      </View>

      <FlatList
        data={viewModel.doses}
        keyExtractor={item => item?.id ?? ''}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        // +100 clears the floating tab bar — this screen sits inside the
        // Prescription tab's stack, so the bar stays on top of it.
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
            {t('todaysMedicines.noMedicines')}
          </Text>
        }
      />

      <ReminderScheduleSheet
        visible={viewModel.isScheduleVisible}
        onClose={viewModel.closeSchedule}
        schedule={viewModel.schedule}
        onSave={viewModel.saveSchedule}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scheduleText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingBottom: 12,
  },
  tabRow: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  tab: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tabText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  // Overrides the shared switch's full-width row so it sits inline with the tabs.
  alerts: {
    width: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 0,
    gap: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  gridItem: {
    flex: 1,
    maxWidth: '50%',
  },
  empty: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 40,
  },
});

export default TodaysMedicinesScreen;
