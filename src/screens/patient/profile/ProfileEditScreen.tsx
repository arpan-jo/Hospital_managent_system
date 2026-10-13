import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BLOOD_TYPE_OPTIONS,
  GENDER_OPTIONS,
  NewFamilyMember,
  UploadFile,
  fromISODate,
  toISODate,
  useStores,
} from '@app/core';
import {
  CustomButton,
  CustomFormDatePicker,
  CustomFormDropdown,
  CustomFormInput,
} from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import PhotoPickerSheet from '../../../components/PhotoPickerSheet';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useProfileViewModel } from './useProfileViewModel';
import { useProfileFormRules } from './useProfileFormRules';
import ProfileHeaderCard from './ProfileHeaderCard';
import { SectionCard } from './ProfileComponents';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface ProfileForm extends Omit<NewFamilyMember, 'relationship' | 'dateOfBirth'> {
  dateOfBirth?: Date;
}

const EMPTY_FORM: ProfileForm = {
  fullName: '',
  gender: '',
  bloodType: '',
  dateOfBirth: undefined,
  phone: '',
  email: '',
  address: '',
  emergencyContact: '',
  emergencyPhone: '',
};

/**
 * Edits the account holder's own profile — and doubles as the create form: a
 * freshly registered patient has no profile row, so the first save POSTs and
 * every later one PUTs (the view model decides which).
 */
