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
import { doctorTitle } from './prescriptionUi';

interface PrescriptionFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: PrescriptionFilters;
  /** The doctors on the list, by name. */
  doctors: string[];
  onApply: (filters: PrescriptionFilters) => void;
}

/** The portal's filters — doctor, a search and dates — applied together on Apply. */
export const PrescriptionFilterSheet = memo<PrescriptionFilterSheetProps>(
  function PrescriptionFilterSheet({ visible, onClose, filters, doctors, onApply }) {
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
        ...(doctors ?? []).map(name => ({ label: doctorTitle(name), value: name })),
      ],
      [t, doctors],
    );

    // Clears the form only; Apply decides.
    const handleReset = () => setDraft(EMPTY_FILTERS);

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
            value={draft?.doctorName ?? ''}
            placeholder={t('myPrescriptions.allDoctors')}
            onValueChange={value => setDraft(prev => ({ ...prev, doctorName: value }))}
          />

          <CustomInput
            label={t('myPrescriptions.patientOrMember')}
            value={draft?.query ?? ''}
            onChangeText={value => setDraft(prev => ({ ...prev, query: value }))}
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
