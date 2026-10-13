import React, { useCallback } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
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
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CustomButton, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { AppointmentsStackParamList } from '../../../navigation/AppointmentsStackNavigator';
import { DrawerParamList } from '../../../navigation/DrawerNavigator';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useBookingSuccessViewModel } from './useBookingSuccessViewModel';

export const BookingSuccessScreen = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppointmentsStackParamList>>();
  const route = useRoute<RouteProp<AppointmentsStackParamList, 'BookingSuccess'>>();
  const insets = useSafeAreaInsets();
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  // Params are read defensively: a deep link can land here without them.
  const params: Partial<AppointmentsStackParamList['BookingSuccess']> = route.params ?? {};
  const {
    doctorId = '',
    date = '',
    slotLabel = '',
    location = '',
    locationAddress = '',
    token = 0,
    amount = 0,
    paymentMethod = '',
    paymentStatus = '',
    dueAmount = 0,
    doctorName = '',
    doctorSpecialty = '',
    patientName = '',
  } = params;

  const viewModel = useBookingSuccessViewModel({
    doctorId,
    doctorName,
    paymentMethod,
    paymentStatus,
    amount,
    dueAmount,
  });

  const doctor = viewModel?.doctor;

  const handleBackToHome = useCallback(() => {
    // This screen sits on top of the booking stack, so the stack has to unwind
    // first — focusing the tab alone would leave the success screen mounted and
    // "Back to Home" would look like it did nothing. `popToTop` lands on Find
    // Doctors in the Home stack, and on the appointments list in the Activity
    // stack, which the tab switch below then leaves for Home.
    navigation.popToTop();
    navigation
      .getParent<DrawerNavigationProp<DrawerParamList>>()
      ?.navigate('MainTabs', { screen: 'HomeTab' });
  }, [navigation]);

  // Android's hardware back must not walk back into the confirmation screen:
  // the appointment is already booked, and confirming again would double-book.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          handleBackToHome();
          return true;
        },
      );

      return () => subscription?.remove?.();
    }, [handleBackToHome]),
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Leading action goes home rather than back: the booking is already
          placed, so the confirmation screen behind this one is a dead end. */}
      <ScreenHeader
        title={t('bookingSuccess.title')}
        leading="back"
        onLeadingPress={handleBackToHome}
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

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <SummaryRow
            label={t('bookingSuccess.doctor')}
            value={doctorName || doctor?.name || t('common.na')}
          />
          <SummaryRow
            label={t('details.specialty')}
            value={doctorSpecialty || doctor?.specialty || t('common.na')}
          />
          {patientName ? (
            <SummaryRow
              label={t('bookAppointment.appointmentFor')}
              value={patientName}
            />
          ) : null}
          <SummaryRow label={t('bookingSuccess.date')} value={date || t('common.na')} />
          <SummaryRow label={t('bookingSuccess.time')} value={slotLabel || t('common.na')} />
          <SummaryRow
            label={t('bookingSuccess.location')}
            value={location || t('common.na')}
          />
          {locationAddress ? (
            <SummaryRow
              label={t('createAppointment.chamberAddress')}
              value={locationAddress}
            />
          ) : null}
          <SummaryRow
            label={t('bookingSuccess.token')}
            value={`#${token}`}
            valueColor={theme.colors.primary}
          />
          <SummaryRow
            label={t('details.consultationFee')}
            value={viewModel?.amountLabel ?? ''}
          />
          {viewModel?.hasDue ? (
            <SummaryRow
              label={t('booking.dueAmount')}
              value={viewModel?.dueAmountLabel ?? ''}
            />
          ) : null}
          <SummaryRow
            label={t('bookingSuccess.payment')}
            value={viewModel?.paymentLabel ?? ''}
            last
          />
        </View>

        <View style={[styles.reminder, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name="calendar-check-outline" size={16} color={theme.colors.primary} />
          <Text style={[styles.reminderText, { color: theme.colors.primary }]}>
            {t('bookingSuccess.reminder')}
          </Text>
        </View>

        <CustomButton
          mode="contained"
          onPress={handleBackToHome}
          style={styles.primaryButton}
        >
          {t('bookingSuccess.backToHome')}
        </CustomButton>
      </ScrollView>
    </SafeAreaView>
  );
});

const SummaryRow = ({
  label,
  value,
  valueColor,
  last,
}: {
  label: string;
  value: string;
  valueColor?: string;
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
        style={[styles.summaryValue, { color: valueColor ?? theme.colors.onSurface }]}
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
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  reminderText: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    lineHeight: 15,
  },
  primaryButton: {
    width: '100%',
    marginVertical: 0,
    borderRadius: 12,
  },
});

export default BookingSuccessScreen;
