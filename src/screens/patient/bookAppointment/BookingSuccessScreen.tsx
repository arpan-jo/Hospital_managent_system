import React, { useCallback } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatLongDate, to12Hour } from '@app/core';
import { CustomButton, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { FindDoctorsStackParamList } from '../../../navigation/FindDoctorsStackNavigator';
import { TabParamList } from '../../../navigation/TabNavigator';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { useBookingSuccessViewModel } from './useBookingSuccessViewModel';

export const BookingSuccessScreen = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<FindDoctorsStackParamList>>();
  const route = useRoute<RouteProp<FindDoctorsStackParamList, 'BookingSuccess'>>();
  const insets = useSafeAreaInsets();
  const monthNames = useMonthNames();
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  // Params are read defensively: a deep link can land here without them.
  const params: Partial<FindDoctorsStackParamList['BookingSuccess']> = route.params ?? {};
  const {
    doctorName = '',
    doctorSpecialty = '',
    patientName = '',
    date = '',
    time = '',
    officeName = '',
    token = 0,
    consultationLabel = '',
    amount = 0,
    paymentStatus = '',
  } = params;

  const viewModel = useBookingSuccessViewModel({ paymentStatus, amount });

  /** Back to the directory: the doctor's page under this screen is already gone. */
  const handleBackToDoctors = useCallback(() => {
    navigation.popToTop();
  }, [navigation]);

  /** Where the portal sends a patient after booking: their appointments. */
  const handleViewAppointments = useCallback(() => {
    // Switched on the tab navigator itself: sent through the drawer as
    // `MainTabs` params, the switch was lost to the pop below. `pop` lands on
    // the list even when an appointment's page was left open on that tab.
    navigation
      .getParent<BottomTabNavigationProp<TabParamList>>()
      ?.navigate('ActivityTab', { screen: 'AppointmentsList', pop: true });
    // So coming back to this tab shows the directory.
    navigation.popToTop();
  }, [navigation]);

  // Android's hardware back leaves the same way the header's arrow does.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          handleBackToDoctors();
          return true;
        },
      );

      return () => subscription?.remove?.();
    }, [handleBackToDoctors]),
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader
        title={t('bookingSuccess.title')}
        leading="back"
        onLeadingPress={handleBackToDoctors}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
      >
        <View style={[styles.checkCircle, { backgroundColor: '#1B9C5D' }]}>
          <Icon name="check" size={36} color="#FFFFFF" />
        </View>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {t('bookingSuccess.title')}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          {t('bookingSuccess.subtitle')}
        </Text>

        <View style={[styles.tokenBox, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text style={[styles.tokenLabel, { color: theme.colors.onPrimaryContainer }]}>
            {t('bookingSuccess.token')}
          </Text>
          <Text style={[styles.tokenValue, { color: theme.colors.primary }]}>{`#${token}`}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <SummaryRow label={t('bookingSuccess.doctor')} value={doctorName || t('common.na')} />
          {doctorSpecialty ? (
            <SummaryRow label={t('doctorProfile.specialty')} value={doctorSpecialty} />
          ) : null}
          {patientName ? (
            <SummaryRow label={t('doctorProfile.patient')} value={patientName} />
          ) : null}
          {consultationLabel ? (
            <SummaryRow label={t('doctorProfile.consultationOption')} value={consultationLabel} />
          ) : null}
          <SummaryRow
            label={t('bookingSuccess.date')}
            value={formatLongDate(date, monthNames) || t('common.na')}
          />
          <SummaryRow label={t('bookingSuccess.time')} value={to12Hour(time) || t('common.na')} />
          {officeName ? (
            <SummaryRow label={t('doctorProfile.office')} value={officeName} />
          ) : null}
          <SummaryRow label={t('doctorProfile.price')} value={viewModel?.amountLabel ?? ''} />
          <SummaryRow
            label={t('bookingSuccess.payment')}
            value={viewModel?.paymentLabel ?? ''}
            last
          />
        </View>

        <CustomButton
          mode="contained"
          onPress={handleViewAppointments}
          style={styles.primaryButton}
        >
          {t('bookingSuccess.viewAppointments')}
        </CustomButton>
        <Pressable onPress={handleBackToDoctors} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.secondaryLink, { color: theme.colors.primary }]}>
            {t('doctorProfile.backToDoctors')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
});

const SummaryRow = ({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) => {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.summaryRow,
        !last && { borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant },
      ]}
    >
      <Text style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[styles.summaryValue, { color: theme.colors.onSurface }]}
      >
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'center',
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  card: {
    width: '100%',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  summaryLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  summaryValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    marginLeft: 10,
    flexShrink: 1,
    textAlign: 'right',
  },
  tokenBox: {
    alignItems: 'center',
    minWidth: 120,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginBottom: 14,
  },
  tokenLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  tokenValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 28,
  },
  secondaryLink: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },
  primaryButton: {
    width: '100%',
    marginVertical: 0,
    borderRadius: 12,
  },
});

export default BookingSuccessScreen;
