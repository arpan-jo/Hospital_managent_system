import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { HelperText, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  BLOOD_TYPE_OPTIONS,
  FAMILY_RELATIONSHIPS,
  FamilyRelationship,
  GENDER_OPTIONS,
  PatientRepository,
  UploadFile,
  fromISODate,
  getFileUrl,
  useStores,
} from '@app/core';
import {
  CustomAvatar,
  CustomButton,
  CustomFormDatePicker,
  CustomFormDropdown,
  CustomFormInput,
  fontFamilies,
} from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import PhotoPickerSheet from '../../../components/PhotoPickerSheet';
import { TAB_BAR_CLEARANCE } from '../../../navigation/tabBarLayout';
import { ProfileStackParamList } from '../../../navigation/ProfileStackNavigator';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useProfileFormRules } from './useProfileFormRules';
import {
  EMPTY_MEMBER_FORM,
  FamilyMemberForm,
  useFamilyMemberViewModel,
} from './useFamilyMemberViewModel';
import { cardShadow } from './profileConstants';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const RELATIONSHIP_ICON: Record<FamilyRelationship, string> = {
  Spouse: 'heart-outline',
  Child: 'emoticon-happy-outline',
  Parent: 'account-outline',
  Sibling: 'account-group-outline',
  Other: 'dots-horizontal-circle-outline',
};

/**
 * A full screen rather than a sheet: ten fields plus a photo picker need the
 * whole viewport once the keyboard is up. Handles both adding a relative and
 * editing one — the route's `patientCode` decides which.
 */
