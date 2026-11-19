import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import {
  MedicalRecordRepository,
  scheduleFollowUpReminders,
  // PatientProfile, // the old three-call hooks below
  // PatientRepository,
  // PrescriptionPrintData,
} from '@app/core';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { ReportsStackParamList } from '../../../navigation/ReportsStackNavigator';
import {
  doctorTitle,
  // prescribedOn, — off with the commented-out lines that used it (2026-11-16)
  prescriptionDay,
  prescriptionKindKey,
  prescriptionTitle,
} from '../myPrescriptions/prescriptionUi';
import { DetailNote, RecordDetailScreen, useRecordDetail } from './RecordDetail';
import {
  PadBody,
  PadEmpty,
  PadFooter,
  PadHospitalName,
  PadLetterhead,
  PadPaper,
  PadPatient,
  PadRx,
  PadSection,
  PadSignature,
  PadVitals,
} from './PrescriptionPad';
import { ageOnDay, arrangePadSections, sheetDate, splitHeaderColumns, takeVitals } from './prescriptionPadUi';
import PrescriptionZoomModal from './PrescriptionZoomModal';
import { formatRecordDate, formatRecordTime } from './reportsUi';

// Off (2026-11-15): the sheet was drawn from three calls — GetPrescription,
// the account's profiles (age, sex, blood group) and the print data. It now
// comes whole from GetPrescriptionPrintData; uncomment these (and their imports)
// to go back.
// /**
//  * The account's own profile for the prescription's patient — for the age, sex
//  * and blood group a printed sheet carries and the prescription API does not.
//  * Nothing when it cannot be read: the sheet is drawn without them.
//  */
// const usePrescriptionPatient = (registrationId?: number | null): PatientProfile | null => {
//   const [profile, setProfile] = useState<PatientProfile | null>(null);
//
//   useEffect(() => {
//     if (!registrationId) return;
//     let isCurrent = true;
//     PatientRepository.getAllProfiles()
//       .then(rows => {
//         if (!isCurrent) return;
//         setProfile((rows ?? []).find(row => (row?.registrationId ?? 0) === registrationId) ?? null);
//       })
//       .catch((e: any) => console.log('getAllProfiles (prescription) error ==>', e?.message));
//     return () => {
//       isCurrent = false;
//     };
//   }, [registrationId]);
//
//   return profile;
// };
//
// /**
//  * The rest of what the printed sheet is drawn from — the patient's mobile and
//  * address, the doctor's own section order, the hospital's footer line and the
//  * signatory (GetPrescriptionPrintData, asked under the static Mediplex account
//  * and branch). Nothing when it cannot be read — a 404 for a prescription under
//  * another tenant, say — and the sheet is drawn from the prescription alone.
//  */
// const usePrescriptionPrintData = (prescriptionId?: number | null): PrescriptionPrintData | null => {
//   const [data, setData] = useState<PrescriptionPrintData | null>(null);
//
//   useEffect(() => {
//     if (!prescriptionId) return;
//     let isCurrent = true;
//     MedicalRecordRepository.getPrescriptionPrintData(prescriptionId)
//       .then(result => {
//         if (isCurrent) setData(result ?? null);
//       })
//       .catch((e: any) => console.log('getPrescriptionPrintData error ==>', e?.message));
//     return () => {
//       isCurrent = false;
//     };
//   }, [prescriptionId]);
//
//   return data;
// };