export const ProfileEditScreen = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { toastStore } = useStores();
  const viewModel = useProfileViewModel();
  const rules = useProfileFormRules();

  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const [isSaving, setIsSaving] = useState(false);
  const [isSeeded, setIsSeeded] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  /**
   * Creating has no profile row to attach a photo to, so the picked file waits
   * for the save. Editing uploads straight away, as the row already exists.
   */
  const [pendingPhoto, setPendingPhoto] = useState<UploadFile | null>(null);

  const { control, handleSubmit, reset, watch } = useForm<ProfileForm>({
    defaultValues: EMPTY_FORM,
    mode: 'onBlur',
  });

  const profile = viewModel.profile;
  const isCreating = !profile && !viewModel.isProfileLoading;

  // Seed the form once the profile lands; a create flow keeps the empty form.
  useEffect(() => {
    if (isSeeded || !profile) return;
    reset({
      fullName: profile?.fullName ?? '',
      gender: profile?.gender ?? '',
      bloodType: profile?.bloodType ?? '',
      dateOfBirth: ISO_DATE.test(profile?.dateOfBirth ?? '')
        ? fromISODate(profile?.dateOfBirth)
        : undefined,
      phone: profile?.phone ?? '',
      email: profile?.email ?? '',
      address: profile?.address ?? '',
      emergencyContact: profile?.emergencyContact ?? '',
      emergencyPhone: profile?.emergencyPhone ?? '',
    });
    setIsSeeded(true);
  }, [profile, isSeeded, reset]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const handlePhotoPicked = useCallback(
    async (file: UploadFile) => {
      if (isCreating) {
        setPendingPhoto(file);
        return;
      }

      toastStore.show(t('photoPicker.uploading'), 'info');
      const uploaded = await viewModel.uploadPhoto(file);
      toastStore.show(
        uploaded ? t('photoPicker.uploaded') : t('photoPicker.uploadFailed'),
        uploaded ? 'success' : 'error',
      );
    },
    [isCreating, viewModel, toastStore, t],
  );

  const handleSave = useCallback(async () => {
    await handleSubmit(async values => {
      setIsSaving(true);
      const saved = await viewModel.saveProfile(
        {
          ...values,
          dateOfBirth: values?.dateOfBirth ? toISODate(values.dateOfBirth) : '',
        },
        pendingPhoto ?? undefined,
      );
      setIsSaving(false);

      if (!saved) {
        toastStore.show(t('patientProfile.loadFailed'), 'error');
        return;
      }
      toastStore.show(
        isCreating ? t('patientProfile.profileCreated') : t('patientProfile.profileUpdated'),
        'success',
      );
      goBack();
    })();
  }, [handleSubmit, viewModel, pendingPhoto, isCreating, toastStore, t, goBack]);

  // The header card previews what is being typed, so it follows the form.
  const preview = watch();

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={isCreating ? t('patientProfile.createProfileTitle') : t('patientProfile.editProfile')}
        leading="back"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <ProfileHeaderCard
            profile={{
              ...(profile ?? ({} as any)),
              fullName: preview?.fullName ?? '',
              gender: preview?.gender ?? '',
              bloodType: preview?.bloodType ?? '',
              dateOfBirth: preview?.dateOfBirth ? toISODate(preview.dateOfBirth) : '',
            }}
            photoPreviewUri={pendingPhoto?.uri}
            onPhotoPress={() => setShowPhotoSheet(true)}
          />

          <SectionCard title={t('patientProfile.basicInformation')} icon="card-account-details-outline">
            <CustomFormInput
              name="fullName"
              control={control}
              label={t('patientProfile.fullName')}
              placeholder={t('patientProfile.fullNamePlaceholder')}
              leftIcon="account-outline"
              rules={rules.fullName}
            />
            <CustomFormDatePicker
              name="dateOfBirth"
              control={control}
              label={t('patientProfile.dateOfBirth')}
              placeholder={t('patientProfile.datePlaceholder')}
              maximumDate={new Date()}
            />
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <CustomFormDropdown
                  name="gender"
                  control={control}
                  label={t('patientProfile.gender')}
                  items={GENDER_OPTIONS.map(item => ({ label: item, value: item }))}
                  placeholder={t('patientProfile.select')}
                />
              </View>
              <View style={styles.rowItem}>
                <CustomFormDropdown
                  name="bloodType"
                  control={control}
                  label={t('patientProfile.bloodType')}
                  items={BLOOD_TYPE_OPTIONS.map(item => ({ label: item, value: item }))}
                  placeholder={t('patientProfile.select')}
                />
              </View>
            </View>
          </SectionCard>

          <SectionCard title={t('patientProfile.contactInformation')} icon="phone-outline">
            <CustomFormInput
              name="phone"
              control={control}
              label={t('patientProfile.phone')}
              keyboardType="phone-pad"
              leftIcon="phone-outline"
              rules={rules.phone}
            />
            <CustomFormInput
              name="email"
              control={control}
              label={t('patientProfile.email')}
              keyboardType="email-address"
              leftIcon="email-outline"
              rules={rules.email}
            />
            <CustomFormInput
              name="address"
              control={control}
              label={t('patientProfile.address')}
              leftIcon="map-marker-outline"
            />
          </SectionCard>

          <SectionCard title={t('patientProfile.emergencyContact')} icon="alert-outline">
            <CustomFormInput
              name="emergencyContact"
              control={control}
              label={t('patientProfile.contactPerson')}
              leftIcon="account-outline"
            />
            <CustomFormInput
              name="emergencyPhone"
              control={control}
              label={t('patientProfile.phone')}
              keyboardType="phone-pad"
              leftIcon="phone-outline"
              rules={rules.phone}
            />
          </SectionCard>
        </ScrollView>

        <View
          style={[
            styles.footer,
            // The pinned actions have to clear the floating tab bar, same as scroll content.
            {
              backgroundColor: theme.colors.background,
              paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
            },
          ]}
        >
          <CustomButton
            mode="outlined"
            onPress={goBack}
            style={[styles.footerButton, { borderColor: theme.colors.outlineVariant }]}
            textColor={theme.colors.onSurface}
          >
            {t('common.cancel')}
          </CustomButton>
          <CustomButton
            mode="contained"
            onPress={handleSave}
            loading={isSaving}
            style={styles.footerButton}
          >
            {isCreating ? t('patientProfile.createProfile') : t('patientProfile.saveProfile')}
          </CustomButton>
        </View>
      </KeyboardAvoidingView>

      <PhotoPickerSheet
        visible={showPhotoSheet}
        onClose={() => setShowPhotoSheet(false)}
        onPicked={handlePhotoPicked}
      />
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  footerButton: {
    flex: 1,
    marginVertical: 0,
    borderRadius: 12,
  },
});

export default ProfileEditScreen;
