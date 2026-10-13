import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Appointment } from '@app/core';
import { CustomNoData, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { AppointmentsStackParamList } from '../../../navigation/AppointmentsStackNavigator';
import { DrawerParamList } from '../../../navigation/DrawerNavigator';
import { useAppointmentsViewModel, AppointmentTab } from './useAppointmentsViewModel';
import AppointmentCard from './AppointmentCard';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';

const STATUS_TABS: { tab: AppointmentTab; labelKey: string }[] = [
  { tab: 'upcoming', labelKey: 'appointments.tabUpcoming' },
  { tab: 'completed', labelKey: 'appointments.tabCompleted' },
  { tab: 'cancelled', labelKey: 'appointments.tabCancelled' },
  { tab: 'absent', labelKey: 'appointments.tabAbsent' },
];

export const PatientAppointmentIndex = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppointmentsStackParamList>>();
  const insets = useSafeAreaInsets();
  const viewModel = useAppointmentsViewModel();
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const handleBookNew = useCallback(() => {
    // This stack is the Activity tab, so Find Doctors means the Home tab beside
    // it — not the drawer's own copy of the screen.
    navigation
      .getParent<DrawerNavigationProp<DrawerParamList>>()
      ?.navigate('MainTabs', { screen: 'HomeTab' });
  }, [navigation]);

  const handleViewDetails = useCallback(
    (appointment: Appointment) => {
      if (!appointment?.id) return;
      navigation.navigate('AppointmentDetails', { appointmentId: appointment?.id });
    },
    [navigation],
  );

  const handleWriteReview = useCallback(
    (appointment: Appointment) => {
      if (!appointment?.id) return;
      navigation.navigate('AppointmentDetails', {
        appointmentId: appointment?.id,
        openReview: true,
      });
    },
    [navigation],
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader
        title={t('appointments.title')}
        leading="menu"
        right={
          <Pressable
            onPress={handleBookNew}
            style={[styles.bookNewButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.bookNewText, { color: theme.colors.onPrimary }]}>
              {t('appointments.bookNew')}
            </Text>
          </Pressable>
        }
      />

      <View style={styles.tabRow}>
        {STATUS_TABS.map(tab => {
          const selected = viewModel.activeTab === tab.tab;
          return (
            <Pressable
              key={tab.tab}
              onPress={() => viewModel.setActiveTab(tab.tab)}
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
                {`${t(tab.labelKey)} ${viewModel.counts?.[tab.tab] ?? 0}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        // +100 clears the floating tab bar — this list is the Activity tab now.
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {viewModel.isLoading ? (
          <View style={styles.listLoader}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : (viewModel.appointments?.length ?? 0) > 0 ? (
          viewModel.appointments?.map(appointment => (
            <AppointmentCard
              key={appointment?.id}
              appointment={appointment}
              onViewDetails={handleViewDetails}
              onWriteReview={handleWriteReview}
            />
          ))
        ) : (
          <CustomNoData
            message={viewModel.error ?? t('appointments.noAppointments')}
            style={styles.noResults}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bookNewButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bookNewText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  listLoader: {
    paddingVertical: 40,
  },
  noResults: {
    marginTop: 40,
  },
});

export default PatientAppointmentIndex;
