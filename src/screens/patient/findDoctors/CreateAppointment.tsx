import React, { useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  DoctorTimeSlot,
  PatientProfile,
  formatShortDate,
  getFileUrl,
  to12Hour,
  toISODate,
} from '@app/core';
import {
  CustomAvatar,
  CustomButton,
  CustomChip,
  CustomDatePicker,
  CustomInput,
  CustomNoData,
  fontFamilies,
} from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { DoctorFlowStackParamList } from '../../../navigation/appointmentRoutes';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useCreateAppointmentViewModel } from './useCreateAppointmentViewModel';

export type { ConsultationType } from './useCreateAppointmentViewModel';

const SectionLabel = ({ text }: { text: string }) => {
  const theme = useTheme();
  return (
    <Text style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>
      {text}
    </Text>
  );
};

export const CreateAppointment = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<DoctorFlowStackParamList>>();
  const route =
    useRoute<RouteProp<DoctorFlowStackParamList, 'CreateAppointment'>>();
  const insets = useSafeAreaInsets();
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  // Params are read defensively: a deep link can land here without them.
  const { doctorId = '', slotStart } = route.params ?? {};

  const viewModel = useCreateAppointmentViewModel(doctorId, slotStart);
  const {
    doctor,
    selectedLocation,
    selectedProfile,
    selectedSlot,
    date,
    chiefComplaint,
    consultationType,
    amount,
    isSlotOver,
    clearSlot,
  } = viewModel;

  const scrollRef = useRef<ScrollView | null>(null);
  const isComplaintFocused = useRef(false);

  // The complaint box is the last card, so the keyboard covers it on open.
  // `keyboardDidShow` is the only point where the window has already resized —
  // scrolling on focus alone runs against the pre-resize height and lands short.
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      if (!isComplaintFocused.current) return;
      scrollRef.current?.scrollToEnd?.({ animated: true });
    });

    return () => subscription?.remove?.();
  }, []);

  const handleComplaintFocus = useCallback(() => {
    isComplaintFocused.current = true;
    // Covers tapping the field while the keyboard is already up, when no
    // `keyboardDidShow` follows.
    scrollRef.current?.scrollToEnd?.({ animated: true });
  }, []);

  const handleComplaintBlur = useCallback(() => {
    isComplaintFocused.current = false;
  }, []);

  const photoUri = getFileUrl(doctor?.photoUrl);

  const slotLabel = selectedSlot
    ? `${to12Hour(selectedSlot?.startTime)} - ${to12Hour(
        selectedSlot?.endTime,
      )}`
    : '';

  const handleContinue = useCallback(() => {
    if (!viewModel?.isReady) return;
    // It may have closed since it was picked; clearing it shows it as over.
    if (isSlotOver(selectedSlot)) {
      clearSlot();
      return;
    }

    navigation.navigate('ConfirmAppointment', {
      doctorId: doctor?.id ?? '',
      patientCode: selectedProfile?.patientCode ?? '',
      patientName: selectedProfile?.fullName ?? '',
      locationId: selectedLocation?.locationId ?? '',
      location: selectedLocation?.name ?? '',
      locationAddress: selectedLocation?.address ?? '',
      consultationType,
      amount,
      date: toISODate(date),
      slotStart: selectedSlot?.startTime ?? '',
      slotEnd: selectedSlot?.endTime ?? '',
      slotLabel,
      chiefComplaint: chiefComplaint?.trim() ?? '',
    });
  }, [
    navigation,
    viewModel?.isReady,
    doctor?.id,
    selectedProfile,
    selectedLocation,
    consultationType,
    amount,
    date,
    selectedSlot,
    slotLabel,
    chiefComplaint,
    isSlotOver,
    clearSlot,
  ]);

  const renderPatientProfile = useCallback(
    (profile: PatientProfile) => {
      const selected =
        viewModel?.selectedProfileId === profile?.patientProfileId;
      const profilePhoto = getFileUrl(profile?.photoUrl);

      return (
        <Pressable
          key={profile?.patientProfileId}
          onPress={() => viewModel?.selectProfile?.(profile?.patientProfileId)}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          style={[
            styles.profileCard,
            {
              backgroundColor: selected
                ? theme.colors.primary
                : theme.colors.surface,
              borderColor: selected
                ? theme.colors.primary
                : theme.colors.outlineVariant,
            },
          ]}
        >
          <CustomAvatar
            type={profilePhoto ? 'image' : 'text'}
            value={profilePhoto || profile?.fullName || '?'}
            fallback={profile?.fullName}
            size={30}
          />
          <View style={styles.profileInfo}>
            <Text
              numberOfLines={1}
              style={[
                styles.profileName,
                {
                  color: selected
                    ? theme.colors.onPrimary
                    : theme.colors.onSurface,
                },
              ]}
            >
              {profile?.fullName || t('common.na')}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.profileRelation,
                {
                  color: selected
                    ? theme.colors.onPrimary
                    : theme.colors.onSurfaceVariant,
                },
              ]}
            >
              {viewModel?.relationshipLabel?.(profile)}
            </Text>
          </View>
        </Pressable>
      );
    },
    [viewModel, t, theme.colors],
  );

  const renderSlot = useCallback(
    (slot: DoctorTimeSlot) => {
      const selected = viewModel?.selectedSlot?.startTime === slot?.startTime;
      const isFull = (slot?.availableCount ?? 0) <= 0;
      // Today's window whose end time has passed — see `isSlotOver`.
      const isOver = viewModel?.isSlotOver?.(slot) ?? false;
      const isClosed = isFull || isOver;

      return (
        <Pressable
          key={`${slot?.startTime}-${slot?.endTime}`}
          onPress={() => viewModel?.selectSlot?.(slot)}
          // A full window cannot be booked — the web build greys it out too.
          disabled={isClosed}
          accessibilityRole="button"
          accessibilityState={{ selected, disabled: isClosed }}
          style={[
            styles.slotCard,
            {
              backgroundColor: selected
                ? theme.colors.primary
                : theme.colors.surfaceVariant,
              borderColor: selected ? theme.colors.primary : 'transparent',
              opacity: isClosed ? 0.45 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.slotTime,
              {
                color: selected
                  ? theme.colors.onPrimary
                  : theme.colors.onSurface,
              },
            ]}
          >
            {`${to12Hour(slot?.startTime)} – ${to12Hour(slot?.endTime)}`}
          </Text>
          <Text
            style={[
              styles.slotLeft,
              {
                color: selected
                  ? theme.colors.onPrimary
                  : theme.colors.onSurfaceVariant,
              },
            ]}
          >
            {isOver
              ? t('createAppointment.slotOver')
              : isFull
              ? t('createAppointment.slotFull')
              : t('doctorProfile.slotsLeft', {
                  count: slot?.availableCount ?? 0,
                  total: slot?.maxCapacity ?? 0,
                })}
          </Text>
        </Pressable>
      );
    },
    [viewModel, t, theme.colors],
  );

  if (viewModel?.doctorDetailsRequest?.isLoading) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ScreenHeader title={t('createAppointment.title')} leading="back" />
        <View style={styles.stateWrap}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!doctor) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ScreenHeader title={t('createAppointment.title')} leading="back" />
        <View style={styles.stateWrap}>
          <CustomNoData
            message={
              viewModel?.doctorDetailsRequest?.error ?? t('common.noDataFound')
            }
          />
          <CustomButton
            mode="outlined"
            onPress={viewModel?.fetchDoctorDetails}
            style={styles.retry}
          >
            {t('common.retry')}
          </CustomButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t('createAppointment.title')} leading="back" />

      {/* `padding` on Android too: the app runs edge-to-edge (RN 0.85), so the
          manifest's `adjustResize` no longer shrinks the window and the
          keyboard would simply cover the complaint box. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
          ]}
        >
          {/* Doctor summary — the left-hand card of the web layout. */}
          <View
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.doctorRow}>
              <CustomAvatar
                type={photoUri ? 'image' : 'text'}
                value={photoUri || doctor?.name || '?'}
                fallback={doctor?.name}
                size={52}
              />
              <View style={styles.doctorInfo}>
                <Text
                  numberOfLines={1}
                  style={[styles.doctorName, { color: theme.colors.onSurface }]}
                >
                  {doctor?.name || t('common.na')}
                </Text>
                <Text
                  style={[
                    styles.doctorSpecialty,
                    { color: theme.colors.primary },
                  ]}
                >
                  {doctor?.specialty || doctor?.designation || t('common.na')}
                </Text>
                {doctor?.qualification ? (
                  <Text
                    numberOfLines={3}
                    style={[
                      styles.doctorQualification,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {doctor?.qualification}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Icon
                  name="briefcase-outline"
                  size={13}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.statText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {t('doctorProfile.years', {
                    value: doctor?.experienceYears ?? 0,
                  })}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Icon name="map-marker-outline" size={13} color="#1B9C5D" />
                <Text
                  style={[
                    styles.statText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {t('doctorProfile.sites', {
                    value: viewModel?.siteCount ?? 0,
                  })}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Icon
                  name="credit-card-outline"
                  size={13}
                  color={theme.colors.primary}
                />
                <Text
                  style={[
                    styles.statText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {viewModel?.feeRangeLabel}
                </Text>
              </View>
            </View>
          </View>

          {/* Appointment For — every profile on the account. */}
          <View
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <SectionLabel text={t('bookAppointment.appointmentFor')} />
            {viewModel?.patientProfilesRequest?.isLoading ? (
              <View style={styles.inlineLoader}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : (viewModel?.patientProfiles?.length ?? 0) > 0 ? (
              <View style={styles.profileRow}>
                {viewModel?.patientProfiles?.map(renderPatientProfile)}
              </View>
            ) : (
              <CustomNoData
                showIcon={false}
                message={
                  viewModel?.patientProfilesRequest?.error ??
                  t('createAppointment.noPatientProfiles')
                }
                style={styles.inlineNoData}
              />
            )}
          </View>

          {/* Chamber */}
          <View
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <SectionLabel text={t('createAppointment.chamber')} />
            {(viewModel?.locations?.length ?? 0) > 0 ? (
              <View style={styles.chipRow}>
                {viewModel?.locations?.map(location => {
                  const selected =
                    viewModel?.selectedLocationId === location?.locationId;
                  return (
                    <CustomChip
                      key={location?.locationId}
                      compact
                      selected={selected}
                      showSelectedCheck={false}
                      onPress={() =>
                        viewModel?.selectLocation?.(location?.locationId)
                      }
                      textColor={
                        selected
                          ? theme.colors.onPrimary
                          : theme.colors.onSurface
                      }
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected
                            ? theme.colors.primary
                            : theme.colors.surface,
                          borderColor: selected
                            ? theme.colors.primary
                            : theme.colors.outlineVariant,
                        },
                      ]}
                    >
                      {location?.name || t('common.na')}
                    </CustomChip>
                  );
                })}
              </View>
            ) : (
              <CustomNoData
                showIcon={false}
                message={t('details.noChamber')}
                style={styles.inlineNoData}
              />
            )}
          </View>

          {/* Date + slots */}
          <View
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.labelRow}>
              <SectionLabel text={t('bookAppointment.appointmentDate')} />
              <Pressable
                onPress={
                  viewModel?.customDate
                    ? viewModel?.handleUseWeekdays
                    : viewModel?.handleStartCustomDate
                }
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text
                  style={[styles.linkAction, { color: theme.colors.primary }]}
                >
                  {viewModel?.customDate
                    ? t('createAppointment.useWeekdayPicker')
                    : t('createAppointment.pickCustomDate')}
                </Text>
              </Pressable>
            </View>

            {viewModel?.customDate ? (
              <CustomDatePicker
                label={t('bookAppointment.appointmentDate')}
                value={viewModel?.customDate}
                onChange={viewModel?.handlePickCustomDate}
                minimumDate={new Date()}
                formatString={formatShortDate}
                // The link above revealed this field; opening on mount saves the
                // user a second tap on the field they just asked for.
                autoOpen
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.dayScroll}
                contentContainerStyle={styles.dayRow}
              >
                {viewModel?.weekdays?.map((day, index) => {
                  const selected = index === viewModel?.selectedDayIndex;
                  // Greyed out like the web's "Sat": the chamber has no window
                  // published for that weekday.
                  const unavailable =
                    (viewModel?.slotsForDay?.(day)?.length ?? 0) === 0;
                  return (
                    <Pressable
                      key={day.toISOString()}
                      onPress={() => viewModel?.selectDayIndex?.(index)}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: unavailable }}
                      style={[
                        styles.dayPill,
                        {
                          backgroundColor: selected
                            ? theme.colors.primary
                            : theme.colors.surfaceVariant,
                          borderColor: selected
                            ? theme.colors.primary
                            : 'transparent',
                          opacity: unavailable && !selected ? 0.45 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayWeekday,
                          {
                            color: selected
                              ? theme.colors.onPrimary
                              : theme.colors.onSurface,
                          },
                        ]}
                      >
                        {t(`days.${day.getDay()}`)}
                      </Text>
                      <Text
                        style={[
                          styles.dayDate,
                          {
                            color: selected
                              ? theme.colors.onPrimary
                              : theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {`${t(`months.${day.getMonth()}`)} ${day.getDate()}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Text
              style={[
                styles.dateEcho,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {`${viewModel?.dateKey} · ${t(`days.${date.getDay()}`)}`}
            </Text>

            <SectionLabel
              text={t('doctorProfile.availableSlots', {
                day: t(`days.${date.getDay()}`),
                date: viewModel?.dateKey,
              })}
            />

            {(viewModel?.slots?.length ?? 0) > 0 ? (
              <View style={styles.slotGrid}>
                {viewModel?.slots?.map(renderSlot)}
              </View>
            ) : (
              <Text
                style={[
                  styles.noSlots,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t('booking.noSlots')}
              </Text>
            )}

            {selectedSlot ? (
              <View
                style={[
                  styles.selectedBar,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Text
                  numberOfLines={2}
                  style={[styles.selectedText, { color: theme.colors.primary }]}
                >
                  <Text style={styles.strong}>{`${t(
                    'createAppointment.selected',
                  )} `}</Text>
                  {`${selectedLocation?.name ?? ''} · ${
                    viewModel?.dateKey
                  } · ${to12Hour(selectedSlot?.startTime)}`}
                </Text>
                <Pressable
                  onPress={viewModel?.clearSlot}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.clearAction,
                      { color: theme.colors.primary },
                    ]}
                  >
                    {t('createAppointment.clear')}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {selectedLocation?.address ? (
              <View style={styles.practiceRow}>
                <Icon
                  name="map-marker-outline"
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.practiceText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {selectedLocation?.address}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Consultation options — fees come from the selected chamber. */}
          {(viewModel?.consultationOptions?.length ?? 0) > 0 ? (
            <View
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
            >
              <SectionLabel text={t('doctorProfile.consultationOptions')} />
              {viewModel?.consultationOptions?.map(option => {
                const selected = consultationType === option?.value;
                return (
                  <Pressable
                    key={option?.value}
                    onPress={() =>
                      viewModel?.setConsultationType?.(option?.value)
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[
                      styles.optionRow,
                      {
                        backgroundColor: selected
                          ? theme.colors.primaryContainer
                          : theme.colors.surfaceVariant,
                        borderColor: selected
                          ? theme.colors.primary
                          : 'transparent',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.optionIcon,
                        { backgroundColor: theme.colors.primary },
                      ]}
                    >
                      <Icon
                        name={option?.icon}
                        size={16}
                        color={theme.colors.onPrimary}
                      />
                    </View>
                    <View style={styles.optionInfo}>
                      <Text
                        style={[
                          styles.optionTitle,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        {t(option?.labelKey)}
                      </Text>
                      {option?.descKey ? (
                        <Text
                          style={[
                            styles.optionDesc,
                            { color: theme.colors.onSurfaceVariant },
                          ]}
                        >
                          {t(option?.descKey, option?.descOptions)}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.optionFee,
                        { color: theme.colors.primary },
                      ]}
                    >
                      {viewModel?.taka?.(option?.amount)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Chief complaint */}
          <View
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            <SectionLabel text={t('bookAppointment.chiefComplaint')} />
            <CustomInput
              label={t('bookAppointment.chiefComplaint')}
              value={chiefComplaint}
              onChangeText={viewModel?.setChiefComplaint}
              onFocus={handleComplaintFocus}
              onBlur={handleComplaintBlur}
              placeholder={t('bookAppointment.chiefComplaintPlaceholder')}
              multiline
              numberOfLines={4}
              inputStyle={styles.textarea}
            />
          </View>

          <CustomButton
            mode="contained"
            onPress={handleContinue}
            disabled={!viewModel?.isReady}
            style={styles.submitButton}
          >
            {t('doctorProfile.makeAppointment')}
          </CustomButton>

          {!viewModel?.isReady ? (
            <Text
              style={[
                styles.submitHint,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {/* Names the actual blocker: a missing profile reads nothing like a
                missing slot, and both disable the same button. */}
              {selectedProfile
                ? t('createAppointment.slotRequired')
                : t('createAppointment.patientRequired')}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  retry: {
    marginTop: 12,
    minWidth: 140,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  doctorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  doctorName: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  doctorSpecialty: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    marginTop: 2,
  },
  doctorQualification: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 1,
    lineHeight: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
  },
  sectionLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkAction: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    marginBottom: 10,
  },
  inlineLoader: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineNoData: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  profileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  profileInfo: {
    flexShrink: 1,
  },
  profileName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  profileRelation: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    marginTop: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    margin: 0,
    borderWidth: 1,
    borderRadius: 10,
  },
  dayScroll: {
    // Without this the strip stretches to fill the card's cross axis.
    flexGrow: 0,
  },
  dayRow: {
    gap: 8,
    paddingBottom: 4,
  },
  dayPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 66,
  },
  dayWeekday: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  dayDate: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    marginTop: 2,
  },
  dateEcho: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 8,
    marginBottom: 14,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slotCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  slotTime: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  slotLeft: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    marginTop: 3,
  },
  noSlots: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  selectedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  selectedText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  strong: {
    fontFamily: fontFamilies.bold,
  },
  clearAction: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  practiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
  },
  practiceText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  optionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  optionTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  optionDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    marginTop: 1,
  },
  optionFee: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
  },
  textarea: {
    minHeight: 88,
  },
  submitButton: {
    marginVertical: 0,
    borderRadius: 12,
  },
  submitHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default CreateAppointment;