export const AddFamilyMemberScreen = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ProfileStackParamList, 'AddFamilyMember'>>();
  const insets = useSafeAreaInsets();
  const { toastStore } = useStores();
  const rules = useProfileFormRules();

  const { patientCode = '' }: Partial<ProfileStackParamList['AddFamilyMember']> =
    route.params ?? {};
  const isEditing = patientCode?.length > 0;

  const viewModel = useFamilyMemberViewModel(isEditing ? patientCode : undefined);

  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const [isLoadingMember, setIsLoadingMember] = useState(isEditing);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  /**
   * Held until save for a new relative — there is no profile row to attach it
   * to yet. Editing uploads straight away, since the row already exists.
   */
  const [photo, setPhoto] = useState<{ file?: UploadFile; blobName: string }>({ blobName: '' });

  const { control, handleSubmit, reset, watch } = useForm<FamilyMemberForm>({
    defaultValues: EMPTY_MEMBER_FORM,
    mode: 'onBlur',
  });

  // Editing seeds the form from the member's own profile record.
  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;

    const load = async () => {
      try {
        const member = await PatientRepository.getProfileByCode(patientCode);
        if (cancelled) return;
        setPhoto({ blobName: member?.photoUrl ?? '' });
        reset({
          fullName: member?.fullName ?? '',
          relationship: (member?.relationship
            ? `${member.relationship.charAt(0).toUpperCase()}${member.relationship.slice(1)}`
            : 'Other') as FamilyRelationship,
          gender: member?.gender ?? '',
          bloodType: member?.bloodType ?? '',
          dateOfBirth: ISO_DATE.test(member?.dateOfBirth ?? '')
            ? fromISODate(member?.dateOfBirth)
            : undefined,
          phone: member?.phone ?? '',
          email: member?.email ?? '',
          address: member?.address ?? '',
          emergencyContact: member?.emergencyContact ?? '',
          emergencyPhone: member?.emergencyPhone ?? '',
        });
      } catch (error: any) {
        console.log('[FamilyMember] load error ==>', error?.message);
      } finally {
        if (!cancelled) setIsLoadingMember(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isEditing, patientCode, reset]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const handlePhoto = useCallback(() => setShowPhotoSheet(true), []);

  const handlePhotoPicked = useCallback(
    async (file: UploadFile) => {
      // A new relative has no row yet, so the file rides along with the save.
      if (!isEditing) {
        setPhoto({ file, blobName: '' });
        return;
      }

      toastStore.show(t('photoPicker.uploading'), 'info');
      try {
        const updated = await PatientRepository.updatePhoto(file, patientCode);
        setPhoto({ blobName: updated?.photoUrl ?? '' });
        toastStore.show(t('photoPicker.uploaded'), 'success');
      } catch (error: any) {
        console.log('[FamilyMember] photo upload error ==>', error?.message);
        toastStore.show(t('photoPicker.uploadFailed'), 'error');
      }
    },
    [isEditing, patientCode, toastStore, t],
  );

  const handleSave = useCallback(async () => {
    await handleSubmit(async values => {
      const saved = await viewModel.submit(values, photo?.file);
      if (!saved) {
        toastStore.show(t('patientProfile.loadFailed'), 'error');
        return;
      }
      toastStore.show(
        isEditing ? t('patientProfile.memberUpdated') : t('patientProfile.familyMemberAdded'),
        'success',
      );
      goBack();
    })();
  }, [handleSubmit, viewModel, photo, isEditing, toastStore, t, goBack]);

  const typedName = watch('fullName');

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={
          isEditing ? t('patientProfile.editFamilyMember') : t('patientProfile.addFamilyMember')
        }
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
          <View style={styles.photoBlock}>
            <Pressable onPress={handlePhoto} hitSlop={6}>
              <CustomAvatar
                type="image"
                value={photo?.file?.uri || getFileUrl(photo?.blobName)}
                fallback={typedName || '+'}
                size={76}
              />
              <View
                style={[
                  styles.cameraBadge,
                  { backgroundColor: theme.colors.primary, borderColor: theme.colors.background },
                ]}
              >
                <Icon name="camera-outline" size={13} color={theme.colors.onPrimary} />
              </View>
            </Pressable>
            <Pressable onPress={handlePhoto} hitSlop={6}>
              <Text style={[styles.photoLink, { color: theme.colors.primary }]}>
                {t('patientProfile.uploadPhoto')}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.card, cardShadow, { backgroundColor: theme.colors.surface }]}>
            <CustomFormInput
              name="fullName"
              control={control}
              label={t('patientProfile.fullName')}
              placeholder={t('patientProfile.fullNamePlaceholder')}
              leftIcon="account-outline"
              rules={rules.fullName}
              disabled={isLoadingMember}
            />

            {/* Chips rather than a dropdown — five short options read faster. */}
            <Controller
              control={control}
              name="relationship"
              rules={rules.relationship}
              render={({ field: { value, onChange }, fieldState: { error } }) => (
                <>
                  <Text style={[styles.groupLabel, { color: theme.colors.onSurface }]}>
                    {t('patientProfile.relationship')}
                    <Text style={{ color: theme.colors.error }}> *</Text>
                  </Text>
                  <View style={styles.relationRow}>
                    {FAMILY_RELATIONSHIPS.map(item => {
                      const selected = value === item;
                      return (
                        <Pressable
                          key={item}
                          onPress={() => onChange(item)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          style={[
                            styles.relationChip,
                            {
                              backgroundColor: selected
                                ? theme.colors.primary
                                : theme.colors.surfaceVariant,
                              borderColor: selected
                                ? theme.colors.primary
                                : theme.colors.outlineVariant,
                            },
                          ]}
                        >
                          <Icon
                            name={RELATIONSHIP_ICON[item]}
                            size={14}
                            color={selected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
                          />
                          <Text
                            style={[
                              styles.relationText,
                              { color: selected ? theme.colors.onPrimary : theme.colors.onSurface },
                            ]}
                          >
                            {t(`patientProfile.relationship${item}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {error?.message ? (
                    <HelperText type="error" visible>
                      {error.message}
                    </HelperText>
                  ) : null}
                </>
              )}
            />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <CustomFormDropdown
                  name="gender"
                  control={control}
                  label={t('patientProfile.gender')}
                  items={GENDER_OPTIONS.map(item => ({ label: item, value: item }))}
                  placeholder={t('patientProfile.select')}
                  disabled={isLoadingMember}
                />
              </View>
              <View style={styles.rowItem}>
                <CustomFormDropdown
                  name="bloodType"
                  control={control}
                  label={t('patientProfile.bloodType')}
                  items={BLOOD_TYPE_OPTIONS.map(item => ({ label: item, value: item }))}
                  placeholder={t('patientProfile.select')}
                  disabled={isLoadingMember}
                />
              </View>
            </View>

            <CustomFormDatePicker
              name="dateOfBirth"
              control={control}
              label={t('patientProfile.dateOfBirth')}
              placeholder={t('patientProfile.datePlaceholder')}
              maximumDate={new Date()}
              disabled={isLoadingMember}
            />
          </View>

          <View style={[styles.card, cardShadow, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
              {t('patientProfile.contactInformation')}
            </Text>
            <CustomFormInput
              name="phone"
              control={control}
              label={t('patientProfile.phone')}
              keyboardType="phone-pad"
              leftIcon="phone-outline"
              rules={rules.memberPhone}
              disabled={isLoadingMember}
            />
            <CustomFormInput
              name="email"
              control={control}
              label={t('patientProfile.email')}
              keyboardType="email-address"
              leftIcon="email-outline"
              rules={rules.email}
              disabled={isLoadingMember}
            />
            <CustomFormInput
              name="address"
              control={control}
              label={t('patientProfile.address')}
              leftIcon="map-marker-outline"
              disabled={isLoadingMember}
            />
          </View>

          <View style={[styles.card, cardShadow, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
              {t('patientProfile.emergencyContact')}
            </Text>
            <CustomFormInput
              name="emergencyContact"
              control={control}
              label={t('patientProfile.contactPerson')}
              leftIcon="account-outline"
              disabled={isLoadingMember}
            />
            <CustomFormInput
              name="emergencyPhone"
              control={control}
              label={t('patientProfile.phone')}
              keyboardType="phone-pad"
              leftIcon="phone-outline"
              rules={rules.memberPhone}
              disabled={isLoadingMember}
            />
          </View>
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
            loading={viewModel.isSaving}
            disabled={isLoadingMember}
            style={styles.footerButton}
          >
            {isEditing ? t('patientProfile.saveChanges') : t('patientProfile.saveProfile')}
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
  photoBlock: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
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
  photoLink: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    paddingTop: 6,
    marginTop: 14,
  },
  cardTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    marginTop: 8,
  },
  groupLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    marginTop: 4,
  },
  relationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  relationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  relationText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
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

export default AddFamilyMemberScreen;
