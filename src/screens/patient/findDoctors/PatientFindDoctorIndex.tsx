import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getFileUrl, PortalDoctor, useStores } from '@app/core';
import {
  CustomAvatar,
  CustomButton,
  CustomChip,
  CustomNoData,
  CustomSearchbar,
  fontFamilies,
} from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { DrawerParamList } from '../../../navigation/DrawerNavigator';
import { FindDoctorsStackParamList } from '../../../navigation/FindDoctorsStackNavigator';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { useFindDoctorsViewModel } from './useFindDoctorsViewModel';
import DoctorListItem from './DoctorListItem';
import TopRatedDoctors from './TopRatedDoctors';
import FilterBottomSheet from './FilterBottomSheet';
import { AiDoctorFinder } from './aiFinder/AiDoctorFinder';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useRequirePatientProfile } from '../../../hooks/useRequirePatientProfile';

export const PatientFindDoctorIndex = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<FindDoctorsStackParamList>>();
  const { authStore, profileStore } = useStores();
  const viewModel = useFindDoctorsViewModel();
  const { ensureProfile } = useRequirePatientProfile();

  const insets = useSafeAreaInsets();

  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');
  const userName = authStore.user?.fullName || t('common.na');
  const photoUrl = getFileUrl(profileStore?.patientProfileData?.photoUrl ?? '');

  const handleProfile = useCallback(
    () =>
      navigation
        .getParent<DrawerNavigationProp<DrawerParamList>>()
        ?.navigate('MainTabs', { screen: 'ProfileTab' }),
    [navigation],
  );

  // A doctor's page is where the visit is booked, and a booking is always for a
  // complete patient profile — so, as on the portal, the page opens only once
  // the profile is complete; otherwise the patient is sent to finish it.
  const openDoctor = useCallback(
    async (doctor: PortalDoctor) => {
      if (!doctor?.employeeId) return;
      if (!(await ensureProfile(doctor.employeeId))) return;
      navigation.navigate('DoctorDetails', { employeeId: doctor.employeeId });
    },
    [navigation, ensureProfile],
  );

  const hasSheetFilters = (viewModel.sheetFilterCount ?? 0) > 0;
  const selectedDepartment = viewModel.filters?.department ?? '';
  const doctorCount = viewModel.doctors?.length ?? 0;

  const renderDepartmentChip = (label: string, value: string) => {
    const selected = selectedDepartment === value;

    return (
      <CustomChip
        key={value || 'all'}
        selected={selected}
        onPress={() => viewModel?.setDepartment?.(value)}
        compact
        showSelectedCheck={false}
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
        {label}
      </CustomChip>
    );
  };

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
            <View style={[styles.headerAvatar, { borderColor: theme.colors.primaryContainer }]}>
              <CustomAvatar type="image" value={photoUrl} fallback={userName} size={36} />
            </View>
          </Pressable>
        }
      />

      {/* One pill: the search, then the filter behind a hairline. */}
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchShell,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <CustomSearchbar
            value={viewModel.searchQuery}
            onChangeText={viewModel.setSearchQuery}
            placeholder={t('findDoctors.searchPlaceholder')}
            iconColor={theme.colors.primary}
            style={styles.searchbar}
          />
          <View
            style={[
              styles.searchDivider,
              { backgroundColor: theme.colors.outlineVariant },
            ]}
          />
          <Pressable
            onPress={viewModel.openFilter}
            style={[
              styles.filterButton,
              {
                backgroundColor: hasSheetFilters
                  ? theme.colors.primary
                  : theme.colors.primaryContainer,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('findDoctors.filterTitle')}
          >
            <Icon
              name="tune-variant"
              size={20}
              color={
                hasSheetFilters
                  ? theme.colors.onPrimary
                  : theme.colors.onPrimaryContainer
              }
            />
            {hasSheetFilters ? (
              <View
                style={[
                  styles.filterBadge,
                  {
                    backgroundColor: theme.colors.error,
                    borderColor: theme.colors.surface,
                  },
                ]}
              >
                <Text style={styles.filterBadgeText}>
                  {viewModel.sheetFilterCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
      >
        <AiDoctorFinder onOpenDoctor={openDoctor} />

        {viewModel.isFilterOptionsLoading ? (
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
            {renderDepartmentChip(t('findDoctors.all'), '')}
            {viewModel.departments?.map(department =>
              renderDepartmentChip(department?.trim() || department, department),
            )}
          </ScrollView>
        )}

        {viewModel.showTopRated ? (
          <View style={styles.topRated}>
            <TopRatedDoctors doctors={viewModel.topRated} onOpen={openDoctor} />
          </View>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Icon name="doctor" size={20} color={theme.colors.primary} />
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
          >
            {t('findDoctors.allDoctors')}
          </Text>
          <View
            style={[
              styles.countPill,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Text
              style={[
                styles.resultsCount,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              {viewModel.totalCount ?? 0}
            </Text>
          </View>
          <View style={styles.flexSpacer} />
          {/* A new search on its way, with the last results still listed. */}
          {viewModel.isFetching && !viewModel.isLoading ? (
            <ActivityIndicator size={14} color={theme.colors.primary} />
          ) : null}
        </View>

        {viewModel.isLoading ? (
          <View style={styles.listLoader}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : doctorCount > 0 ? (
          <>
            {viewModel.doctors?.map(doctor => (
              <DoctorListItem
                key={doctor?.employeeId}
                doctor={doctor}
                onOpen={openDoctor}
              />
            ))}
            {viewModel.hasMore ? (
              <CustomButton
                mode="outlined"
                onPress={viewModel.loadMore}
                loading={viewModel.isLoadingMore}
                style={[styles.loadMore, { borderColor: theme.colors.primary }]}
              >
                {t('findDoctors.loadMore')}
              </CustomButton>
            ) : null}
          </>
        ) : (
          <View style={styles.noResults}>
            <CustomNoData
              message={
                viewModel.error === null
                  ? t('findDoctors.noResults')
                  : viewModel.error || t('common.somethingWentWrong')
              }
            />
            {viewModel.error !== null ? (
              <CustomButton
                mode="outlined"
                onPress={viewModel.retry}
                style={[styles.emptyAction, { borderColor: theme.colors.primary }]}
              >
                {t('common.retry')}
              </CustomButton>
            ) : (
              <>
                <Text style={[styles.emptyHint, { color: theme.colors.onSurfaceVariant }]}>
                  {t('findDoctors.noResultsHint')}
                </Text>
                {viewModel.hasActiveFilters ? (
                  <Pressable onPress={viewModel.resetFilters} hitSlop={8}>
                    <Text style={[styles.clearLink, { color: theme.colors.primary }]}>
                      {t('findDoctors.clearFilters')}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <FilterBottomSheet
        visible={viewModel.isFilterSheetVisible}
        onClose={viewModel.closeFilter}
        filters={viewModel.filters}
        departments={viewModel.departments}
        genders={viewModel.genderOptions}
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
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingRight: 7,
    boxShadow: '0px 4px 14px rgba(21, 30, 79, 0.07)',
  },
  headerAvatar: {
    borderWidth: 2,
    borderRadius: 22,
    padding: 2,
  },
  searchbar: {
    flex: 1,
    marginVertical: 0,
    backgroundColor: 'transparent',
    borderRadius: 18,
  },
  searchDivider: {
    width: 1,
    height: 26,
    marginRight: 7,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
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
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  countPill: {
    minWidth: 24,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  resultsCount: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  flexSpacer: {
    flex: 1,
  },
  topRated: {
    marginBottom: 20,
  },
  loadMore: {
    marginTop: 4,
    borderRadius: 12,
  },
  listLoader: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResults: {
    marginTop: 24,
    alignItems: 'center',
  },
  emptyHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  clearLink: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    marginTop: 12,
  },
  emptyAction: {
    marginTop: 12,
    borderRadius: 12,
  },
});

export default PatientFindDoctorIndex;
