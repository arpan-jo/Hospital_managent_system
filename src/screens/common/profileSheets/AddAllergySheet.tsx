import React, { memo, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { ALLERGY_SEVERITIES, AllergySeverity } from '@app/core';
import {
  CustomBottomSheet,
  CustomButton,
  CustomFormDropdown,
  CustomFormInput,
  fontFamilies,
} from '@app/ui';
import { useProfileFormRules } from '../../patient/profile/useProfileFormRules';

interface AllergyForm {
  name: string;
  severity: AllergySeverity;
  reaction: string;
}

const EMPTY_FORM: AllergyForm = { name: '', severity: 'Mild', reaction: '' };

interface AddAllergySheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (input: { name: string; severity: AllergySeverity; reaction: string }) => void;
}

export const AddAllergySheet = memo<AddAllergySheetProps>(function AddAllergySheet({
  visible,
  onClose,
  onAdd,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const rules = useProfileFormRules();

  const { control, handleSubmit, reset } = useForm<AllergyForm>({
    defaultValues: EMPTY_FORM,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (visible) reset(EMPTY_FORM);
  }, [visible, reset]);

  const handleAdd = handleSubmit(values => {
    onAdd({
      name: values?.name?.trim() ?? '',
      severity: values?.severity ?? 'Mild',
      reaction: values?.reaction?.trim() ?? '',
    });
    onClose();
  });

  return (
    <CustomBottomSheet visible={visible} onClose={onClose} style={styles.sheet}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {t('patientProfile.newAllergy')}
        </Text>
        <IconButton icon="close" size={20} onPress={onClose} iconColor={theme.colors.onSurface} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <CustomFormInput
          name="name"
          control={control}
          label={t('patientProfile.allergyName')}
          placeholder={t('patientProfile.allergyNamePlaceholder')}
          leftIcon="alert-outline"
          rules={rules.allergen}
        />

        <CustomFormDropdown
          name="severity"
          control={control}
          label={t('patientProfile.severity')}
          items={ALLERGY_SEVERITIES.map(item => ({
            label: t(`patientProfile.severity${item}`),
            value: item,
          }))}
          placeholder={t('patientProfile.severityMild')}
        />

        <CustomFormInput
          name="reaction"
          control={control}
          label={t('patientProfile.reaction').replace(':', '')}
          placeholder={t('patientProfile.reactionPlaceholder')}
          multiline
          numberOfLines={3}
        />
      </ScrollView>

      {/* No bottom padding here — CustomBottomSheet already applies the safe-area gap. */}
      <View style={styles.actions}>
        <CustomButton
          mode="outlined"
          onPress={onClose}
          style={[styles.actionButton, { borderColor: theme.colors.outlineVariant }]}
          textColor={theme.colors.onSurface}
        >
          {t('common.cancel')}
        </CustomButton>
        <CustomButton mode="contained" onPress={handleAdd} style={styles.actionButton}>
          {t('patientProfile.addAllergyAction')}
        </CustomButton>
      </View>
    </CustomBottomSheet>
  );
});

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    marginVertical: 0,
    paddingVertical: 2,
    borderRadius: 10,
  },
});

export default AddAllergySheet;
