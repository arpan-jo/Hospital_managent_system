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
  ALL_SPECIALTIES,
  AVAILABILITY_THIS_WEEK,
  AVAILABILITY_TODAY,
  DEFAULT_FILTERS,
  DoctorFilters,
} from './useFindDoctorsViewModel';
import FilterSelect from './FilterSelect';

interface FilterBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: DoctorFilters;
  specialties: string[];
  locations: string[];
  onApply: (filters: DoctorFilters) => void;
  onReset: () => void;
}

export const FilterBottomSheet = memo<FilterBottomSheetProps>(
  function FilterBottomSheet({
    visible,
    onClose,
    filters,
    specialties,
    locations,
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

    const specialtyItems: DropdownItem[] = useMemo(
      () =>
        specialties?.map(specialty => ({
          label: specialty?.trim() || specialty,
          value: specialty === ALL_SPECIALTIES ? '' : specialty,
        })) ?? [],
      [specialties],
    );

    const locationItems: DropdownItem[] = useMemo(
      () => [
        { label: t('findDoctors.allLocations'), value: '' },
        ...(locations?.map(location => ({
          label: location?.trim() || location,
          value: location,
        })) ?? []),
      ],
      [t, locations],
    );

    const availabilityItems: DropdownItem[] = useMemo(
      () => [
        { label: t('findDoctors.anyTime'), value: '' },
        { label: t('findDoctors.availableToday'), value: AVAILABILITY_TODAY },
        {
          label: t('findDoctors.availableThisWeek'),
          value: AVAILABILITY_THIS_WEEK,
        },
      ],
      [t],
    );

    const genderItems: DropdownItem[] = useMemo(
      () => [
        { label: t('findDoctors.anyGender'), value: '' },
        { label: t('findDoctors.male'), value: 'Male' },
        { label: t('findDoctors.female'), value: 'Female' },
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
              {t('findDoctors.reset')}
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
            name="specialty"
            render={({ field: { value, onChange } }) => (
              <FilterSelect
                label={t('findDoctors.specialty')}
                value={value ?? ''}
                items={specialtyItems}
                placeholder={t('findDoctors.allSpecialties')}
                onChange={onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="location"
            render={({ field: { value, onChange } }) => (
              <FilterSelect
                label={t('findDoctors.location')}
                value={value ?? ''}
                items={locationItems}
                placeholder={t('findDoctors.allLocations')}
                onChange={onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="availability"
            render={({ field: { value, onChange } }) => (
              <FilterSelect
                label={t('findDoctors.availability')}
                value={value ?? ''}
                items={availabilityItems}
                placeholder={t('findDoctors.anyTime')}
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
