import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  formatDayMonthYear,
  formatLongDate,
  fromISODate,
  PrescribedMedicine,
  PrescriptionSection,
} from '@app/core';
import { fontFamilies } from '@app/ui';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { PrescriptionDocument } from './usePrescriptionPreviewViewModel';

/** Amber notice strip — a fixed document colour, not a theme role. */
const NOTICE_COLOR = '#B26B00';
const NOTICE_BACKGROUND = '#FFF4E0';

interface FieldProps {
  label: string;
  value: string;
  /** Fields whose value needs the whole row rather than half of it, e.g. an address. */
  full?: boolean;
}

/** One "Label: value" cell of the patient bar. */
const Field = memo<FieldProps>(function Field({ label, value, full = false }) {
  const theme = useTheme();

  return (
    <View style={full ? styles.fieldFull : styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>
        {`${label}: `}
        <Text style={[styles.fieldValue, { color: theme.colors.onSurface }]}>
          {value || '—'}
        </Text>
      </Text>
    </View>
  );
});

/** A section heading with the rule the printed record draws under it. */
const SectionHeading = memo<{ title: string }>(function SectionHeading({ title }) {
  const theme = useTheme();

  return (
    <View style={[styles.sectionHeading, { borderBottomColor: theme.colors.primary }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>{title}</Text>
    </View>
  );
});

/**
 * One section the doctor filled in — its groups ("Vitals", "Provisional") and
 * their rows. Every part of it comes from the payload, so a section prints
 * exactly the rows that were recorded and nothing more.
 */
const Section = memo<{ section: PrescriptionSection }>(function Section({ section }) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <SectionHeading title={section?.title ?? ''} />

      {(section?.groups ?? []).map((group, groupIndex) => (
        <View key={`${section?.key}-${group?.title}-${groupIndex}`} style={styles.group}>
          {group?.title ? (
            <Text style={[styles.groupTitle, { color: theme.colors.onSurface }]}>
              {group.title}
            </Text>
          ) : null}

          {(group?.entries ?? []).map((entry, entryIndex) => (
            <View key={`${entry?.label}-${entryIndex}`} style={styles.entry}>
              <View style={styles.entryRow}>
                {entry?.label ? (
                  <Text style={[styles.entryLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {entry.label}
                  </Text>
                ) : (
                  <Text style={[styles.bullet, { color: theme.colors.primary }]}>•</Text>
                )}
                <Text style={[styles.entryValue, { color: theme.colors.onSurface }]}>
                  {entry?.value || '—'}
                </Text>
              </View>

              {entry?.note ? (
                <Text style={[styles.entryNote, { color: theme.colors.onSurfaceVariant }]}>
                  {entry.note}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

/**
 * One Rx line, printed the way the record does it: form, brand, generic and
 * route on the first row, then a dose row per stage of the course.
 */
const Medicine = memo<{ medicine: PrescribedMedicine; index: number }>(function Medicine({
  medicine,
  index,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.medicine, { borderBottomColor: theme.colors.outlineVariant }]}>
      <View style={styles.medicineHead}>
        <Text style={[styles.medicineIndex, { color: theme.colors.onSurfaceVariant }]}>
          {`${index + 1}.`}
        </Text>

        <Text style={[styles.medicineForm, { color: theme.colors.onSurfaceVariant }]}>
          {medicine?.form ? `${medicine.form} ` : ''}
          <Text style={[styles.medicineName, { color: theme.colors.onSurface }]}>
            {medicine?.name || t('common.na')}
          </Text>
          {medicine?.generic ? ` ${medicine.generic}` : ''}
          {medicine?.dosage ? ` ${medicine.dosage}` : ''}
        </Text>

        {medicine?.route ? (
          <View style={[styles.routeBadge, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text style={[styles.routeText, { color: theme.colors.primary }]}>
              {medicine.route}
            </Text>
          </View>
        ) : null}
      </View>

      {(medicine?.doses ?? []).map((dose, doseIndex) => (
        <View key={`${dose?.dose}-${doseIndex}`} style={styles.doseRow}>
          <Text style={[styles.dose, { color: theme.colors.primary }]}>
            {dose?.dose || '—'}
          </Text>
          <View style={[styles.doseRule, { backgroundColor: theme.colors.outlineVariant }]} />
          <Text
            numberOfLines={2}
            style={[styles.doseMeta, { color: theme.colors.onSurfaceVariant }]}
          >
            {[dose?.duration, dose?.instruction].filter(Boolean).join(' · ') || '—'}
          </Text>
        </View>
      ))}

      {medicine?.isContinue ? (
        <Text style={[styles.continue, { color: theme.colors.primary }]}>
          {t('prescriptionPreview.continueMedicine')}
        </Text>
      ) : null}
    </View>
  );
});

/**
 * The prescription as the record prints it: the letterhead the doctor set up,
 * the patient bar, the doctor's own sections and the Rx. The web prints the
 * sections beside the Rx in two columns; a phone has room for one, so they
 * stack and the Rx closes the page.
 */
export const PrescriptionPaper = memo<{ document: PrescriptionDocument }>(
  function PrescriptionPaper({ document }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const monthNames = useMonthNames();

    /** The letterhead's own hospital block, or the record's chamber fields. */
    const hospitalLines = useMemo(() => {
      const printed = document?.letterhead?.hospital ?? [];
      if (printed.length > 0) return printed;

      return [document?.hospital, document?.chamberAddress].filter(Boolean) as string[];
    }, [document]);

    /**
     * The letterhead's own header columns. A doctor who set no page layout up
     * still gets a doctor block, built from the record's own fields.
     */
    const headerColumns = useMemo(() => {
      const printed = document?.letterhead?.columns ?? [];
      if (printed.length > 0) return printed;

      const doctorBlock = [
        document?.doctorName,
        document?.doctorQualification,
        document?.bmdcRegNo
          ? t('prescriptionPreview.bmdcReg', { no: document.bmdcRegNo })
          : '',
        document?.specialty,
      ].filter(Boolean) as string[];

      return doctorBlock.length > 0 ? [doctorBlock] : [];
    }, [document, t]);

    return (
      <View
        style={[
          styles.paper,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
        ]}
      >
        <View style={styles.codeRow}>
          <View style={styles.codeBlock}>
            <Text style={[styles.codeLabel, { color: theme.colors.onSurfaceVariant }]}>
              {t('prescriptionPreview.patientCodeLabel')}
            </Text>
            <Text style={[styles.codeValue, { color: theme.colors.onSurface }]}>
              {document?.patientCode || t('common.na')}
            </Text>
          </View>

          <View style={[styles.codeBlock, styles.codeBlockEnd]}>
            <Text style={[styles.codeLabel, { color: theme.colors.onSurfaceVariant }]}>
              {t('prescriptionPreview.refNumber')}
            </Text>
            <Text style={[styles.codeValue, { color: theme.colors.onSurface }]}>
              {document?.rxId || t('common.na')}
            </Text>
          </View>
        </View>

        {hospitalLines.length > 0 ? (
          <View style={styles.chamber}>
            {hospitalLines.map((line, index) => (
              <Text
                key={`${line}-${index}`}
                style={[
                  // The first line is the hospital's name; the rest is its address.
                  index === 0 ? styles.hospital : styles.letterheadLine,
                  {
                    color:
                      index === 0 ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                {line}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

        {headerColumns.length > 0 ? (
          <View style={styles.headerRow}>
            {headerColumns.map((lines, columnIndex) => (
              <View
                key={`column-${columnIndex}`}
                style={[
                  styles.headerColumn,
                  // The last column of a multi-column header prints right-aligned.
                  columnIndex > 0 && columnIndex === headerColumns.length - 1
                    ? styles.headerColumnEnd
                    : null,
                ]}
              >
                {lines.map((line, lineIndex) => (
                  <Text
                    key={`${line}-${lineIndex}`}
                    style={[
                      lineIndex === 0 ? styles.doctorName : styles.letterheadLine,
                      {
                        color:
                          lineIndex === 0
                            ? theme.colors.onSurface
                            : theme.colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {line}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {/* Only printed when the doctor switched the strip on. */}
        {document?.letterhead?.notice ? (
          <View style={[styles.notice, { backgroundColor: NOTICE_BACKGROUND }]}>
            <Icon name="alert-outline" size={14} color={NOTICE_COLOR} />
            <Text style={[styles.noticeText, { color: NOTICE_COLOR }]}>
              {document.letterhead.notice}
            </Text>
          </View>
        ) : null}

        <View style={[styles.fieldGrid, { backgroundColor: theme.colors.background }]}>
          <Field
            label={t('prescriptionPreview.patientName')}
            value={document?.patientName ?? ''}
          />
          <Field
            label={t('prescriptionPreview.date')}
            value={formatLongDate(document?.issuedAt ?? '', monthNames)}
          />
          <Field label={t('prescriptionPreview.age')} value={document?.patientAge ?? ''} />
          <Field
            label={t('prescriptionPreview.gender')}
            value={document?.patientGender ?? ''}
          />
          <Field
            label={t('prescriptionPreview.mobile')}
            value={document?.patientMobile ?? ''}
          />
          <Field
            label={t('prescriptionPreview.address')}
            value={document?.patientAddress ?? ''}
            full
          />
        </View>

        {(document?.sections ?? []).map(section => (
          <Section key={section?.key} section={section} />
        ))}

        <View style={styles.section}>
          <SectionHeading
            title={document?.medicinesTitle || t('prescriptionPreview.rxTitle')}
          />

          {document?.medicines?.length ? (
            document.medicines.map((medicine, index) => (
              <Medicine key={medicine?.id ?? index} medicine={medicine} index={index} />
            ))
          ) : (
            <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
              {t('prescriptionPreview.noMedicines')}
            </Text>
          )}
        </View>

        <View style={[styles.nextVisit, { borderTopColor: theme.colors.outlineVariant }]}>
          <Text style={[styles.nextVisitLabel, { color: theme.colors.onSurfaceVariant }]}>
            {t('prescriptionPreview.nextVisit')}
          </Text>
          <Text style={[styles.nextVisitValue, { color: theme.colors.onSurface }]}>
            {document?.nextVisit
              ? formatDayMonthYear(fromISODate(document.nextVisit), monthNames)
              : t('prescriptionPreview.noNextVisit')}
          </Text>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  paper: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  codeBlock: {
    flex: 1,
  },
  codeBlockEnd: {
    alignItems: 'flex-end',
  },
  codeLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  codeValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    marginTop: 2,
  },
  chamber: {
    marginTop: 12,
  },
  hospital: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
  },
  letterheadLine: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerColumn: {
    flex: 1,
  },
  headerColumnEnd: {
    alignItems: 'flex-end',
  },
  doctorName: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 8,
    padding: 8,
    marginTop: 12,
  },
  noticeText: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    lineHeight: 14,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginTop: 12,
    rowGap: 6,
  },
  field: {
    width: '50%',
    paddingRight: 8,
  },
  fieldFull: {
    width: '100%',
  },
  fieldLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  fieldValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  section: {
    marginTop: 16,
  },
  sectionHeading: {
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  group: {
    marginTop: 8,
  },
  groupTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  entry: {
    marginTop: 4,
    paddingLeft: 8,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  bullet: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
  },
  entryLabel: {
    width: '42%',
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  entryValue: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  entryNote: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
    paddingLeft: 14,
  },
  medicine: {
    borderBottomWidth: 1,
    paddingVertical: 9,
  },
  medicineHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  medicineIndex: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  // The form and the generic frame the brand, which stays the emphasised part.
  medicineForm: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  medicineName: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
  },
  routeBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  routeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 9,
  },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingLeft: 18,
  },
  dose: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
  },
  doseRule: {
    flex: 1,
    height: 1,
  },
  doseMeta: {
    maxWidth: '55%',
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    textAlign: 'right',
  },
  continue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    marginTop: 6,
    paddingLeft: 18,
  },
  nextVisit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 10,
  },
  nextVisitLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
  },
  nextVisitValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
  },
  empty: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    paddingVertical: 8,
  },
});

export default PrescriptionPaper;
