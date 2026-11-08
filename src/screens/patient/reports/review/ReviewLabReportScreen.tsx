import React, { memo, useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  ConfirmLabReportInput,
  DocumentReadRepository,
  ExtractedLabRow,
  ExtractedLabTest,
  LAB_RESULT_STATUSES,
  LOW_CONFIDENCE,
  LabReportType,
  datePart,
  formatLongDate,
  fromISODate,
  guessLabReportType,
  labReportProblem,
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
import { TAB_BAR_CLEARANCE } from '../../../../navigation/tabBarLayout';
import { AiReadNote, ForWhomPicker, ReviewCard, UNSURE, useReviewProfiles } from './ReviewParts';

/** A blank result line, numbered after the last — the portal's "Add line". */
const emptyRow = (serial: number): ExtractedLabRow => ({
  serial,
  groupName: null,
  attribute: '',
  resultValue: null,
  unit: null,
  normalRange: null,
  resultStatus: 'unknown',
  methodName: null,
});

const TYPES: LabReportType[] = ['Pathology', 'Radiology'];

/** One result line to check — amber when the AI was unsure of it. */
const ResultRow = memo<{
  row: ExtractedLabRow;
  onChange: (patch: Partial<ExtractedLabRow>) => void;
  onRemove: () => void;
}>(function ResultRow({ row, onChange, onRemove }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const unsure = theme.dark ? UNSURE.dark : UNSURE.light;
  const isUnsure = (row?.confidence ?? 1) < LOW_CONFIDENCE;
  const status = (LAB_RESULT_STATUSES as readonly string[]).includes(row?.resultStatus ?? '')
    ? row?.resultStatus
    : 'unknown';

  return (
    <View
      style={[
        styles.row,
        isUnsure
          ? { backgroundColor: unsure.tint, borderColor: unsure.border }
          : { backgroundColor: theme.colors.background, borderColor: theme.colors.outlineVariant },
      ]}
    >
      <View style={styles.rowHead}>
        <View style={styles.flex}>
          <CustomInput
            label={t('reports.review.parameter')}
            value={row?.attribute ?? ''}
            onChangeText={text => onChange({ attribute: text ?? '' })}
            compact
          />
        </View>
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('reports.review.removeLine')}
          style={styles.removeLine}
        >
          <Icon name="close-circle-outline" size={20} color={theme.colors.error} />
        </Pressable>
      </View>
      <View style={styles.pair}>
        <CustomInput
          label={t('reports.review.result')}
          value={row?.resultValue ?? ''}
          onChangeText={text => onChange({ resultValue: text || null })}
          style={styles.flex}
          compact
        />
        <CustomInput
          label={t('reports.review.unit.label')}
          value={row?.unit ?? ''}
          onChangeText={text => onChange({ unit: text || null })}
          style={styles.flex}
          compact
        />
      </View>
      <CustomInput
        label={t('reports.review.range')}
        value={row?.normalRange ?? ''}
        onChangeText={text => onChange({ normalRange: text || null })}
        compact
      />
      <View style={styles.statuses}>
        {LAB_RESULT_STATUSES.map(option => {
          const active = option === status;
          return (
            <Pressable
              key={option}
              onPress={() => onChange({ resultStatus: option })}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.status,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                },
              ]}
            >
              <Text style={[styles.statusText, { color: active ? theme.colors.onPrimary : theme.colors.onSurface }]}>
                {t(`reports.review.status.${option}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

/**
 * Reviewing what the AI read off an uploaded lab report, as the portal's
 * review does — whose it is, Pathology or Radiology, the lab and the date, and
 * each test with its result lines, fixed where the read was wrong — and only
 * on Confirm saved to that profile's records. Laid out for a phone: a card
 * per test, a small card per result line.
 */
export const ReviewLabReportScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const months = useMonthNames();
  const { toastStore } = useStores();
  const navigation = useNavigation<NativeStackNavigationProp<ReportsStackParamList>>();
  const route = useRoute<RouteProp<ReportsStackParamList, 'ReviewLabReport'>>();
  const documentId = Number(route?.params?.documentId ?? 0) || 0;
  const extraction = route?.params?.extraction;
  const header = extraction?.header;

  const { profiles, registrationId, setRegistrationId, selected } = useReviewProfiles(route?.params?.registrationId);
  // The kind picked at upload, else the AI's guess — the patient can still change it.
  const [reportType, setReportType] = useState<LabReportType>(
    () => route?.params?.reportType ?? guessLabReportType(extraction?.tests),
  );
  const [labName, setLabName] = useState(header?.labName ?? '');
  const [reportedAt, setReportedAt] = useState(datePart(header?.reportedAt ?? header?.sampleCollectedAt));
  const [tests, setTests] = useState<ExtractedLabTest[]>(() => extraction?.tests ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const rootRef = useRef<View>(null);
  const { overlap, isKeyboardOpen, remeasure } = useKeyboardOverlap(rootRef);
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const changeTest = useCallback((testIndex: number, patch: Partial<ExtractedLabTest>) => {
    setTests(previous => previous.map((test, i) => (i === testIndex ? { ...test, ...patch } : test)));
  }, []);
  const removeTest = useCallback((testIndex: number) => {
    setTests(previous => previous.filter((_, i) => i !== testIndex));
  }, []);
  // An edited line is the patient's word now — no longer marked unsure, as on the portal.
  const changeRow = useCallback((testIndex: number, rowIndex: number, patch: Partial<ExtractedLabRow>) => {
    setTests(previous =>
      previous.map((test, i) =>
        i !== testIndex
          ? test
          : {
              ...test,
              rows: (test?.rows ?? []).map((row, j) => (j === rowIndex ? { ...row, ...patch, confidence: 1 } : row)),
            },
      ),
    );
  }, []);
  const removeRow = useCallback((testIndex: number, rowIndex: number) => {
    setTests(previous =>
      previous.map((test, i) =>
        i !== testIndex ? test : { ...test, rows: (test?.rows ?? []).filter((_, j) => j !== rowIndex) },
      ),
    );
  }, []);
  const addRow = useCallback((testIndex: number) => {
    setTests(previous =>
      previous.map((test, i) =>
        i !== testIndex ? test : { ...test, rows: [...(test?.rows ?? []), emptyRow((test?.rows?.length ?? 0) + 1)] },
      ),
    );
  }, []);

  const leave = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const confirm = useCallback(async () => {
    if (isSaving || !documentId) return;
    const payload: ConfirmLabReportInput = {
      registrationId,
      reportType,
      labName: labName.trim() || null,
      reportId: header?.reportId ?? null,
      referredBy: header?.referredBy ?? null,
      sampleCollectedAt: header?.sampleCollectedAt ?? null,
      // The edited date wins; the AI's time part stays when the date was left as read.
      reportedAt: reportedAt
        ? datePart(header?.reportedAt) === reportedAt
          ? header?.reportedAt ?? reportedAt
          : reportedAt
        : null,
      verifiedBy: header?.verifiedBy ?? null,
      // Blank result lines are dropped, not errors.
      tests: tests.map(test => ({
        ...test,
        rows: (test?.rows ?? []).filter(row => (row?.attribute ?? '').trim().length > 0),
      })),
    };
    const problem = labReportProblem(payload);
    if (problem) {
      toastStore.show(t(`reports.review.problem.${problem === 'forWhom' ? 'forWhomLab' : problem}`), 'error');
      return;
    }
    setIsSaving(true);
    try {
      await DocumentReadRepository.confirmLabReport(documentId, payload);
      toastStore.show(
        t('reports.review.labSaved', {
          type: t(reportType === 'Radiology' ? 'reports.read.typeRadiology' : 'reports.read.typePathology'),
        }),
        'success',
      );
      navigation.navigate('ReportsHome', {
        saved: { section: reportType === 'Radiology' ? 'radiology' : 'pathology', at: Date.now() },
      });
    } catch (e: any) {
      console.log('confirmUploadedLabReport error ==>', e?.message);
      toastStore.show(serverMessageOf(e) || t('reports.review.saveFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, documentId, registrationId, reportType, labName, header, reportedAt, tests, toastStore, t, navigation]);

  const muted = theme.colors.onSurfaceVariant;
  // The Reports tab's bar floats over the bottom: the actions sit above it, as on the doctor's page.
  const footerBottom = isKeyboardOpen ? 10 : insets.bottom + TAB_BAR_CLEARANCE - 24;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View ref={rootRef} onLayout={remeasure} style={[styles.container, { paddingBottom: overlap }]}>
        <ScreenHeader title={t('reports.review.labTitle')} subtitle={t('reports.review.subtitle')} leading="back" />
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

          <ReviewCard title={t('reports.review.details')} icon="flask-outline">
            <Text style={[styles.fieldLabel, { color: theme.colors.onSurface }]}>{`${t('reports.read.reportType')} *`}</Text>
            <View style={styles.types}>
              {TYPES.map(option => {
                const active = option === reportType;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setReportType(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.type,
                      {
                        backgroundColor: active ? theme.colors.primaryContainer : theme.colors.surface,
                        borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                      },
                    ]}
                  >
                    <Icon
                      name={option === 'Radiology' ? 'radiology-box-outline' : 'test-tube'}
                      size={16}
                      color={active ? theme.colors.primary : muted}
                    />
                    <Text style={[styles.typeText, { color: active ? theme.colors.primary : theme.colors.onSurface }]}>
                      {t(option === 'Radiology' ? 'reports.read.typeRadiology' : 'reports.read.typePathology')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <CustomInput
              label={t('reports.review.labName')}
              value={labName}
              onChangeText={text => setLabName(text ?? '')}
              compact
            />
            <CustomDatePicker
              label={t('reports.review.reportDate')}
              value={reportedAt ? fromISODate(reportedAt) : undefined}
              maximumDate={new Date()}
              onChange={picked => {
                if (picked) setReportedAt(toISODate(picked));
              }}
              onClear={() => setReportedAt('')}
              formatString={picked => formatLongDate(toISODate(picked), months)}
            />
          </ReviewCard>

          {tests.map((test, testIndex) => (
            <ReviewCard key={`test-${testIndex}`}>
              <View style={styles.testHead}>
                <View style={styles.flex}>
                  <CustomInput
                    label={`${t('reports.review.testName')} *`}
                    value={test?.testName ?? ''}
                    onChangeText={text => changeTest(testIndex, { testName: text ?? '' })}
                    compact
                  />
                </View>
                <Pressable
                  onPress={() => removeTest(testIndex)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('reports.review.removeTest')}
                  style={styles.removeTest}
                >
                  <Icon name="trash-can-outline" size={20} color={theme.colors.error} />
                </Pressable>
              </View>

              {(test?.rows ?? []).map((row, rowIndex) => (
                <ResultRow
                  key={`row-${testIndex}-${rowIndex}`}
                  row={row}
                  onChange={patch => changeRow(testIndex, rowIndex, patch)}
                  onRemove={() => removeRow(testIndex, rowIndex)}
                />
              ))}
              <CustomButton mode="text" icon="plus" onPress={() => addRow(testIndex)}>
                {t('reports.review.addLine')}
              </CustomButton>

              {/* A written report — a radiology test's findings — as on the portal. */}
              {test?.manualContent || reportType === 'Radiology' ? (
                <CustomInput
                  label={t('reports.review.findings')}
                  value={test?.manualContent ?? ''}
                  onChangeText={text => changeTest(testIndex, { manualContent: text || null })}
                  multiline
                  numberOfLines={4}
                />
              ) : null}
              {test?.interpretation ? (
                <Text style={[styles.impression, { color: muted }]}>
                  <Text style={styles.impressionLabel}>{`${t('reports.review.impression')}: `}</Text>
                  {test.interpretation}
                </Text>
              ) : null}
            </ReviewCard>
          ))}

          {!tests.length ? (
            <View style={[styles.noTests, { borderColor: theme.colors.outlineVariant }]}>
              <Icon name="flask-empty-outline" size={26} color={muted} />
              <Text style={[styles.noTestsText, { color: muted }]}>{t('reports.review.problem.noTests')}</Text>
            </View>
          ) : null}
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
            disabled={isSaving || tests.length === 0}
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
  fieldLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  types: {
    flexDirection: 'row',
    gap: 8,
  },
  type: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
  },
  typeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  testHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  removeTest: {
    paddingTop: 14,
  },
  row: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 2,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  removeLine: {
    paddingTop: 14,
  },
  pair: {
    flexDirection: 'row',
    gap: 8,
  },
  statuses: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  status: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  impression: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
  impressionLabel: {
    fontFamily: fontFamilies.semibold,
  },
  noTests: {
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 20,
  },
  noTestsText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
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

export default ReviewLabReportScreen;