/**
 * One visit prescription in full, from GetPrescriptionPrintData alone (the
 * content the portal's Reports page shows, flattened the same way), drawn as the
 * pad a patient is handed:
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
  // Off (2026-11-15) — the three calls the sheet was drawn from:
  // const detail = useRecordDetail(MedicalRecordRepository.getPrescription, prescriptionId);
  // const rx = detail?.data;
  // const patient = usePrescriptionPatient(rx?.patientRegistrationId);
  // const print = usePrescriptionPrintData(prescriptionId);

  // The whole sheet from one call: GetPrescriptionPrintData.
  const detail = useRecordDetail(MedicalRecordRepository.getPrescriptionPrintData, prescriptionId);
  const print = detail?.data;
  const rx = print?.prescription;

  // The print data has no visit type; the list it was opened from says which.
  const isUploaded = !!rx?.isUploaded || !!print?.isPatientUpload || !!params?.isUploaded;
  const sourceHospitalName = rx?.sourceHospitalName || params?.sourceHospitalName || '';
  const sheet = rx
    ? { ...rx, isUploaded, sourceHospitalName, visitType: params?.visitType ?? rx?.visitType ?? 'opd' }
    : null;

  // An upload may have no doctor (and before 2026-11-10 no code) — it is named for what it is.
  const fallbackName = t(isUploaded ? 'reports.uploadedPrescription' : 'reports.prescription');
  const medicines = rx?.medicines ?? [];

  // The doctor's own order when the print data has it; the fixed split until then.
  const leftKeys = print?.leftSectionKeys;
  const rightKeys = print?.rightSectionKeys;
  const { vitals, findings, rightItems } = useMemo(() => {
    const read = takeVitals(rx?.sections);
    const arranged = arrangePadSections(read?.sections, { left: leftKeys, right: rightKeys });
    return { vitals: read?.vitals ?? [], findings: arranged?.left ?? [], rightItems: arranged?.right ?? ['rx'] };
  }, [rx?.sections, leftKeys, rightKeys]);
  const instructions = rightItems.filter(item => item !== 'rx');

  const title = prescriptionTitle(sheet, fallbackName);
  // An upload's sheet names its hospital or chamber; a visit, the department.
  const subtitle = isUploaded
    ? sourceHospitalName && sourceHospitalName !== title
      ? sourceHospitalName
      : ''
    : rx?.departmentName ?? '';

  // The sheet's day: an upload's own date on the paper, else when it was written (2026-11-16).
  // Off: the upload day for an upload too — prescribedOn(rx) / rx?.prescribedAt.
  const writtenOn = sheetDate(sheet);
  // The age on the day it was written; the server's age today when there is no birth date.
  const age = ageOnDay(print?.patient?.dateOfBirth, prescriptionDay(writtenOn));
  const serverAge = Number(print?.patient?.age ?? '') || 0;
  const gender = (print?.patient?.gender ?? '').trim();
  const mobile = print?.patient?.mobile ?? '';
  const address = print?.patient?.address ?? '';
  const isEmpty = !medicines.length && !vitals.length && !findings.length && !instructions.length;

  // The evening-before reminder for each follow-up date the doctor wrote — set
  // once, whatever the number of opens (followUpReminder). Not for an upload (no
  // HMS doctor wrote it), nor for a sheet that came back empty, whose missing
  // dates would take away reminders already set.
  const followUpDates = print?.followUpDates;
  const reminderDoctor = rx?.doctorName ?? '';
  const reminderPatient = print?.patient?.name || rx?.patientName || '';
  useEffect(() => {
    if (!followUpDates || isUploaded || isEmpty) return;
    scheduleFollowUpReminders?.({
      prescriptionId,
      dates: followUpDates,
      doctorName: reminderDoctor,
      patientName: reminderPatient,
    });
  }, [followUpDates, isUploaded, isEmpty, prescriptionId, reminderDoctor, reminderPatient]);

  // An upload was not signed by an HMS doctor — there is no place for a signature on it.
  const signer = isUploaded ? '' : doctorTitle(rx?.doctorName);
  const hasLeft = vitals.length > 0 || findings.length > 0;
  const twoColumns = hasLeft && (width ?? 0) >= TWO_COLUMN_MIN_WIDTH;

  const ageText = age
    ? age.years > 0
      ? t('reports.pad.ageYears', { count: age.years })
      : t('reports.pad.ageMonths', { count: age.months })
    : serverAge > 0
      ? t('reports.pad.ageYears', { count: serverAge })
      : '';
  const sexText = gender ? t(`patientProfile.gender_${gender.toLowerCase()}`, { defaultValue: gender }) : '';
  // An upload's date is when it was saved — it has no time worth showing.
  const time = isUploaded ? '' : formatRecordTime(rx?.prescribedAt);

  // The doctor's header from the page layout, by script: Bangla on the left, English on the right.
  const header = splitHeaderColumns(print?.headerColumns);
  // The hospital band's first line is its name, across the top; the rest (address, tagline) at the foot.
  const [hospitalName = '', ...hospitalRest] = print?.hospitalLines ?? [];

  // Drawn twice from the one element: in the page, and alone in the zoom view.
  const sheetView = rx ? (
    <PadPaper>
      <PadHospitalName name={hospitalName} />
      {/* The doctor as the page layout's header gives them (a wrong one is the backend's to
          fix); the name and department the prescription carries without one. */}
      <PadLetterhead
        bangla={header?.bangla ?? []}
        english={header?.english ?? []}
        fallbackTitle={title}
        fallbackSubtitle={subtitle}
      />

      <PadPatient
        rows={[
          [
            { label: t('reports.pad.name'), value: rx?.patientName || print?.patient?.name || '' },
            { label: t('reports.pad.age'), value: ageText },
            { label: t('reports.pad.sex'), value: sexText },
            // Off (2026-11-16): { label: t('reports.pad.date'), value: formatRecordDate(prescribedOn(rx), months) },
            { label: t('reports.pad.date'), value: formatRecordDate(writtenOn, months) },
          ],
          [
            { label: t('reports.patientId'), value: rx?.patientCode || print?.patient?.patientId || '' },
            { label: t('reports.visit'), value: [t(prescriptionKindKey(sheet)), time].filter(Boolean).join(', ') },
            { label: t('reports.pad.mobile'), value: mobile },
            { label: t('reports.pad.address'), value: address },
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
            {rightItems.map((item, index) =>
              item === 'rx' ? (
                <PadRx key="rx" medicines={medicines} />
              ) : (
                <PadSection key={`${item?.key ?? ''}-${index}`} section={item} />
              ),
            )}
            {isEmpty ? <PadEmpty>{t('reports.noPrescriptionDetails')}</PadEmpty> : null}
            <PadSignature
              name={signer}
              meta={rx?.departmentName ?? ''}
              lines={print?.signatoryLines ?? []}
              image={print?.signatureImage ?? ''}
            />
          </>
        }
      />

      <PadFooter
        code={rx?.code ?? ''}
        // count={medicines.length} — off (2026-11-16): the count sits beside "Rx" now.
        lines={print?.footerLines ?? []}
        addressLines={hospitalRest}
        hours={print?.notice ?? ''}
      />
    </PadPaper>
  ) : null;

  return (
    <RecordDetailScreen
      // Just "Prescription" — the number, patient and date are on the sheet itself.
      title={t('reports.prescription')}
      // Off (2026-11-16) — the header used to show the number, then the patient and date:
      // title={rx?.code || params?.title || fallbackName}
      // subtitle={[rx?.patientName, formatRecordDate(prescribedOn(rx), months)].filter(Boolean).join(' · ')}
      isLoading={detail?.isLoading}
      isRefreshing={detail?.isRefreshing}
      // Off (2026-11-16): our text on top and the server's words under it —
      // error={detail?.error}
      // errorFallback={t('reports.prescriptionOpenFailed')}
      // Now one message: the server's own words, else the title its answer carries (a bare
      // 404 says "Not Found"), and ours only when it sent nothing at all — by how it failed.
      // ('' keeps the failed state; the message itself goes in the title.)
      error={detail?.error == null ? null : ''}
      errorFallback={
        detail?.error ||
        detail?.serverTitle ||
        (detail?.isOffline
          ? t('common.noConnection')
          : detail?.errorStatus === 404
            ? t('reports.prescriptionNotOnServer')
            : t('reports.prescriptionOpenFailed'))
      }
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
