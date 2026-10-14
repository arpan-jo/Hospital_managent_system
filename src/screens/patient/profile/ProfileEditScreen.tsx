import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BLOOD_TYPE_OPTIONS,
  DIVISION_OPTIONS,
  GENDER_OPTIONS,
  GENERAL_ID,
  IDENTIFICATION_TYPES,
  PatientProfileForm,
  RELATIONSHIP_OPTIONS,
  RELIGION_OPTIONS,
  UploadFile,
  calculateAge,
  fromISODate,
  toISODate,
  toPatientProfileForm,
} from '@app/core';
import {
  CustomButton,
  CustomInput,
  CustomFormDatePicker,
  CustomFormDropdown,
  CustomFormInput,
} from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import PhotoPickerSheet from '../../../components/PhotoPickerSheet';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { ProfileStackParamList } from '../../../navigation/ProfileStackNavigator';
import { TabParamList } from '../../../navigation/TabNavigator';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useProfileViewModel } from './useProfileViewModel';
import { useProfileFormRules } from './useProfileFormRules';
import ProfileHeaderCard from './ProfileHeaderCard';
import { SectionCard } from './ProfileComponents';
import FormChoiceChips from './FormChoiceChips';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The form as the screen holds it: the date picker works in `Date`, the API in 'YYYY-MM-DD'. */
type ProfileFormValues = Omit<PatientProfileForm, 'dateOfBirth'> & { dateOfBirth?: Date };

const toFormValues = (form: PatientProfileForm): ProfileFormValues => ({
  ...form,
  dateOfBirth: ISO_DATE.test(form?.dateOfBirth ?? '') ? fromISODate(form.dateOfBirth) : undefined,
});

const toItems = (values: string[]) => values?.map(value => ({ label: value, value })) ?? [];

/**
 * Edits the patient's own profile in the portal's sections — and creates it:
 * a newly signed-up patient has none, so the first save makes it. Opened from
 * a doctor's page to finish the profile, it goes back to that doctor once saved.
 */
