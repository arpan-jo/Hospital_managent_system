import React, { memo, useCallback, useMemo } from 'react';
import {
  FlatList,
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
import { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getFileUrl, DoctorSummary, TopDoctor, useStores } from '@app/core';
import {
  CustomAvatar,
  CustomButton,
  CustomChip,
  CustomNoData,
  CustomSearchbar,
  fontFamilies,
} from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { StarRow } from '../../../components/doctor/DoctorAboutSections';
import { DrawerParamList } from '../../../navigation/DrawerNavigator';
import { FindDoctorsStackParamList } from '../../../navigation/FindDoctorsStackNavigator';
import {
  ALL_SPECIALTIES,
  useFindDoctorsViewModel,
} from './useFindDoctorsViewModel';
import DoctorListItem from './DoctorListItem';
import FilterBottomSheet from './FilterBottomSheet';
import { AiDoctorFinder } from './aiFinder/AiDoctorFinder';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useRequirePatientProfile } from '../../../hooks/useRequirePatientProfile';

const TopRatedCard = memo<{
  doctor: TopDoctor;
  onPress: (doctor: TopDoctor) => void;
  onBook: (doctor: TopDoctor) => void;
}>(function TopRatedCard({ doctor, onPress, onBook }) {
  const theme = useTheme();
  const { t } = useTranslation();

  const photoUri = getFileUrl(doctor?.photoUrl);

  return (
    <Pressable
      onPress={() => onPress(doctor)}
      style={[styles.topRatedCard, { backgroundColor: theme.colors.surface }]}
    >
      <CustomAvatar
        type={photoUri ? 'image' : 'text'}
        value={photoUri || doctor?.name || '?'}
        fallback={doctor?.name}
        size={48}
      />
      <Text
        numberOfLines={1}
        style={[styles.topRatedName, { color: theme.colors.onSurface }]}
      >
        {doctor?.name || t('common.na')}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          styles.topRatedSpecialty,
          { color: theme.colors.onSurfaceVariant },
        ]}
      >
        {doctor?.specialty || doctor?.designation || t('common.na')}
      </Text>
      <View style={styles.topRatedMetaBox}>
        {(doctor?.reviewCount ?? 0) > 0 ? (
          <View style={styles.topRatedRatingCol}>
            <StarRow rating={doctor?.averageRating ?? 0} size={10} />
            <Text
              numberOfLines={1}
              style={[
                styles.topRatedRatingText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {t('findDoctors.ratingCount', {
                rating: (doctor?.averageRating ?? 0).toFixed(1),
                count: doctor?.reviewCount ?? 0,
              })}
            </Text>
          </View>
        ) : (
          <View style={styles.topRatedRatingRow}>
            <Icon
              name="check-decagram"
              size={11}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.topRatedRatingText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {t('findDoctors.consults', {
                count: doctor?.completedAppointments ?? 0,
              })}
            </Text>
          </View>
        )}
      </View>
      <CustomButton
        mode="contained"
        onPress={() => onBook(doctor)}
        style={styles.topRatedBook}
        labelStyle={styles.topRatedBookLabel}
      >
        {t('findDoctors.book')}
      </CustomButton>
    </Pressable>
  );
});

