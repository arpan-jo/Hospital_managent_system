import React, { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  BLOOD_TYPE_OPTIONS,
  FAMILY_GENDERS,
  FAMILY_RELATIONSHIPS,
  FamilyProfileForm,
  FamilyRelationship,
  PatientProfile,
  UploadFile,
  fromISODate,
  getFileUrl,
  toISODate,
} from '@app/core';
import {
  CustomAvatar,
  CustomBottomSheet,
  CustomButton,
  CustomFormDatePicker,
  CustomFormDropdown,
  CustomFormInput,
  fontFamilies,
} from '@app/ui';
import PhotoPickerSheet from '../../../components/PhotoPickerSheet';
import FormChoiceChips from './FormChoiceChips';
import { useProfileFormRules } from './useProfileFormRules';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type FamilyFormValues = Omit<FamilyProfileForm, 'dateOfBirth'> & { dateOfBirth?: Date };

const EMPTY_FORM: FamilyFormValues = {
  fullName: '',
  // A new member starts as a spouse, as on the portal.
  relationship: 'spouse',
  gender: '',
  dateOfBirth: undefined,
  bloodType: '',
  phone: '',
  email: '',
  address: '',
  emergencyContact: '',
  emergencyPhone: '',
};

const toFormValues = (profile: PatientProfile): FamilyFormValues => ({
  fullName: profile?.fullName ?? '',
  relationship: (profile?.relationship || 'self') as FamilyRelationship,
  gender: profile?.gender?.toLowerCase() === 'others' ? 'other' : profile?.gender?.toLowerCase() ?? '',
  dateOfBirth: ISO_DATE.test(profile?.dateOfBirth ?? '') ? fromISODate(profile.dateOfBirth) : undefined,
  bloodType: profile?.bloodType ?? '',
  phone: profile?.phone ?? '',
  email: profile?.email ?? '',
  address: profile?.address ?? '',
  emergencyContact: profile?.emergencyContact ?? '',
  emergencyPhone: profile?.emergencyPhone ?? '',
});

interface FamilyMemberSheetProps {
  visible: boolean;
  /** The profile being edited; null adds a new family member. */
  target: PatientProfile | null;
  onClose: () => void;
  /** Resolves true once saved — the sheet closes only then. */
  onSave: (form: FamilyProfileForm, photo: UploadFile | null) => Promise<boolean>;
}

