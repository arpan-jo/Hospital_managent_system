import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  MedicalRecordRepository,
  PrescriptionDose,
  PrescriptionMedicine,
  PrescriptionSection,
} from '@app/core';
import { fontFamilies } from '@app/ui';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { ReportsStackParamList } from '../../../navigation/ReportsStackNavigator';
import { VISIT_LABEL_KEY, doctorTitle } from '../myPrescriptions/prescriptionUi';
import {
  DetailCard,
  DetailFacts,
  DetailHeading,
  DetailNote,
  RecordDetailScreen,
  useRecordDetail,
} from './RecordDetail';
import { RECORD_TONE, formatRecordDate, formatRecordDateTime, recordTone } from './reportsUi';

/** One dose line: the dose, its note, then "Continue" or how long. */
const DoseLine = ({ dose, isContinue }: { dose: PrescriptionDose; isContinue: boolean }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const duration = dose?.durationValue
    ? `${dose.durationValue} ${dose?.durationUnit ?? ''}`.trim()
    : '';

  return (
    <View style={styles.doseLine}>
      <Text style={[styles.dose, { color: theme.colors.onSurface }]}>{dose?.dose || '—'}</Text>
      {dose?.note ? (
        <Text style={[styles.doseNote, { color: theme.colors.onSurfaceVariant }]}>{dose.note}</Text>
      ) : null}
      {isContinue ? (
        <Text style={[styles.continue, { color: theme.dark ? '#6FD3A0' : '#1B8A4B' }]}>
          {t('reports.continue')}
        </Text>
      ) : duration ? (
        <Text style={[styles.duration, { color: theme.colors.onSurfaceVariant }]}>{duration}</Text>
      ) : null}
    </View>
  );
};

