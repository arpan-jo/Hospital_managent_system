import React, { memo, useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  CustomBottomSheet,
  CustomButton,
  DropdownItem,
  fontFamilies,
} from '@app/ui';
import {
  DEFAULT_FILTERS,
  DoctorFilters,
  TODAY_OPTION,
} from './useFindDoctorsViewModel';
import FilterSelect from './FilterSelect';
import { DAY_ORDER, dayIndexOf } from './weekdays';

interface FilterBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: DoctorFilters;
  /** The API's own department names — a chosen one is sent back exactly as listed. */
  departments: string[];
  genders: string[];
  onApply: (filters: DoctorFilters) => void;
  onReset: () => void;
}

export const FilterBottomSheet = memo<FilterBottomSheetProps>(
  function FilterBottomSheet({
    visible,
    onClose,
    filters,
    departments,
    genders,
    onApply,
    onReset,
  }) {
    const theme = useTheme();
    const { t } = useTranslation();

    const { control, handleSubmit, reset } = useForm<DoctorFilters>({
      defaultValues: filters ?? DEFAULT_FILTERS,
      mode: 'onChange',
    });

    useEffect(() => {
      if (visible) reset(filters ?? DEFAULT_FILTERS);
    }, [visible, filters, reset]);

    const departmentItems: DropdownItem[] = useMemo(
      () => [
        { label: t('findDoctors.allDepartments'), value: '' },
        ...(departments?.map(department => ({
          label: department?.trim() || department,
          value: department,
        })) ?? []),
      ],
      [t, departments],
    );

    const genderItems: DropdownItem[] = useMemo(
      () => [
        { label: t('findDoctors.anyGender'), value: '' },
        ...(genders?.map(gender => ({ label: gender, value: gender })) ?? []),
      ],
      [t, genders],
    );

    const dayItems: DropdownItem[] = useMemo(
      () => [
        { label: t('findDoctors.anyDay'), value: '' },
        { label: t('findDoctors.today'), value: TODAY_OPTION },
        ...DAY_ORDER.map(day => ({
          label: t(`days.${dayIndexOf(day)}`),
          value: day,
        })),
      ],
      [t],
    );

    const handleReset = () => {
      reset(DEFAULT_FILTERS);
      onReset();
      onClose();
    };

    const handleApply = handleSubmit(values =>
      onApply({ ...DEFAULT_FILTERS, ...values }),
    );

    return (
      <CustomBottomSheet
        visible={visible}
        onClose={onClose}
        style={styles.sheet}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            {t('findDoctors.filterTitle')}
          </Text>
          <Pressable onPress={handleReset} hitSlop={8}>
            <Text style={[styles.reset, { color: theme.colors.primary }]}>
              {t('findDoctors.clearFilters')}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.body}
        >
          <Controller
            control={control}
            name="department"
            render={({ field: { value, onChange } }) => (
              <FilterSelect
                label={t('findDoctors.department')}
                value={value ?? ''}
                items={departmentItems}
                placeholder={t('findDoctors.allDepartments')}
                onChange={onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="gender"
            render={({ field: { value, onChange } }) => (
              <FilterSelect
                label={t('findDoctors.gender')}
                value={value ?? ''}
                items={genderItems}
                placeholder={t('findDoctors.anyGender')}
                onChange={onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="day"
            render={({ field: { value, onChange } }) => (
              <FilterSelect
                label={t('findDoctors.availableOn')}
                value={value ?? ''}
                items={dayItems}
                placeholder={t('findDoctors.anyDay')}
                onChange={onChange}
              />
            )}
          />
        </ScrollView>

        <View style={styles.actions}>
          <CustomButton
            mode="outlined"
            onPress={onClose}
            style={[styles.actionButton, { borderColor: theme.colors.primary }]}
            textColor={theme.colors.primary}
          >
            {t('common.cancel')}
          </CustomButton>
          <CustomButton
            mode="contained"
            onPress={handleApply}
            style={styles.actionButton}
          >
            {t('findDoctors.applyFilters')}
          </CustomButton>
        </View>
      </CustomBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
  },
  reset: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  body: {
    paddingBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    marginVertical: 0,
    paddingVertical: 3,
    borderRadius: 999,
  },
});

export default FilterBottomSheet;
