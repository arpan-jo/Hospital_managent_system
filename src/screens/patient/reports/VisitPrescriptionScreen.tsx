import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import { MedicalRecordRepository, PatientProfile, PatientRepository } from '@app/core';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { ReportsStackParamList } from '../../../navigation/ReportsStackNavigator';
import {
  doctorTitle,
  prescribedOn,
  prescriptionDay,
  prescriptionKindKey,
  prescriptionTitle,
} from '../myPrescriptions/prescriptionUi';
import { DetailNote, RecordDetailScreen, useRecordDetail } from './RecordDetail';
import {
  PadBody,
  PadEmpty,
  PadFooter,
  PadLetterhead,
  PadPaper,
  PadPatient,
  PadRx,
  PadSection,
  PadSignature,
  PadVitals,
} from './PrescriptionPad';
import { ageOnDay, splitPadSections, takeVitals } from './prescriptionPadUi';
import PrescriptionZoomModal from './PrescriptionZoomModal';
import { formatRecordDate, formatRecordTime } from './reportsUi';

/**
 * The account's own profile for the prescription's patient — for the age, sex
 * and blood group a printed sheet carries and the prescription API does not.
 * Nothing when it cannot be read: the sheet is drawn without them.
 */
const usePrescriptionPatient = (registrationId?: number | null): PatientProfile | null => {
  const [profile, setProfile] = useState<PatientProfile | null>(null);

  useEffect(() => {
    if (!registrationId) return;
    let isCurrent = true;
    PatientRepository.getAllProfiles()
      .then(rows => {
        if (!isCurrent) return;
        setProfile((rows ?? []).find(row => (row?.registrationId ?? 0) === registrationId) ?? null);
      })
      .catch((e: any) => console.log('getAllProfiles (prescription) error ==>', e?.message));
    return () => {
      isCurrent = false;
    };
  }, [registrationId]);

  return profile;
};

/**
 * One visit prescription in full, as the portal's Reports page opens it — the
 * same API and the same content, drawn as the pad a patient is handed:
 * letterhead, the patient's lines, vitals and findings in the left margin
 * column, ℞ and instructions on the right, and the doctor's name where it is
 * signed. Below this width the two columns run one under the other.
 */
const TWO_COLUMN_MIN_WIDTH = 340;

