import React, { memo, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { CONDITION_STATUSES, ConditionStatus, toISODate } from '@app/core';
import {
  CustomBottomSheet,
  CustomButton,
  CustomFormDatePicker,
  CustomFormDropdown,
  CustomFormInput,
  fontFamilies,
} from '@app/ui';
import { useProfileFormRules } from '../../patient/profile/useProfileFormRules';

interface ConditionForm {
  name: string;
  diagnosedDate?: Date;
  status: ConditionStatus;
  notes: string;
}

const EMPTY_FORM: ConditionForm = {
  name: '',
  diagnosedDate: undefined,
  status: 'Active',
  notes: '',
};

interface AddConditionSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (input: {
    name: string;
    diagnosedDate: string;
    status: ConditionStatus;
    notes: string;
  }) => Promise<boolean>;
}

export const AddConditionSheet = memo<AddConditionSheetProps>(function AddConditionSheet({
  visible,
  onClose,
  onAdd,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const rules = useProfileFormRules();

  const { control, handleSubmit, reset } = useForm<ConditionForm>({
    defaultValues: EMPTY_FORM,
    mode: 'onBlur',
  });

  // Clear the form each time the sheet opens so a previous draft never leaks in.
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) reset(EMPTY_FORM);
  }, [visible, reset]);

  // The sheet stays open when the save fails, so nothing typed is lost.
  const handleAdd = handleSubmit(async values => {
    setIsSaving(true);
    const added = await onAdd({
      name: values?.name?.trim() ?? '',
      // Raw ISO date — the API stores it and the list formats it for display.
      diagnosedDate: values?.diagnosedDate ? toISODate(values.diagnosedDate) : '',
      status: values?.status ?? 'Active',
      notes: values?.notes?.trim() ?? '',
    });
    setIsSaving(false);
    if (added) onClose();
  });

  return (
    <CustomBottomSheet visible={visible} onClose={onClose} style={styles.sheet}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {t('patientProfile.newCondition')}
        </Text>
        <IconButton icon="close" size={20} onPress={onClose} iconColor={theme.colors.onSurface} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <CustomFormInput
          name="name"
          control={control}
          label={t('patientProfile.conditionName')}
          placeholder={t('patientProfile.conditionNamePlaceholder')}
          leftIcon="pulse"
          rules={rules.condition}
        />

        <CustomFormDatePicker
          name="diagnosedDate"
          control={control}
          label={t('patientProfile.diagnosedDate')}
          placeholder={t('patientProfile.datePlaceholder')}
          maximumDate={new Date()}
        />

        <CustomFormDropdown
          name="status"
          control={control}
          label={t('patientProfile.status')}
          items={CONDITION_STATUSES.map(item => ({
            label: t(`patientProfile.status${item}`),
            value: item,
          }))}
          placeholder={t('patientProfile.statusActive')}
        />

        <CustomFormInput
          name="notes"
          control={control}
          label={t('patientProfile.notes').replace(':', '')}
          placeholder={t('patientProfile.notesPlaceholder')}
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
        <CustomButton
          mode="contained"
          onPress={handleAdd}
          loading={isSaving}
          disabled={isSaving}
          style={styles.actionButton}
        >
          {t('patientProfile.addConditionAction')}
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

export default AddConditionSheet;
