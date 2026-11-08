import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  ConfirmPrescriptionInput,
  DURATION_UNITS,
  DocumentReadRepository,
  ExtractedRxItem,
  LOW_CONFIDENCE,
  datePart,
  formatLongDate,
  fromISODate,
  prescriptionProblem,
  serverMessageOf,
  toISODate,
  useStores,
} from '@app/core';
import { CustomButton, CustomDatePicker, CustomInput, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../../hooks/useFocusedStatusBar';
import { useKeyboardOverlap } from '../../../../hooks/useKeyboardOverlap';
import { useMonthNames } from '../../../../hooks/useMonthNames';
import { ReportsStackParamList } from '../../../../navigation/ReportsStackNavigator';
import { AiReadNote, ForWhomPicker, ReviewCard, UNSURE, useReviewProfiles } from './ReviewParts';

/** A blank medicine line, as the portal's "Add medicine" makes it. */
const emptyItem = (): ExtractedRxItem => ({
  type: null,
  generic: null,
  brand: '',
  route: null,
  dose: null,
  durationValue: null,
  durationUnit: 'Days',
  isContinue: false,
  isMixed: false,
  note: null,
  multiDose: null,
});

/** The other parts of the sheet the AI read — shown, and saved as read. */
const SECTION_KEYS = ['chiefComplaint', 'diagnosis', 'investigation', 'advice', 'followUp'];

/** A section's lines: each entry's `name`, blanks left out — the portal's reading. */
const sectionLines = (sections: Record<string, unknown> | null | undefined, key: string): string[] => {
  const value = sections?.[key];
  if (!Array.isArray(value)) return [];
  return value
    .map(item => (item && typeof item === 'object' && 'name' in item ? String((item as any)?.name ?? '') : ''))
    .filter(line => line.trim().length > 0);
};

/** One medicine to check: its name, dose, how long, a note — amber when the AI was unsure. */
const MedicineCard = memo<{
  item: ExtractedRxItem;
  index: number;
  onChange: (index: number, patch: Partial<ExtractedRxItem>) => void;
  onRemove: (index: number) => void;
}>(function MedicineCard({ item, index, onChange, onRemove }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const unsure = theme.dark ? UNSURE.dark : UNSURE.light;
  const isUnsure = (item?.confidence ?? 1) < LOW_CONFIDENCE;
  const unit = item?.durationUnit ?? '';
  // A unit the AI read that the list does not have is kept as a choice, as on the portal.
  const units = unit && !DURATION_UNITS.includes(unit) ? [...DURATION_UNITS, unit] : DURATION_UNITS;

  return (
    <View
      style={[
        styles.medicine,
        isUnsure
          ? { backgroundColor: unsure.tint, borderColor: unsure.border }
          : { backgroundColor: theme.colors.background, borderColor: theme.colors.outlineVariant },
      ]}
    >
      <View style={styles.medicineHead}>
        <Text style={[styles.medicineNumber, { color: theme.colors.primary }]}>{`#${index + 1}`}</Text>
        {isUnsure ? (
          <View style={[styles.checkBadge, { borderColor: unsure.border }]}>
            <Icon name="alert-outline" size={12} color={unsure.ink} />
            <Text style={[styles.checkText, { color: unsure.ink }]}>{t('reports.review.checkThis')}</Text>
          </View>
        ) : null}
        <View style={styles.flex} />
        <Pressable
          onPress={() => onRemove(index)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('reports.review.removeMedicine')}
        >
          <Icon name="trash-can-outline" size={20} color={theme.colors.error} />
        </Pressable>
      </View>

      <CustomInput
        label={t('reports.review.medicineName')}
        value={item?.brand ?? ''}
        onChangeText={text => onChange(index, { brand: text ?? '' })}
        compact
      />
      <View style={styles.row}>
        <CustomInput
          label={t('reports.review.dose')}
          value={item?.dose ?? ''}
          onChangeText={text => onChange(index, { dose: text || null })}
          style={styles.flex}
          compact
        />
        <CustomInput
          label={t('reports.review.duration')}
          value={item?.durationValue ?? ''}
          onChangeText={text => onChange(index, { durationValue: text || null })}
          keyboardType="numeric"
          style={styles.duration}
          compact
        />
      </View>
      <View style={styles.units}>
        {units.map(option => {
          const active = option === unit;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(index, { durationUnit: active ? null : option })}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.unit,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                },
              ]}
            >
              <Text style={[styles.unitText, { color: active ? theme.colors.onPrimary : theme.colors.onSurface }]}>
                {t(`reports.review.unit.${option.toLowerCase()}`, { defaultValue: option })}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <CustomInput
        label={t('reports.review.note')}
        value={item?.note ?? ''}
        onChangeText={text => onChange(index, { note: text || null })}
        compact
      />
      <Pressable
        onPress={() => onChange(index, { isContinue: !item?.isContinue })}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!item?.isContinue }}
        style={styles.continueRow}
      >
        <Icon
          name={item?.isContinue ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={20}
          color={item?.isContinue ? theme.colors.primary : theme.colors.outline}
        />
        <Text style={[styles.continueText, { color: theme.colors.onSurfaceVariant }]}>
          {t('reports.review.continue')}
        </Text>
      </Pressable>
    </View>
  );
});

