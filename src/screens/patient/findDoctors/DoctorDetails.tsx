import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  DoctorConsultationOption,
  experienceLabel,
  getFileUrl,
  to12Hour,
} from '@app/core';
import {
  CustomAvatar,
  CustomButton,
  CustomChip,
  CustomNoData,
  fontFamilies,
} from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import {
  DoctorAboutSection,
  DoctorReviewsSection,
} from '../../../components/doctor/DoctorAboutSections';
import { DoctorFlowStackParamList } from '../../../navigation/appointmentRoutes';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useRequirePatientProfile } from '../../../hooks/useRequirePatientProfile';
import { useDoctorDetailsViewModel } from './useDoctorDetailsViewModel';

type DetailsTab = 'details' | 'about' | 'reviews';

const TAB_LABEL_KEY: Record<DetailsTab, string> = {
  details: 'details.title',
  about: 'doctorProfile.tabAbout',
  reviews: 'doctorProfile.tabReviews',
};

const TABS = Object.keys(TAB_LABEL_KEY) as DetailsTab[];

/** Icon + label per consultation option type sent by the API. */
const CONSULTATION_OPTION_META: Record<string, { icon: string; labelKey: string }> = {
  audio: { icon: 'phone-outline', labelKey: 'doctorProfile.audioConsultation' },
  video: { icon: 'video-outline', labelKey: 'doctorProfile.videoConsultation' },
};

/** One label/value pair in the bordered spec grid. */
const Field = memo<{ label: string; value: string }>(function Field({ label, value }) {
  const theme = useTheme();
  const border = { borderColor: theme.colors.outlineVariant };

  return (
    <View style={styles.field}>
      <View
        style={[
          styles.cell,
          styles.labelCell,
          border,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.labelText, { color: theme.colors.onSurfaceVariant }]}
        >
          {label}
        </Text>
      </View>
      <View style={[styles.cell, styles.valueCell, border]}>
        <Text numberOfLines={2} style={[styles.valueText, { color: theme.colors.onSurface }]}>
          {value}
        </Text>
      </View>
    </View>
  );
});

/** Renders rows of one or two label/value pairs as a collapsed-border grid. */
const FieldGrid = memo<{ rows: Array<Array<[string, string]>> }>(function FieldGrid({ rows }) {
  return (
    <View>
      {rows?.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.gridRow}>
          {row?.map(([label, value]) => (
            <Field key={label} label={label} value={value} />
          ))}
        </View>
      ))}
    </View>
  );
});

/**
 * Everything about one doctor — Details, About and Reviews — with Make
 * Appointment as the way out. Profile data comes from `GET /api/doctors/{id}`
 * and reviews from `GET /api/reviews/doctor/{id}`, both through
 * `useDoctorDetailsViewModel`; sections the API has no field for (contact
 * number) are left out rather than faked.
 */
