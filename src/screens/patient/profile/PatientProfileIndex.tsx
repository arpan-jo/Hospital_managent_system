import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Menu, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { UploadFile, useStores } from '@app/core';
import { CustomDialog } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import PhotoPickerSheet from '../../../components/PhotoPickerSheet';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { ProfileStackParamList } from '../../../navigation/ProfileStackNavigator';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useProfileViewModel } from './useProfileViewModel';
import { useFamilyProfilesViewModel } from './useFamilyProfilesViewModel';
import { EmptyState } from './ProfileComponents';
import ProfileHeaderCard from './ProfileHeaderCard';
import ProfileTabs from './ProfileTabs';
import PersonalInfoTab from './tabs/PersonalInfoTab';
import MedicalHistoryTab from './tabs/MedicalHistoryTab';
import AllergiesTab from './tabs/AllergiesTab';
import FamilyProfilesTab from './tabs/FamilyProfilesTab';
import AddConditionSheet from '../../common/profileSheets/AddConditionSheet';
import AddAllergySheet from '../../common/profileSheets/AddAllergySheet';

export const PatientProfileIndex = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const insets = useSafeAreaInsets();
  const { authStore, profileStore } = useStores();
  const viewModel = useProfileViewModel();

  // The holder's card on the Family tab shares their records and photo.
  const { reloadConditions, reloadAllergies } = viewModel;
  const onOwnRecordsChanged = useCallback(() => {
    reloadConditions();
    reloadAllergies();
  }, [reloadConditions, reloadAllergies]);
  const familyViewModel = useFamilyProfilesViewModel({
    onOwnRecordsChanged,
    onOwnProfileChanged: viewModel.refreshProfile,
  });

  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const [menuVisible, setMenuVisible] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showConditionSheet, setShowConditionSheet] = useState(false);
  const [showAllergySheet, setShowAllergySheet] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);

  const months = Array.from({ length: 12 }, (_, index) => t(`months.${index}`));

  // A profile changed elsewhere — on the web, say — shows when we come back.
  // The store already carries one saved here a moment ago, and this re-read
  // never blanks the screen while it runs.
  const refreshProfile = viewModel.refreshProfile;
  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      // The view model already fetches on mount — skip that duplicate here.
      if (hasFocusedOnce.current) refreshProfile();
      hasFocusedOnce.current = true;
    }, [refreshProfile]),
  );

  const handleConfirmLogout = useCallback(() => {
    setShowLogoutDialog(false);
    authStore.logout();
    profileStore.clear();
  }, [authStore, profileStore]);

  const handleEdit = useCallback(() => navigation.navigate('ProfileEdit'), [navigation]);
  const handlePhoto = useCallback(() => setShowPhotoSheet(true), []);

  // The view model reports how it went.
  const uploadPhoto = viewModel.uploadPhoto;
  const handlePhotoPicked = useCallback(
    (file: UploadFile) => {
      uploadPhoto(file);
    },
    [uploadPhoto],
  );

  const profile = viewModel.profile;

  // A freshly registered patient has no profile row yet — the edit screen
  // doubles as the create form and POSTs the first save. Only a 404 says so:
  // after any other failure the create form would add a second profile.
  if (!profile) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ScreenHeader title={t('patientProfile.title')} leading="menu" />
        {viewModel.isProfileLoading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : viewModel.hasNoProfile ? (
          <View style={styles.stateWrap}>
            <EmptyState
              icon="account-plus-outline"
              title={t('patientProfile.noProfileTitle')}
              description={t('patientProfile.noProfileDesc')}
              actionLabel={t('patientProfile.createProfile')}
              onAction={handleEdit}
            />
          </View>
        ) : (
          <View style={styles.stateWrap}>
            <EmptyState
              icon="account-alert-outline"
              title={viewModel.loadError || t('patientProfile.loadFailed')}
              actionLabel={t('common.retry')}
              onAction={refreshProfile}
            />
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={t('patientProfile.title')}
        leading="menu"
        right={
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Pressable onPress={() => setMenuVisible(true)} hitSlop={8} style={styles.menuButton}>
                <Icon name="dots-vertical" size={22} color={theme.colors.onSurface} />
              </Pressable>
            }
          >
            <Menu.Item
              leadingIcon="account-edit-outline"
              title={t('patientProfile.editProfile')}
              onPress={() => {
                setMenuVisible(false);
                handleEdit();
              }}
            />
            <Menu.Item
              leadingIcon="logout"
              title={t('profile.logoutButton')}
              onPress={() => {
                setMenuVisible(false);
                setShowLogoutDialog(true);
              }}
            />
          </Menu>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
      >
        <ProfileHeaderCard
          profile={profile}
          onEditPress={handleEdit}
          onPhotoPress={handlePhoto}
          isPhotoUploading={viewModel.isUploadingPhoto}
        />
        <ProfileTabs value={viewModel.tab} onChange={viewModel.setTab} />

        <View style={styles.tabContent}>
          {viewModel.tab === 'personal' ? (
            <PersonalInfoTab profile={profile} months={months} onEdit={handleEdit} />
          ) : null}

          {viewModel.tab === 'medical' ? (
            <MedicalHistoryTab
              conditions={viewModel.conditions}
              isLoading={viewModel.isConditionsLoading}
              error={viewModel.conditionsError}
              onRetry={viewModel.reloadConditions}
              onAdd={() => setShowConditionSheet(true)}
              onRemove={viewModel.removeCondition}
            />
          ) : null}

          {viewModel.tab === 'allergies' ? (
            <AllergiesTab
              allergies={viewModel.allergies}
              isLoading={viewModel.isAllergiesLoading}
              error={viewModel.allergiesError}
              onRetry={viewModel.reloadAllergies}
              onAdd={() => setShowAllergySheet(true)}
              onRemove={viewModel.removeAllergy}
            />
          ) : null}

          {viewModel.tab === 'family' ? <FamilyProfilesTab viewModel={familyViewModel} /> : null}

        </View>
      </ScrollView>

      <PhotoPickerSheet
        visible={showPhotoSheet}
        onClose={() => setShowPhotoSheet(false)}
        onPicked={handlePhotoPicked}
      />

      <AddConditionSheet
        visible={showConditionSheet}
        onClose={() => setShowConditionSheet(false)}
        onAdd={viewModel.addCondition}
      />
      <AddAllergySheet
        visible={showAllergySheet}
        onClose={() => setShowAllergySheet(false)}
        onAdd={viewModel.addAllergy}
      />

      <CustomDialog
        visible={showLogoutDialog}
        title={t('profile.logoutButton')}
        message={t('profile.logoutConfirm')}
        confirmText={t('profile.logoutButton')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmLogout}
        onDismiss={() => setShowLogoutDialog(false)}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  tabContent: {
    marginTop: 2,
  },
});

export default PatientProfileIndex;