/**
 * Reviewing what the AI read off an uploaded prescription, as the portal's
 * review does — whose it is, the doctor, the hospital, the date and each
 * medicine, fixed where the read was wrong — and only on Confirm saved to that
 * profile. Laid out for a phone: a card per medicine, the actions pinned to
 * the bottom above the keyboard.
 */
export const ReviewPrescriptionScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const months = useMonthNames();
  const { toastStore } = useStores();
  const navigation = useNavigation<NativeStackNavigationProp<ReportsStackParamList>>();
  const route = useRoute<RouteProp<ReportsStackParamList, 'ReviewPrescription'>>();
  const documentId = Number(route?.params?.documentId ?? 0) || 0;
  const extraction = route?.params?.extraction;
  const header = extraction?.header;

  const { profiles, registrationId, setRegistrationId, selected } = useReviewProfiles(route?.params?.registrationId);
  const [doctorName, setDoctorName] = useState(header?.doctorName ?? '');
  const [hospitalName, setHospitalName] = useState(header?.hospitalName ?? '');
  const [prescriptionDate, setPrescriptionDate] = useState(datePart(header?.prescriptionDate));
  const [items, setItems] = useState<ExtractedRxItem[]>(() =>
    extraction?.rx?.length ? extraction.rx : [emptyItem()],
  );
  const [isSaving, setIsSaving] = useState(false);
  const rootRef = useRef<View>(null);
  const { overlap, isKeyboardOpen, remeasure } = useKeyboardOverlap(rootRef);
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  // An edited line is the patient's word now — no longer marked unsure, as on the portal.
  const changeItem = useCallback((index: number, patch: Partial<ExtractedRxItem>) => {
    setItems(previous => previous.map((item, i) => (i === index ? { ...item, ...patch, confidence: 1 } : item)));
  }, []);
  const removeItem = useCallback((index: number) => {
    setItems(previous => previous.filter((_, i) => i !== index));
  }, []);
  const addItem = useCallback(() => setItems(previous => [...previous, emptyItem()]), []);

  const sections = useMemo(
    () =>
      SECTION_KEYS.map(key => ({ key, lines: sectionLines(extraction?.sections, key) })).filter(
        section => section.lines.length > 0,
      ),
    [extraction?.sections],
  );

  const leave = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const confirm = useCallback(async () => {
    if (isSaving || !documentId) return;
    const payload: ConfirmPrescriptionInput = {
      registrationId,
      doctorName: doctorName.trim() || null,
      departmentName: header?.departmentName ?? null,
      hospitalName: hospitalName.trim() || null,
      prescriptionDate: prescriptionDate || null,
      // A row left blank is just dropped, not an error.
      items: items.filter(item => (item?.brand ?? '').trim().length > 0),
      sections: extraction?.sections ?? null,
    };
    const problem = prescriptionProblem(payload);
    if (problem) {
      toastStore.show(t(`reports.review.problem.${problem === 'forWhom' ? 'forWhomRx' : problem}`), 'error');
      return;
    }
    setIsSaving(true);
    try {
      await DocumentReadRepository.confirmPrescription(documentId, payload);
      toastStore.show(t('reports.review.rxSaved'), 'success');
      navigation.navigate('ReportsHome', { saved: { section: 'prescriptions', at: Date.now() } });
    } catch (e: any) {
      console.log('confirmUploadedPrescription error ==>', e?.message);
      toastStore.show(serverMessageOf(e) || t('reports.review.saveFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    documentId,
    registrationId,
    doctorName,
    header?.departmentName,
    hospitalName,
    prescriptionDate,
    items,
    extraction?.sections,
    toastStore,
    t,
    navigation,
  ]);

  const footerBottom = isKeyboardOpen ? 10 : insets.bottom + 10;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View ref={rootRef} onLayout={remeasure} style={[styles.container, { paddingBottom: overlap }]}>
        <ScreenHeader title={t('reports.review.rxTitle')} subtitle={t('reports.review.subtitle')} leading="back" />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AiReadNote />

          <ForWhomPicker
            profiles={profiles}
            registrationId={registrationId}
            onPick={setRegistrationId}
            sheetName={header?.patientName}
            selectedName={selected?.fullName}
          />

          <ReviewCard title={t('reports.review.details')} icon="doctor">
            <CustomInput
              label={t('reports.review.doctor')}
              value={doctorName}
              onChangeText={text => setDoctorName(text ?? '')}
              compact
            />
            <CustomInput
              label={t('reports.review.hospital')}
              value={hospitalName}
              onChangeText={text => setHospitalName(text ?? '')}
              compact
            />
            <CustomDatePicker
              label={t('reports.review.date')}
              value={prescriptionDate ? fromISODate(prescriptionDate) : undefined}
              maximumDate={new Date()}
              onChange={picked => {
                if (picked) setPrescriptionDate(toISODate(picked));
              }}
              onClear={() => setPrescriptionDate('')}
              formatString={picked => formatLongDate(toISODate(picked), months)}
            />
          </ReviewCard>

          <ReviewCard
            title={t('reports.review.medicines')}
            icon="pill"
            right={<Text style={[styles.count, { color: theme.colors.onSurfaceVariant }]}>{items.length}</Text>}
          >
            {items.map((item, index) => (
              <MedicineCard key={`rx-${index}`} item={item} index={index} onChange={changeItem} onRemove={removeItem} />
            ))}
            <CustomButton mode="outlined" icon="plus" onPress={addItem} style={styles.addButton}>
              {t('reports.review.addMedicine')}
            </CustomButton>
          </ReviewCard>

          {sections.map(section => (
            <ReviewCard key={section.key} title={t(`reports.review.section.${section.key}`)} icon="text-box-outline">
              {section.lines.map((line, index) => (
                <View key={`${section.key}-${index}`} style={styles.line}>
                  <View style={[styles.bullet, { backgroundColor: theme.colors.primary }]} />
                  <Text style={[styles.lineText, { color: theme.colors.onSurfaceVariant }]}>{line}</Text>
                </View>
              ))}
            </ReviewCard>
          ))}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.outlineVariant,
              paddingBottom: footerBottom,
            },
          ]}
        >
          <CustomButton mode="outlined" onPress={leave} disabled={isSaving} style={[styles.flex, styles.footerButton]}>
            {t('reports.review.notNow')}
          </CustomButton>
          <CustomButton
            mode="contained"
            icon="check"
            onPress={confirm}
            loading={isSaving}
            disabled={isSaving}
            style={[styles.flex, styles.footerButton]}
          >
            {t('reports.review.confirm')}
          </CustomButton>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  count: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  medicine: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  medicineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  medicineNumber: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
  },
  checkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  checkText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  duration: {
    width: 110,
  },
  units: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  unit: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  unitText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
  },
  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  continueText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  addButton: {
    borderRadius: 12,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 8,
  },
  lineText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    borderRadius: 12,
  },
});

export default ReviewPrescriptionScreen;