export const PatientFindDoctorIndex = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<FindDoctorsStackParamList>>();
  const route =
    useRoute<RouteProp<FindDoctorsStackParamList, 'PatientFindDoctorIndex'>>();
  const { authStore } = useStores();
  const viewModel = useFindDoctorsViewModel(route.params?.specialty);
  const { ensureProfile } = useRequirePatientProfile();

  const insets = useSafeAreaInsets();

  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');
  const userName = authStore.user?.fullName || 'N/A';

  const handleProfile = useCallback(
    () =>
      navigation
        .getParent<DrawerNavigationProp<DrawerParamList>>()
        ?.navigate('MainTabs', { screen: 'ProfileTab' }),
    [navigation],
  );

  const openDetails = useCallback(
    (doctor: DoctorSummary | TopDoctor) =>
      navigation.navigate('DoctorDetails', { doctorId: doctor?.id ?? '' }),
    [navigation],
  );

  // Serves both Book (Top Rated) and Book Appointment (the result list). Booking
  // is always *for* a patient profile, and a freshly registered account has
  // none, so the gate sends them to create one before the booking screen.
  const openBooking = useCallback(
    async (doctor: DoctorSummary | TopDoctor) => {
      if (!(await ensureProfile())) return;
      navigation.navigate('CreateAppointment', { doctorId: doctor?.id ?? '' });
    },
    [navigation, ensureProfile],
  );

  const topRatedKeyExtractor = useCallback((item: TopDoctor) => item?.id, []);
  const renderTopRated = useCallback(
    ({ item }: { item: TopDoctor }) => (
      <TopRatedCard doctor={item} onPress={openDetails} onBook={openBooking} />
    ),
    [openDetails, openBooking],
  );

  const hasActiveFilters = (viewModel.activeFilterCount ?? 0) > 0;
  // Broader than the filter-badge count: a specialty pill or a search term
  // narrows the list too, so Top Rated (an unfiltered "editor's pick" carousel)
  // hides for all of them, same as the web app.
  const isBrowsingUnfiltered =
    !hasActiveFilters &&
    !viewModel.appliedFilters?.specialty &&
    !viewModel.searchQuery?.trim();

  const resultsLabel = useMemo(
    () =>
      t('findDoctors.resultsCount', {
        count: viewModel.doctorListRequest?.data?.length ?? 0,
      }),
    [t, viewModel.doctorListRequest?.data?.length],
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={t('findDoctors.title')}
        leading="menu"
        right={
          <Pressable
            onPress={handleProfile}
            accessibilityRole="button"
            accessibilityLabel={t('profile.title')}
          >
            <CustomAvatar type="text" value={userName} size={36} />
          </Pressable>
        }
      />

      <View style={styles.searchRow}>
        <CustomSearchbar
          value={viewModel.searchQuery}
          onChangeText={viewModel.setSearchQuery}
          placeholder={t('findDoctors.searchPlaceholder')}
          style={styles.searchbar}
        />
        <Pressable
          onPress={viewModel.openFilter}
          style={[
            styles.filterButton,
            {
              backgroundColor: hasActiveFilters
                ? theme.colors.primary
                : theme.colors.surface,
              borderColor: theme.colors.primary,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('findDoctors.filterTitle')}
        >
          <Icon
            name="tune-variant"
            size={18}
            color={
              hasActiveFilters ? theme.colors.onPrimary : theme.colors.primary
            }
          />
          {viewModel.activeFilterCount > 0 ? (
            <View
              style={[
                styles.filterBadge,
                {
                  backgroundColor: theme.colors.error,
                  borderColor: theme.colors.background,
                },
              ]}
            >
              <Text style={styles.filterBadgeText}>
                {viewModel.activeFilterCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        <AiDoctorFinder onOpenDoctor={openDetails} onBookDoctor={openBooking} />

        {viewModel.filterOptionsRequest?.isLoading ? (
          <View style={styles.chipLoader}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            {(viewModel.filterOptionsRequest?.data?.specialties?.length ??
              0) === 0 ? (
              <CustomNoData showIcon={false} style={styles.noChips} />
            ) : (
              viewModel.filterOptionsRequest?.data?.specialties?.map(
                specialty => {
                  const selected =
                    (viewModel.appliedFilters?.specialty || ALL_SPECIALTIES) ===
                    specialty;
                  return (
                    <CustomChip
                      key={specialty}
                      selected={selected}
                      onPress={() =>
                        viewModel?.setSpecialtyFilter?.(
                          specialty === ALL_SPECIALTIES ? '' : specialty,
                        )
                      }
                      compact
                      showSelectedCheck={false}
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
                      textStyle={styles.chipText}
                    >
                      {specialty?.trim() || specialty}
                    </CustomChip>
                  );
                },
              )
            )}
          </ScrollView>
        )}

        {isBrowsingUnfiltered &&
        (viewModel.topDoctorsRequest?.isLoading ||
          (viewModel.topDoctorsRequest?.data?.length ?? 0) > 0) ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
              >
                {t('findDoctors.topRatedDoctors')}
              </Text>
            </View>
            {viewModel.topDoctorsRequest?.isLoading ? (
              <View style={styles.topRatedLoader}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={viewModel.topDoctorsRequest?.data}
                keyExtractor={topRatedKeyExtractor}
                renderItem={renderTopRated}
                contentContainerStyle={styles.topRatedList}
              />
            )}
          </>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
          >
            {t('findDoctors.title')}
          </Text>
          <Text style={[styles.resultsCount, { color: theme.colors.primary }]}>
            {resultsLabel}
          </Text>
        </View>

        {viewModel.doctorListRequest?.isLoading ? (
          <View style={styles.listLoader}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : (viewModel.doctorListRequest?.data?.length ?? 0) > 0 ? (
          viewModel.doctorListRequest?.data?.map(doctor => (
            <DoctorListItem
              key={doctor?.id}
              doctor={doctor}
              onPress={openDetails}
              onBook={openBooking}
            />
          ))
        ) : (
          <CustomNoData
            message={
              viewModel.doctorListRequest?.error ?? t('findDoctors.noResults')
            }
            style={styles.noResults}
          />
        )}
      </ScrollView>

      <FilterBottomSheet
        visible={viewModel.isFilterSheetVisible}
        onClose={viewModel.closeFilter}
        filters={viewModel.appliedFilters}
        specialties={viewModel.filterOptionsRequest?.data?.specialties ?? []}
        locations={viewModel.filterOptionsRequest?.data?.locations ?? []}
        onApply={viewModel.applyFilters}
        onReset={viewModel.resetFilters}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  searchbar: {
    flex: 1,
    marginVertical: 0,
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.semibold,
    fontSize: 9,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  chipScroll: {
    flexGrow: 0,
    marginBottom: 18,
  },
  chipLoader: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    margin: 0,
    borderWidth: 1,
    borderRadius: 999,
  },
  chipText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    marginVertical: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  resultsCount: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  topRatedList: {
    gap: 10,
    paddingBottom: 20,
  },
  topRatedCard: {
    width: 116,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  topRatedName: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  topRatedSpecialty: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  topRatedMetaBox: {
    height: 30,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRatedRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  topRatedRatingCol: {
    alignItems: 'center',
    gap: 2,
  },
  topRatedRatingText: {
    fontFamily: fontFamilies.medium,
    fontSize: 10,
  },
  topRatedBook: {
    marginVertical: 0,
    marginTop: 8,
    paddingVertical: 0,
    borderRadius: 8,
    width: '100%',
  },
  topRatedBookLabel: {
    fontSize: 11,
    marginVertical: 6,
  },
  topRatedLoader: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listLoader: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noChips: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  noResults: {
    marginTop: 24,
  },
});

export default PatientFindDoctorIndex;