export const ProfileEditScreen = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const route = useRoute<RouteProp<ProfileStackParamList, 'ProfileEdit'>>();
  const insets = useSafeAreaInsets();
  const viewModel = useProfileViewModel();
  const rules = useProfileFormRules();

  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const returnToDoctorId = route?.params?.returnToDoctorId ?? 0;

  const [isSaving, setIsSaving] = useState(false);
  const [isSeeded, setIsSeeded] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  /**
   * Before the first save there is no profile to put a photo on, so the
   * picked file waits for the save. Once the profile exists it goes up at once.
   */
  const [pendingPhoto, setPendingPhoto] = useState<UploadFile | null>(null);

  const { control, handleSubmit, reset, watch, setValue } = useForm<ProfileFormValues>({
    defaultValues: toFormValues(toPatientProfileForm(null)),
    mode: 'onBlur',
  });

  const profile = viewModel.profile;
  const isCreating = !profile?.registrationId;

  // Seed the form once the profile lands; a new profile keeps the empty form.
  useEffect(() => {
    if (isSeeded || !profile) return;
    reset(toFormValues(toPatientProfileForm(profile)));
    setIsSeeded(true);
  }, [profile, isSeeded, reset]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const uploadPhoto = viewModel.uploadPhoto;
  const handlePhotoPicked = useCallback(
    (file: UploadFile) => {
      if (isCreating) {
        setPendingPhoto(file);
        return;
      }
      // The view model reports how it went.
      uploadPhoto(file);
    },
    [isCreating, uploadPhoto],
  );

  const saveProfile = viewModel.saveProfile;
  const handleSave = useCallback(async () => {
    await handleSubmit(async values => {
      setIsSaving(true);
      const saved = await saveProfile(
        {
          ...values,
          dateOfBirth: values?.dateOfBirth ? toISODate(values.dateOfBirth) : '',
        },
        pendingPhoto,
      );
      setIsSaving(false);
      if (!saved) return;

      goBack();
      // Sent here by a doctor's page: back to that doctor, as the portal does.
      if (returnToDoctorId > 0) {
        navigation
          .getParent<BottomTabNavigationProp<TabParamList>>()
          ?.navigate('HomeTab', {
            screen: 'DoctorDetails',
            params: { employeeId: returnToDoctorId },
          });
      }
    })();
  }, [handleSubmit, saveProfile, pendingPhoto, goBack, returnToDoctorId, navigation]);

  // The header card previews what is being typed, so it follows the form.
  const fullName = watch('fullName');
  const gender = watch('gender');
  const bloodType = watch('bloodType');
  const dateOfBirth = watch('dateOfBirth');

  /**
   * Age and date of birth fill each other, as on the portal: a date sets the
   * age, and an age sets the date to that many years before today.
   */
  const [ageText, setAgeText] = useState('');
  useEffect(() => {
    const next = dateOfBirth ? String(calculateAge(toISODate(dateOfBirth))) : '';
    setAgeText(prev => (prev === next ? prev : next));
  }, [dateOfBirth]);

  const handleAgeChange = useCallback(
    (text: string) => {
      const digits = text?.replace(/\D/g, '') ?? '';
      if (!digits) {
        setAgeText('');
        setValue('dateOfBirth', undefined, { shouldValidate: true });
        return;
      }
      const years = Math.min(Number(digits), 150);
      const date = new Date();
      date.setFullYear(date.getFullYear() - years);
      setAgeText(String(years));
      setValue('dateOfBirth', date, { shouldValidate: true });
    },
    [setValue],
  );
  const identificationType = watch('identificationType');
  const hasIdNumber = (identificationType || GENERAL_ID) !== GENERAL_ID;

  const preview = useMemo(
    () => ({
      ...(profile ?? ({} as any)),
      fullName: fullName ?? '',
      gender: gender ?? '',
      bloodType: bloodType ?? '',
      dateOfBirth: dateOfBirth ? toISODate(dateOfBirth) : '',
    }),
    [profile, fullName, gender, bloodType, dateOfBirth],
  );

  const select = t('patientProfile.select');

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
            profile={preview}
            photoPreviewUri={pendingPhoto?.uri}
            onPhotoPress={() => setShowPhotoSheet(true)}
            isPhotoUploading={viewModel.isUploadingPhoto}
          />

          <SectionCard title={t('patientProfile.patientInformation')} icon="card-account-details-outline">
            <FormChoiceChips
              name="identificationType"
              control={control}
              label={t('patientProfile.identificationType')}
              options={toItems(IDENTIFICATION_TYPES)}
            />
            {hasIdNumber ? (
              <CustomFormInput
                name="identificationNumber"
                control={control}
                label={t('patientProfile.identificationNumber', { type: identificationType })}
                leftIcon="numeric"
                rules={rules.identificationNumber}
              />
            ) : null}
            <CustomFormInput
              name="fullName"
              control={control}
              label={`${t('patientProfile.fullName')} *`}
              placeholder={t('patientProfile.fullNamePlaceholder')}
              leftIcon="account-outline"
              rules={rules.fullName}
            />
            <View style={styles.row}>
              <View style={styles.dateItem}>
                <CustomFormDatePicker
                  name="dateOfBirth"
                  control={control}
                  label={`${t('patientProfile.dateOfBirth')} *`}
                  placeholder={t('patientProfile.datePlaceholder')}
                  maximumDate={new Date()}
                  rules={rules.requiredDate}
                />
              </View>
              <View style={styles.rowItem}>
                <CustomInput
                  label={t('patientProfile.age')}
                  value={ageText}
                  onChangeText={handleAgeChange}
                  placeholder={t('patientProfile.agePlaceholder')}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <CustomFormInput
              name="phone"
              control={control}
              label={`${t('patientProfile.mobileNumber')} *`}
              keyboardType="phone-pad"
              leftIcon="phone-outline"
              rules={rules.mobile}
            />
            <CustomFormDropdown
              name="bloodType"
              control={control}
              label={`${t('patientProfile.bloodType')} *`}
              items={toItems(BLOOD_TYPE_OPTIONS)}
              placeholder={select}
              rules={rules.requiredText}
            />
            <FormChoiceChips
              name="gender"
              control={control}
              label={`${t('patientProfile.gender')} *`}
              options={toItems(GENDER_OPTIONS)}
              rules={rules.requiredText}
            />
          </SectionCard>

          <SectionCard title={t('patientProfile.contactInformation')} icon="map-marker-outline">
            <CustomFormDropdown
              name="division"
              control={control}
              label={t('patientProfile.division')}
              items={toItems(DIVISION_OPTIONS)}
              placeholder={select}
            />
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <CustomFormInput name="district" control={control} label={t('patientProfile.district')} />
              </View>
              <View style={styles.rowItem}>
                <CustomFormInput name="upazila" control={control} label={t('patientProfile.upazila')} />
              </View>
            </View>
            <CustomFormInput
              name="address"
              control={control}
              label={t('patientProfile.address')}
              leftIcon="map-marker-outline"
            />
          </SectionCard>

          <SectionCard title={t('patientProfile.careOf')} icon="account-supervisor-outline">
            <CustomFormInput
              name="coName"
              control={control}
              label={t('patientProfile.name')}
              leftIcon="account-outline"
            />
            <CustomFormDropdown
              name="coRelationship"
              control={control}
              label={t('patientProfile.relationship')}
              items={toItems(RELATIONSHIP_OPTIONS)}
              placeholder={select}
            />
            <CustomFormInput
              name="coMobileNumber"
              control={control}
              label={t('patientProfile.mobileNumber')}
              keyboardType="phone-pad"
              leftIcon="phone-outline"
            />
          </SectionCard>

          <SectionCard title={t('patientProfile.emergencyContact')} warning>
            <CustomFormInput
              name="emergencyContact"
              control={control}
              label={t('patientProfile.contactPerson')}
              leftIcon="account-outline"
            />
            <CustomFormDropdown
              name="emergencyRelationship"
              control={control}
              label={t('patientProfile.relationship')}
              items={toItems(RELATIONSHIP_OPTIONS)}
              placeholder={select}
            />
            <CustomFormInput
              name="emergencyPhone"
              control={control}
              label={t('patientProfile.mobileNumber')}
              keyboardType="phone-pad"
              leftIcon="phone-outline"
              rules={rules.optionalMobile}
            />
            <CustomFormInput
              name="emergencyAddress"
              control={control}
              label={t('patientProfile.address')}
              leftIcon="map-marker-outline"
            />
          </SectionCard>

          <SectionCard title={t('patientProfile.otherInformation')} icon="information-outline">
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <CustomFormInput
                  name="occupation"
                  control={control}
                  label={t('patientProfile.occupation')}
                />
              </View>
              <View style={styles.rowItem}>
                <CustomFormInput
                  name="nationality"
                  control={control}
                  label={t('patientProfile.nationality')}
                />
              </View>
            </View>
            <CustomFormInput
              name="identityMark"
              control={control}
              label={t('patientProfile.identityMark')}
              leftIcon="fingerprint"
            />
            <CustomFormDropdown
              name="religion"
              control={control}
              label={t('patientProfile.religion')}
              items={toItems(RELIGION_OPTIONS)}
              placeholder={select}
            />
            <CustomFormInput
              name="email"
              control={control}
              label={t('patientProfile.email')}
              keyboardType="email-address"
              leftIcon="email-outline"
              rules={rules.email}
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
            disabled={isSaving}
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
  dateItem: {
    flex: 1.5,
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
