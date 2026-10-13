import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Menu, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FamilyMember, UploadFile, useStores } from '@app/core';
import { CustomDialog } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import PhotoPickerSheet from '../../../components/PhotoPickerSheet';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { ProfileStackParamList } from '../../../navigation/ProfileStackNavigator';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useProfileViewModel } from './useProfileViewModel';
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
  const { authStore, profileStore, toastStore } = useStores();
  const viewModel = useProfileViewModel();

  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const [menuVisible, setMenuVisible] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showConditionSheet, setShowConditionSheet] = useState(false);
  const [showAllergySheet, setShowAllergySheet] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<FamilyMember | null>(null);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);

  const months = Array.from({ length: 12 }, (_, index) => t(`months.${index}`));

  // Anything added or edited on a pushed screen shows up when we come back.
  // The store already carries a profile saved a moment ago; this re-read only
  // catches changes made elsewhere, and never blanks the screen while it runs.
  const reloadFamily = viewModel.reloadFamily;
  const refreshProfile = viewModel.refreshProfile;
  const invalidateMemberRecords = viewModel.invalidateMemberRecords;
  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      reloadFamily();
      // The view model already fetches on mount — skip that duplicate here.
      if (hasFocusedOnce.current) {
        refreshProfile();
        // A relative's records screen may have added or removed something, so
        // the counts on their card are re-read rather than trusted.
        invalidateMemberRecords();
      }
      hasFocusedOnce.current = true;
    }, [reloadFamily, refreshProfile, invalidateMemberRecords]),
  );

  const handleConfirmLogout = useCallback(() => {
    setShowLogoutDialog(false);
    authStore.logout();
    profileStore.clear();
  }, [authStore, profileStore]);

  const handleEdit = useCallback(() => navigation.navigate('ProfileEdit'), [navigation]);
  const handleAddMember = useCallback(
    () => navigation.navigate('AddFamilyMember'),
    [navigation],
  );
  const handleEditMember = useCallback(
    (member: FamilyMember) =>
      navigation.navigate('AddFamilyMember', { patientCode: member?.patientCode }),
    [navigation],
  );
  const handlePhoto = useCallback(() => setShowPhotoSheet(true), []);

  const handlePhotoPicked = useCallback(
    async (file: UploadFile) => {
      toastStore.show(t('photoPicker.uploading'), 'info');
      const uploaded = await viewModel.uploadPhoto(file);
      toastStore.show(
        uploaded ? t('photoPicker.uploaded') : t('photoPicker.uploadFailed'),
        uploaded ? 'success' : 'error',
      );
    },
    [viewModel, toastStore, t],
  );

  const handleConfirmRemoveMember = useCallback(async () => {
    const code = memberToRemove?.patientCode ?? '';
    setMemberToRemove(null);
    if (!code) return;

    const removed = await viewModel.removeFamilyMember(code);
    toastStore.show(
      removed ? t('patientProfile.memberRemoved') : t('patientProfile.loadFailed'),
      removed ? 'success' : 'error',
    );
  }, [memberToRemove, viewModel, toastStore, t]);

  /** Own records live in their own tabs; a relative's are shown on their card. */
  /**
   * The account holder's own records are two tabs away on this very screen; a
   * relative's live on their own screen, because adding and removing there has
   * to be scoped to their `patientCode`.
   */
  const handleOpenRecords = useCallback(
    (member: FamilyMember, section: 'medical' | 'allergies') => {
      if (member?.relationship === 'Myself') {
        viewModel.setTab(section);
        return;
      }

      const code = member?.patientCode ?? '';
      if (!code) return;

      navigation.navigate('MemberRecords', {
        patientCode: code,
        memberName: member?.fullName ?? '',
        section,
      });
    },
    [viewModel, navigation],
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
              title={t('patientProfile.loadFailed')}
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
        <ProfileHeaderCard profile={profile} onEditPress={handleEdit} onPhotoPress={handlePhoto} />
        <ProfileTabs value={viewModel.tab} onChange={viewModel.setTab} />

        <View style={styles.tabContent}>
          {viewModel.tab === 'personal' ? (
            <PersonalInfoTab profile={profile} months={months} onEdit={handleEdit} />
          ) : null}

          {viewModel.tab === 'medical' ? (
            <MedicalHistoryTab
              conditions={viewModel.conditions}
              isLoading={viewModel.isConditionsLoading}
              onAdd={() => setShowConditionSheet(true)}
              onRemove={viewModel.removeCondition}
            />
          ) : null}

          {viewModel.tab === 'allergies' ? (
            <AllergiesTab
              allergies={viewModel.allergies}
              isLoading={viewModel.isAllergiesLoading}
              onAdd={() => setShowAllergySheet(true)}
              onRemove={viewModel.removeAllergy}
            />
          ) : null}

          {viewModel.tab === 'family' ? (
            <FamilyProfilesTab
              members={viewModel.family}
              isLoading={viewModel.isFamilyLoading}
              selfConditionCount={viewModel.conditions?.length ?? 0}
              selfAllergyCount={viewModel.allergies?.length ?? 0}
              memberRecords={viewModel.memberRecords}
              onLoadRecords={viewModel.loadMemberRecords}
              onAddMember={handleAddMember}
              onEditMember={handleEditMember}
              onRemoveMember={setMemberToRemove}
              onOpenRecords={handleOpenRecords}
            />
          ) : null}
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
        visible={!!memberToRemove}
        title={t('patientProfile.removeMember')}
        message={t('patientProfile.removeMemberConfirm', {
          name: memberToRemove?.fullName ?? '',
        })}
        confirmText={t('patientProfile.removeMember')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmRemoveMember}
        onDismiss={() => setMemberToRemove(null)}
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