const MedicineRow = ({ medicine, index }: { medicine: PrescriptionMedicine; index: number }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const muted = theme.colors.onSurfaceVariant;
  const isMulti = (medicine?.multiDose?.length ?? 0) > 0;
  const doses: PrescriptionDose[] = isMulti ? medicine.multiDose : [medicine];

  return (
    <View style={styles.medicine}>
      <View style={[styles.number, { backgroundColor: theme.colors.primaryContainer }]}>
        <Text style={[styles.numberText, { color: theme.colors.primary }]}>{index + 1}</Text>
      </View>
      <View style={styles.medicineBody}>
        <Text style={[styles.medicineName, { color: muted }]}>
          {medicine?.type ? `${medicine.type} ` : ''}
          <Text style={[styles.brand, { color: theme.colors.onSurface }]}>{medicine?.brand}</Text>
          {medicine?.generic ? ` ${medicine.generic}` : ''}
          {medicine?.route ? ` · ${medicine.route}` : ''}
        </Text>
        {medicine?.isMixed ? (
          <View style={styles.mixed}>
            <Text style={styles.mixedText}>{t('reports.mixed')}</Text>
          </View>
        ) : null}
        <View style={isMulti ? [styles.multi, { borderLeftColor: theme.colors.outlineVariant }] : undefined}>
          {doses.map((dose, doseIndex) => (
            <DoseLine
              key={doseIndex}
              dose={dose}
              // "Continue" stands for a single dose only, as on the portal.
              isContinue={!isMulti && !!medicine?.isContinue}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const SectionBlock = ({ section }: { section: PrescriptionSection }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <DetailCard>
      <DetailHeading>{section?.label}</DetailHeading>
      {section?.groups?.map((group, groupIndex) => (
        <View key={groupIndex} style={groupIndex > 0 ? styles.groupGap : undefined}>
          {group?.groupName ? (
            <Text style={[styles.groupName, { color: theme.colors.onSurface }]}>{group.groupName}</Text>
          ) : null}
          {group?.lines?.map((line, lineIndex) => (
            <View
              key={lineIndex}
              style={[styles.sectionLine, group?.groupName ? styles.indented : undefined]}
            >
              <Text style={[styles.bullet, { color: theme.colors.primary }]}>•</Text>
              <Text selectable style={[styles.lineText, { color: theme.colors.onSurface }]}>
                {line?.text}
                {line?.isUrgent ? (
                  <Text style={[styles.urgent, { color: theme.colors.error }]}>
                    {`  ${t('reports.urgent')}`}
                  </Text>
                ) : null}
                {line?.note ? (
                  <Text style={[styles.lineNote, { color: theme.colors.onSurfaceVariant }]}>
                    {` (${line.note})`}
                  </Text>
                ) : null}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </DetailCard>
  );
};

/** One visit prescription in full, as the portal's Reports page opens it. */
export const VisitPrescriptionScreen = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const months = useMonthNames();
  const route = useRoute<RouteProp<ReportsStackParamList, 'VisitPrescription'>>();
  const prescriptionId = route?.params?.prescriptionId ?? 0;
  const detail = useRecordDetail(MedicalRecordRepository.getPrescription, prescriptionId);
  const rx = detail.data;
  const tone = recordTone('prescriptions', theme.dark);

  const hasMedicines = (rx?.medicines?.length ?? 0) > 0;
  const hasSections = (rx?.sections?.length ?? 0) > 0;

  return (
    <RecordDetailScreen
      title={rx?.code || route?.params?.title || t('reports.prescription')}
      subtitle={[rx?.patientName, formatRecordDate(rx?.prescribedAt, months)].filter(Boolean).join(' · ')}
      isLoading={detail.isLoading}
      isRefreshing={detail.isRefreshing}
      error={detail.error}
      errorFallback={t('reports.prescriptionOpenFailed')}
      onRetry={detail.retry}
      onRefresh={detail.refresh}
    >
      {rx ? (
        <>
          <DetailCard>
            <View style={styles.summaryTop}>
              <View style={[styles.iconTile, { backgroundColor: tone.tint }]}>
                <Icon name={RECORD_TONE.prescriptions.icon} size={22} color={tone.color} />
              </View>
              <View style={styles.summaryText}>
                <Text style={[styles.summaryTitle, { color: theme.colors.onSurface }]}>
                  {doctorTitle(rx?.doctorName) || rx?.code}
                </Text>
                {rx?.departmentName ? (
                  <Text style={[styles.summaryMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {rx.departmentName}
                  </Text>
                ) : null}
              </View>
            </View>
            <DetailFacts
              facts={[
                { label: t('reports.prescribed'), value: formatRecordDateTime(rx?.prescribedAt, months) },
                // As the portal shows it: the name as stored, without a title added.
                { label: t('reports.doctor'), value: rx?.doctorName },
                { label: t('reports.department'), value: rx?.departmentName },
                { label: t('reports.visit'), value: t(VISIT_LABEL_KEY[rx?.visitType] ?? VISIT_LABEL_KEY.opd) },
                { label: t('reports.patientId'), value: rx?.patientCode },
              ]}
            />
          </DetailCard>

          {hasMedicines ? (
            <DetailCard>
              <DetailHeading icon="pill">{t('reports.medicines')}</DetailHeading>
              {rx.medicines.map((medicine, index) => (
                <MedicineRow key={index} medicine={medicine} index={index} />
              ))}
            </DetailCard>
          ) : null}

          {rx?.sections?.map((section, index) => (
            <SectionBlock key={`${section?.key}-${index}`} section={section} />
          ))}

          {!hasMedicines && !hasSections ? (
            <DetailNote icon="information-outline">{t('reports.noPrescriptionDetails')}</DetailNote>
          ) : null}

          <DetailNote icon="stethoscope">{t('reports.prescriptionDisclaimer')}</DetailNote>
        </>
      ) : null}
    </RecordDetailScreen>
  );
};

const styles = StyleSheet.create({
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
    marginLeft: 12,
  },
  summaryTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  summaryMeta: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    marginTop: 2,
  },
  medicine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  number: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  numberText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11.5,
  },
  medicineBody: {
    flex: 1,
    marginLeft: 10,
  },
  medicineName: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  brand: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  mixed: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3E0',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  mixedText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    color: '#B27400',
  },
  multi: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    marginTop: 4,
  },
  doseLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 8,
    marginTop: 4,
  },
  dose: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  doseNote: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
  },
  continue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  duration: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
  },
  groupGap: {
    marginTop: 10,
  },
  groupName: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    marginBottom: 4,
  },
  sectionLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  indented: {
    paddingLeft: 10,
  },
  bullet: {
    width: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  lineText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    lineHeight: 20,
  },
  urgent: {
    fontFamily: fontFamilies.bold,
    fontSize: 11.5,
  },
  lineNote: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
});

export default VisitPrescriptionScreen;