export const VisitPrescriptionScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const months = useMonthNames();
  const { width } = useWindowDimensions();
  /** The sheet opened on its own to pinch in on. */
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const route = useRoute<RouteProp<ReportsStackParamList, 'VisitPrescription'>>();
  const params = route?.params;
  const prescriptionId = params?.prescriptionId ?? 0;
  const detail = useRecordDetail(MedicalRecordRepository.getPrescription, prescriptionId);
  const rx = detail?.data;
  const patient = usePrescriptionPatient(rx?.patientRegistrationId);

  // The detail call leaves these unset; the list said which it is.
  const isUploaded = !!rx?.isUploaded || !!params?.isUploaded;
  const sourceHospitalName = rx?.sourceHospitalName || params?.sourceHospitalName || '';
  const sheet = rx ? { ...rx, isUploaded, sourceHospitalName } : null;

  // An upload may have no doctor (and before 2026-11-10 no code) — it is named for what it is.
  const fallbackName = t(isUploaded ? 'reports.uploadedPrescription' : 'reports.prescription');
  const medicines = rx?.medicines ?? [];

  const { vitals, findings, instructions } = useMemo(() => {
    const read = takeVitals(rx?.sections);
    return { vitals: read?.vitals ?? [], ...splitPadSections(read?.sections) };
  }, [rx?.sections]);

  const title = prescriptionTitle(sheet, fallbackName);
  // An upload's sheet names its hospital or chamber; a visit, the department.
  const subtitle = isUploaded
    ? sourceHospitalName && sourceHospitalName !== title
      ? sourceHospitalName
      : ''
    : rx?.departmentName ?? '';

  const age = ageOnDay(patient?.dateOfBirth, prescriptionDay(rx?.prescribedAt));
  const gender = (patient?.gender ?? '').trim();
  const isEmpty = !medicines.length && !vitals.length && !findings.length && !instructions.length;
  // An upload was not signed by an HMS doctor — there is no place for a signature on it.
  const signer = isUploaded ? '' : doctorTitle(rx?.doctorName);
  const hasLeft = vitals.length > 0 || findings.length > 0;
  const twoColumns = hasLeft && (width ?? 0) >= TWO_COLUMN_MIN_WIDTH;

  const ageText = age
    ? age.years > 0
      ? t('reports.pad.ageYears', { count: age.years })
      : t('reports.pad.ageMonths', { count: age.months })
    : '';
  const sexText = gender ? t(`patientProfile.gender_${gender.toLowerCase()}`, { defaultValue: gender }) : '';
  // An upload's date is when it was saved — it has no time worth showing.
  const time = isUploaded ? '' : formatRecordTime(rx?.prescribedAt);

  // Drawn twice from the one element: in the page, and alone in the zoom view.
  const sheetView = rx ? (
    <PadPaper>
      <PadLetterhead title={title} subtitle={subtitle} />

      <PadPatient
        rows={[
          [
            { label: t('reports.pad.name'), value: rx?.patientName || patient?.fullName || '', flex: 2.3 },
            { label: t('reports.pad.age'), value: ageText, flex: 1 },
          ],
          [
            { label: t('reports.pad.sex'), value: sexText, flex: 1 },
            { label: t('reports.pad.blood'), value: patient?.bloodType ?? '', flex: 1 },
            { label: t('reports.pad.date'), value: formatRecordDate(prescribedOn(rx), months), flex: 1.6 },
          ],
          [
            { label: t('reports.patientId'), value: rx?.patientCode ?? '', flex: 1.5 },
            {
              label: t('reports.visit'),
              value: [t(prescriptionKindKey(sheet)), time].filter(Boolean).join(', '),
              flex: 1.2,
            },
          ],
        ]}
      />

      <PadBody
        twoColumns={twoColumns}
        left={
          hasLeft ? (
            <>
              <PadVitals vitals={vitals} inline={!twoColumns} />
              {findings.map((section, index) => (
                <PadSection key={`${section?.key ?? ''}-${index}`} section={section} />
              ))}
            </>
          ) : null
        }
        right={
          <>
            <PadRx medicines={medicines} />
            {instructions.map((section, index) => (
              <PadSection key={`${section?.key ?? ''}-${index}`} section={section} />
            ))}
            {isEmpty ? <PadEmpty>{t('reports.noPrescriptionDetails')}</PadEmpty> : null}
            <PadSignature name={signer} meta={rx?.departmentName ?? ''} />
          </>
        }
      />

      <PadFooter code={rx?.code ?? ''} count={medicines.length} />
    </PadPaper>
  ) : null;

  return (
    <RecordDetailScreen
      title={rx?.code || params?.title || fallbackName}
      subtitle={[rx?.patientName, formatRecordDate(prescribedOn(rx), months)].filter(Boolean).join(' · ')}
      isLoading={detail?.isLoading}
      isRefreshing={detail?.isRefreshing}
      error={detail?.error}
      errorFallback={t('reports.prescriptionOpenFailed')}
      onRetry={detail?.retry}
      onRefresh={detail?.refresh}
      headerRight={
        rx ? (
          <Pressable
            onPress={() => setIsZoomOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('reports.pad.zoom')}
            style={[styles.zoomButton, { backgroundColor: theme.colors.primaryContainer }]}
          >
            <Icon name="magnify-plus-outline" size={20} color={theme.colors.primary} />
          </Pressable>
        ) : null
      }
    >
      {rx ? (
        <>
          {sheetView}

          <DetailNote icon="stethoscope">{t('reports.prescriptionDisclaimer')}</DetailNote>

          <PrescriptionZoomModal
            visible={isZoomOpen}
            title={rx?.code || params?.title || fallbackName}
            onClose={() => setIsZoomOpen(false)}
          >
            {sheetView}
          </PrescriptionZoomModal>
        </>
      ) : null}
    </RecordDetailScreen>
  );
};

const styles = StyleSheet.create({
  zoomButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VisitPrescriptionScreen;
