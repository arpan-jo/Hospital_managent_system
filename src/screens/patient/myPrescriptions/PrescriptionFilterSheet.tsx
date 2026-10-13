import React, { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { formatShortDate } from '@app/core';
import {
  CustomBottomSheet,
  CustomButton,
  CustomDatePicker,
  CustomDropdown,
  CustomInput,
  DropdownItem,
  fontFamilies,
} from '@app/ui';
import { EMPTY_FILTERS, PrescriptionFilters } from './useMyPrescriptionsViewModel';

interface PrescriptionFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: PrescriptionFilters;
  doctors: { id: string; name: string }[];
  onApply: (filters: PrescriptionFilters) => void;
  onReset: () => void;
}

export const PrescriptionFilterSheet = memo<PrescriptionFilterSheetProps>(
  function PrescriptionFilterSheet({ visible, onClose, filters, doctors, onApply, onReset }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const [draft, setDraft] = useState<PrescriptionFilters>(filters);

    // Re-seeds the draft from the last applied filters each time the sheet opens.
    useEffect(() => {
      if (visible) setDraft(filters);
    }, [visible, filters]);

    const doctorItems: DropdownItem<string>[] = useMemo(
      () => [
        { label: t('myPrescriptions.allDoctors'), value: '' },
        ...(doctors ?? []).map(doctor => ({
          label: doctor?.name ?? '',
          value: doctor?.id ?? '',
        })),
      ],
      [t, doctors],
    );

    const handleReset = () => {
      setDraft(EMPTY_FILTERS);
      onReset();
    };

    const handleApply = () => onApply(draft);

    return (
      <CustomBottomSheet visible={visible} onClose={onClose} style={styles.sheet}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            {t('myPrescriptions.filterTitle')}
          </Text>
          <Pressable onPress={handleReset} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.reset, { color: theme.colors.primary }]}>
              {t('myPrescriptions.reset')}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.body}
        >
          <CustomDropdown
            label={t('myPrescriptions.doctor')}
            items={doctorItems}
            value={draft?.doctorId ?? ''}
            placeholder={t('myPrescriptions.allDoctors')}
            onValueChange={value => setDraft(prev => ({ ...prev, doctorId: value }))}
          />

          {/*
            Name / code search runs on the client: `GET /api/prescriptions` takes
            only a doctor and a date range, no patient filter of any kind.
          */}
          <CustomInput
            label={t('myPrescriptions.patientOrMember')}
            value={draft?.patientQuery ?? ''}
            onChangeText={value => setDraft(prev => ({ ...prev, patientQuery: value }))}
            placeholder={t('myPrescriptions.patientPlaceholder')}
            leftIcon="magnify"
          />

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <CustomDatePicker
                label={t('myPrescriptions.fromDate')}
                value={draft.fromDate ?? undefined}
                maximumDate={draft.toDate ?? undefined}
                placeholder={t('myPrescriptions.datePlaceholder')}
                formatString={formatShortDate}
                onChange={value => setDraft(prev => ({ ...prev, fromDate: value }))}
              />
            </View>
            <View style={styles.dateField}>
              <CustomDatePicker
                label={t('myPrescriptions.toDate')}
                value={draft.toDate ?? undefined}
                minimumDate={draft.fromDate ?? undefined}
                placeholder={t('myPrescriptions.datePlaceholder')}
                formatString={formatShortDate}
                onChange={value => setDraft(prev => ({ ...prev, toDate: value }))}
              />
            </View>
          </View>
        </ScrollView>

        {/* No bottom padding here — CustomBottomSheet already applies the safe-area gap. */}
      <View style={styles.actions}>
          <CustomButton
            mode="outlined"
            onPress={onClose}
            style={[styles.actionButton, { borderColor: theme.colors.primary }]}
            textColor={theme.colors.primary}
          >
            {t('common.cancel')}
          </CustomButton>
          <CustomButton mode="contained" onPress={handleApply} style={styles.actionButton}>
            {t('myPrescriptions.applyFilters')}
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
    marginBottom: 16,
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
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: {
    flex: 1,
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

export default PrescriptionFilterSheet;