/** The portal's family profile form: add a family member, or edit one. */
export const FamilyMemberSheet = memo<FamilyMemberSheetProps>(function FamilyMemberSheet({
  visible,
  target,
  onClose,
  onSave,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const rules = useProfileFormRules();

  const [photo, setPhoto] = useState<UploadFile | null>(null);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { control, handleSubmit, reset, watch } = useForm<FamilyFormValues>({
    defaultValues: EMPTY_FORM,
    mode: 'onBlur',
  });

  // Each opening starts from the profile being edited, or from blank.
  useEffect(() => {
    if (!visible) return;
    reset(target ? toFormValues(target) : EMPTY_FORM);
    setPhoto(null);
  }, [visible, target, reset]);

  const fullName = watch('fullName');
  const isSelf = target?.relationship === 'self';

  const handleSave = useCallback(async () => {
    await handleSubmit(async values => {
      setIsSaving(true);
      const saved = await onSave(
        {
          ...values,
          dateOfBirth: values?.dateOfBirth ? toISODate(values.dateOfBirth) : '',
        },
        photo,
      );
      setIsSaving(false);
      if (saved) onClose();
    })();
  }, [handleSubmit, onSave, photo, onClose]);

  const relationshipOptions = FAMILY_RELATIONSHIPS.map(value => ({
    value,
    label: t(`patientProfile.relation_${value}`),
  }));
  const genderItems = FAMILY_GENDERS.map(value => ({
    value,
    label: t(`patientProfile.gender_${value}`),
  }));

  return (
    <CustomBottomSheet visible={visible} onClose={onClose} style={styles.sheet}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {target ? t('patientProfile.editProfile') : t('patientProfile.addFamilyMember')}
        </Text>
        <IconButton icon="close" size={20} onPress={onClose} iconColor={theme.colors.onSurface} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Pressable
          onPress={() => setShowPhotoSheet(true)}
          style={styles.photo}
          accessibilityRole="button"
          accessibilityLabel={t('photoPicker.title')}
        >
          <CustomAvatar
            type="image"
            value={photo?.uri || getFileUrl(target?.photoUrl)}
            fallback={fullName}
            size={76}
          />
          <View
            style={[
              styles.cameraBadge,
              { backgroundColor: theme.colors.primary, borderColor: theme.colors.surface },
            ]}
          >
            <Icon name="camera-outline" size={12} color={theme.colors.onPrimary} />
          </View>
        </Pressable>

        <CustomFormInput
          name="fullName"
          control={control}
          label={`${t('patientProfile.fullName')} *`}
          placeholder={t('patientProfile.fullNamePlaceholder')}
          leftIcon="account-outline"
          rules={rules.fullName}
        />

        {isSelf ? null : (
          <FormChoiceChips
            name="relationship"
            control={control}
            label={`${t('patientProfile.relationship')} *`}
            options={relationshipOptions}
            rules={rules.requiredText}
          />
        )}

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <CustomFormDropdown
              name="gender"
              control={control}
              label={t('patientProfile.gender')}
              items={genderItems}
              placeholder={t('patientProfile.select')}
            />
          </View>
          <View style={styles.rowItem}>
            <CustomFormDropdown
              name="bloodType"
              control={control}
              label={t('patientProfile.bloodType')}
              items={BLOOD_TYPE_OPTIONS.map(value => ({ label: value, value }))}
              placeholder={t('patientProfile.unknown')}
            />
          </View>
        </View>
        <CustomFormDatePicker
          name="dateOfBirth"
          control={control}
          label={t('patientProfile.dateOfBirth')}
          placeholder={t('patientProfile.datePlaceholder')}
          maximumDate={new Date()}
        />
        <CustomFormInput
          name="phone"
          control={control}
          label={t('patientProfile.phone')}
          keyboardType="phone-pad"
          leftIcon="phone-outline"
        />
        <CustomFormInput
          name="email"
          control={control}
          label={t('patientProfile.email')}
          keyboardType="email-address"
          leftIcon="email-outline"
        />
        <CustomFormInput
          name="address"
          control={control}
          label={t('patientProfile.address')}
          leftIcon="map-marker-outline"
        />
        <CustomFormInput
          name="emergencyContact"
          control={control}
          label={t('patientProfile.emergencyContact')}
          leftIcon="account-alert-outline"
        />
        <CustomFormInput
          name="emergencyPhone"
          control={control}
          label={t('patientProfile.emergencyPhone')}
          keyboardType="phone-pad"
          leftIcon="phone-outline"
        />
      </ScrollView>

      <View style={styles.actions}>
        <CustomButton
          mode="outlined"
          onPress={onClose}
          style={[styles.actionButton, { borderColor: theme.colors.outlineVariant }]}
          textColor={theme.colors.onSurface}
        >
          {t('common.cancel')}
        </CustomButton>
        <CustomButton
          mode="contained"
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving || !fullName?.trim()}
          style={styles.actionButton}
        >
          {t('patientProfile.saveProfile')}
        </CustomButton>
      </View>

      <PhotoPickerSheet
        visible={showPhotoSheet}
        onClose={() => setShowPhotoSheet(false)}
        onPicked={setPhoto}
      />
    </CustomBottomSheet>
  );
});

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 8,
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 17,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  photo: {
    alignSelf: 'center',
    marginVertical: 8,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  actionButton: {
    flex: 1,
    marginVertical: 0,
    borderRadius: 12,
  },
});

export default FamilyMemberSheet;