export const DoctorDetails = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<DoctorFlowStackParamList>>();
  const route = useRoute<RouteProp<DoctorFlowStackParamList, 'DoctorDetails'>>();
  const insets = useSafeAreaInsets();
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  // Params are read defensively: a deep link can land here without them.
  const { doctorId = '' } = route.params ?? {};

  const viewModel = useDoctorDetailsViewModel(doctorId);
  const { ensureProfile, isChecking } = useRequirePatientProfile();
  const doctor = viewModel?.doctor;
  const location = viewModel?.selectedLocation;
  const taka = viewModel?.taka;

  const [tab, setTab] = useState<DetailsTab>('details');

  const photoUri = getFileUrl(doctor?.photoUrl);
  const locations = doctor?.locations ?? [];

  const infoRows = useMemo<Array<Array<[string, string]>>>(() => {
    if (!doctor) return [];

    const rows: Array<Array<[string, string]>> = [
      [[t('details.name'), doctor?.name || t('common.na')]],
      [
        [t('details.designation'), doctor?.designation || t('common.na')],
        [t('details.specialty'), doctor?.specialty || t('common.na')],
      ],
      [
        [t('details.department'), doctor?.department || t('common.na')],
        [
          t('details.experience'),
          doctor?.experienceYears
            ? experienceLabel(doctor?.experienceYears)
            : t('common.na'),
        ],
      ],
    ];

    const lastRow: Array<[string, string]> = [
      [
        t('details.availability'),
        doctor?.isAvailable ? t('details.available') : t('details.unavailable'),
      ],
    ];
    // Most doctors have no second specialization — only take the cell when set.
    if (doctor?.secondarySpecialty) {
      lastRow?.unshift([t('details.secondarySpecialty'), doctor?.secondarySpecialty]);
    }
    rows?.push(lastRow);

    // Mobile is intentionally not shown: the details API carries no contact number.
    // [[t('details.mobile'), doctor?.mobile]]

    return rows;
  }, [doctor, t]);

  const feeRows = useMemo<Array<Array<[string, string]>>>(() => {
    if (!location) return [];

    const fields: Array<[string, string]> = [
      [t('details.consultationFee'), taka?.(location?.consultationFee) ?? ''],
    ];

    // A visit the chamber has no fee for is not offered (see the booking
    // options), so its fee — and, for follow-ups, the validity — is left out.
    const hasFollowUp = (location?.followUpFee ?? null) !== null;
    if (hasFollowUp) {
      fields?.push([t('details.followUpFee'), taka?.(location?.followUpFee) ?? '']);
    }
    if ((location?.reportFee ?? null) !== null) {
      fields?.push([t('details.reportVisitFee'), taka?.(location?.reportFee) ?? '']);
    }
    if (hasFollowUp) {
      fields?.push([
        t('details.followUpValidity'),
        t('details.days', { value: location?.followUpValidDays ?? 0 }),
      ]);
    }

    // Two fields per row, the last one alone when the count is odd.
    const rows: Array<Array<[string, string]>> = [];
    for (let index = 0; index < fields.length; index += 2) {
      rows?.push(fields.slice(index, index + 2));
    }
    return rows;
  }, [location, t, taka]);

  const aboutInfo = useMemo(
    () => ({
      bio: viewModel?.aboutSummary,
      specializations: doctor?.specializations,
      // The API sends degrees as plain strings, not degree/institution pairs.
      education: doctor?.degrees,
      experienceHistory: doctor?.experienceHistory,
      awards: doctor?.awards,
    }),
    [doctor, viewModel?.aboutSummary],
  );

  const reviews = viewModel?.reviewsRequest?.data;
  const reviewsInfo = useMemo(
    () => ({
      averageRating: reviews?.averageRating,
      totalCount: reviews?.totalCount,
      ratingBreakdown: reviews?.ratingBreakdown,
      reviews: reviews?.reviews,
    }),
    [reviews],
  );

  // Booking is always *for* a patient profile, and a freshly registered account
  // has none — the gate sends them to create one rather than into a booking
  // screen they could not finish.
  const handleMakeAppointment = useCallback(async () => {
    if (!doctor?.id) return;
    if (!(await ensureProfile())) return;
    navigation.navigate('CreateAppointment', { doctorId: doctor?.id });
  }, [navigation, doctor?.id, ensureProfile]);

  const renderConsultationOption = useCallback(
    (option: DoctorConsultationOption) => {
      const meta = CONSULTATION_OPTION_META[option?.type ?? ''];

      return (
        <View
          key={option?.optionId || option?.type}
          style={[styles.optionCard, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.optionHeader}>
            <Icon
              name={meta?.icon ?? 'stethoscope'}
              size={16}
              color={theme.colors.primary}
            />
            <Text style={[styles.optionTitle, { color: theme.colors.onSurface }]}>
              {meta?.labelKey ? t(meta?.labelKey) : t('doctorProfile.consultation')}
            </Text>
          </View>
          <Text style={[styles.optionFee, { color: theme.colors.primary }]}>
            {taka?.(option?.fee)}
          </Text>
          {option?.durationMinutes ? (
            <Text style={[styles.optionMeta, { color: theme.colors.onSurfaceVariant }]}>
              {t('doctorProfile.durationMinutes', { value: option?.durationMinutes })}
            </Text>
          ) : null}
        </View>
      );
    },
    [t, taka, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.primary, theme.colors.surface],
  );

  if (viewModel?.doctorDetailsRequest?.isLoading) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ScreenHeader title={t('details.title')} leading="back" />
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
        <ScreenHeader title={t('details.title')} leading="back" />
        <View style={styles.stateWrap}>
          <CustomNoData
            message={viewModel?.doctorDetailsRequest?.error ?? t('common.noDataFound')}
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
      <ScreenHeader title={t('details.title')} leading="back" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
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
              <Text style={[styles.doctorSpecialty, { color: theme.colors.primary }]}>
                {doctor?.specialty || doctor?.designation || t('common.na')}
              </Text>
              {doctor?.qualification ? (
                <Text
                  numberOfLines={3}
                  style={[styles.doctorQualification, { color: theme.colors.onSurfaceVariant }]}
                >
                  {doctor?.qualification}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Icon name="briefcase-outline" size={13} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                {t('doctorProfile.years', { value: doctor?.experienceYears ?? 0 })}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="map-marker-outline" size={13} color="#1B9C5D" />
              <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                {t('doctorProfile.sites', { value: viewModel?.siteCount ?? 0 })}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="credit-card-outline" size={13} color={theme.colors.primary} />
              <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                {viewModel?.feeRangeLabel}
              </Text>
            </View>
          </View>

          {doctor?.hospital ? (
            <View
              style={[styles.practiceRow, { borderTopColor: theme.colors.outlineVariant }]}
            >
              <Icon name="hospital-building" size={18} color={theme.colors.primary} />
              <View style={styles.practiceInfo}>
                <Text style={[styles.practiceLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {t('details.currentlyPracticingAt')}
                </Text>
                <Text style={[styles.practiceValue, { color: theme.colors.onSurface }]}>
                  {doctor?.hospital}
                </Text>
                {doctor?.department ? (
                  <Text style={[styles.practiceMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {doctor?.department}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        <View style={[styles.tabsRow, { backgroundColor: theme.colors.surfaceVariant }]}>
          {TABS?.map(tabKey => {
            const selected = tab === tabKey;
            return (
              <Pressable
                key={tabKey}
                onPress={() => setTab(tabKey)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[styles.tabItem, selected && { backgroundColor: theme.colors.primary }]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabItemText,
                    { color: selected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant },
                  ]}
                >
                  {t(TAB_LABEL_KEY[tabKey])}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'details' ? (
          <>
            <Text style={[styles.section, styles.firstSection, { color: theme.colors.onSurface }]}>
              {t('details.doctorInformation')}
            </Text>
            <FieldGrid rows={infoRows} />

            <Text style={[styles.section, { color: theme.colors.onSurface }]}>
              {t('details.chambers')}
            </Text>
            {locations?.length ? (
              <>
                {/* Fees and schedule below always belong to the selected chamber. */}
                {locations?.length > 1 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {locations?.map(item => {
                      const selected = item?.locationId === viewModel?.selectedLocationId;
                      return (
                        <CustomChip
                          key={item?.locationId}
                          selected={selected}
                          compact
                          showSelectedCheck={false}
                          onPress={() => viewModel?.selectLocation?.(item?.locationId ?? '')}
                          textColor={selected ? theme.colors.onPrimary : theme.colors.onSurface}
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
                          textStyle={styles.chipText}
                        >
                          {item?.name || t('common.na')}
                        </CustomChip>
                      );
                    })}
                  </ScrollView>
                ) : null}

                <View style={[styles.addressRow, { backgroundColor: theme.colors.surface }]}>
                  <Icon name="map-marker-outline" size={16} color={theme.colors.primary} />
                  <View style={styles.addressInfo}>
                    <Text style={[styles.addressName, { color: theme.colors.onSurface }]}>
                      {location?.name || t('common.na')}
                    </Text>
                    {location?.address ? (
                      <Text
                        style={[styles.addressText, { color: theme.colors.onSurfaceVariant }]}
                      >
                        {location?.address}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <Text style={[styles.section, { color: theme.colors.onSurface }]}>
                  {t('details.consultationFees')}
                </Text>
                <FieldGrid rows={feeRows} />

                <Text style={[styles.section, { color: theme.colors.onSurface }]}>
                  {t('details.availableSchedule')}
                </Text>
                {viewModel?.scheduleRows?.length ? (
                  viewModel?.scheduleRows?.map(row => (
                    <View
                      key={row?.key}
                      style={[styles.slot, { backgroundColor: theme.colors.primaryContainer }]}
                    >
                      <View style={[styles.dayPill, { backgroundColor: theme.colors.primary }]}>
                        <Text style={[styles.dayText, { color: theme.colors.onPrimary }]}>
                          {(row?.dayIndex ?? -1) >= 0 ? t(`days.${row?.dayIndex}`) : row?.dayOfWeek}
                        </Text>
                      </View>
                      <View style={styles.slotInfo}>
                        <Text style={[styles.slotTime, { color: theme.colors.primary }]}>
                          {`${to12Hour(row?.startTime ?? '')} – ${to12Hour(row?.endTime ?? '')}`}
                        </Text>
                        <Text style={[styles.slotMeta, { color: theme.colors.onSurfaceVariant }]}>
                          {t('doctorProfile.slotsLeft', {
                            count: row?.availableCount ?? 0,
                            total: row?.maxCapacity ?? 0,
                          })}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.emptySchedule, { color: theme.colors.onSurfaceVariant }]}>
                    {t('details.noSchedule')}
                  </Text>
                )}
              </>
            ) : (
              <CustomNoData message={t('details.noChamber')} />
            )}

            {viewModel?.enabledConsultationOptions?.length ? (
              <>
                <Text style={[styles.section, { color: theme.colors.onSurface }]}>
                  {t('doctorProfile.consultationOptions')}
                </Text>
                <View style={styles.optionRow}>
                  {viewModel?.enabledConsultationOptions?.map(renderConsultationOption)}
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {tab === 'about' ? <DoctorAboutSection doctor={aboutInfo} /> : null}
        {tab === 'reviews' ? (
          <DoctorReviewsSection
            doctor={reviewsInfo}
            isLoading={viewModel?.reviewsRequest?.isLoading}
          />
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          // The pinned CTA has to clear the floating tab bar, same as scroll content.
          { backgroundColor: theme.colors.background, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
      >
        <CustomButton
          mode="contained"
          onPress={handleMakeAppointment}
          // Only spins on the slow path: a profile already in the store answers
          // the gate without a request.
          loading={isChecking}
          disabled={isChecking}
          style={styles.cta}
        >
          {t('doctorProfile.makeAppointment')}
        </CustomButton>
      </View>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retry: {
    marginTop: 4,
    borderRadius: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
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
  practiceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  practiceInfo: {
    flex: 1,
  },
  practiceLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  practiceValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    marginTop: 2,
  },
  practiceMeta: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabItemText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  section: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    marginTop: 18,
    marginBottom: 10,
  },
  firstSection: {
    marginTop: 16,
  },
  chipRow: {
    paddingBottom: 6,
  },
  chip: {
    marginRight: 8,
    marginVertical: 0,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  addressText: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  gridRow: {
    flexDirection: 'row',
  },
  field: {
    flex: 1,
    flexDirection: 'row',
  },
  cell: {
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    // Collapse adjacent hairlines so the grid reads as one table, not stacked boxes.
    marginRight: -1,
    marginBottom: -1,
  },
  labelCell: {
    width: 92,
  },
  valueCell: {
    flex: 1,
  },
  labelText: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  valueText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 10,
  },
  dayPill: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 12,
    minWidth: 52,
    alignItems: 'center',
  },
  dayText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  slotInfo: {
    flex: 1,
  },
  slotTime: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
  },
  slotMeta: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 2,
  },
  emptySchedule: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionCard: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: 12,
    padding: 12,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionTitle: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  optionFee: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    marginTop: 8,
  },
  optionMeta: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cta: {
    marginVertical: 0,
    borderRadius: 12,
  },
});

export default DoctorDetails;
