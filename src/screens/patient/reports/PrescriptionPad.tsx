import React, { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PrescriptionDose, PrescriptionMedicine, PrescriptionSection } from '@app/core';
import { AppLightTheme, fontFamilies } from '@app/ui';
import { Code128Barcode } from '../../../components/Code128Barcode';
import { PadVital, asText, formatDose, medicineTitle, withAlpha } from './prescriptionPadUi';

/**
 * A visit prescription drawn as the printed pad a patient is handed: the
 * doctor's letterhead, the "Name … Age … Date …" lines, the findings in a narrow
 * margin column on the left and ℞ with the medicines on the right, the doctor's
 * name where it is signed, and the prescription number at the foot.
 *
 * The sheet is paper, so it stays white in the dark theme too — its colours
 * come from the light theme, whatever the app is showing around it.
 */

const PAPER = AppLightTheme.colors;
const INK = PAPER.onSurface;
const MUTED = PAPER.onSurfaceVariant;
const BRAND = PAPER.primary;
/** Hairlines on white: the muted ink, faint. */
const RULE = withAlpha(PAPER.onSurfaceVariant, 0.3);
/** The findings column's tint. */
const COLUMN_TINT = withAlpha(PAPER.primary, 0.035);
const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

/** "Continue" in green and "Mixed" in amber, as the portal marks them. */
const CONTINUE_GREEN = '#1B8A4B';
const MIXED_AMBER = '#B27400';

/** The sheet of paper. */
export const PadPaper = ({ children }: { children: ReactNode }) => (
  <View style={styles.paper}>{children}</View>
);

/** The hospital's name across the top of the sheet. */
export const PadHospitalName = ({ name }: { name?: string }) => {
  const text = asText(name).trim();
  if (!text) return null;
  return (
    <View style={styles.hospitalTop}>
      <Text selectable style={styles.hospitalTopName}>
        {text}
      </Text>
    </View>
  );
};

/** One side of the letterhead: the doctor's name, then degrees, designation, chamber. */
const DoctorBlock = ({ lines, align }: { lines: string[]; align: 'left' | 'right' }) => {
  const [name, ...rest] = (lines ?? []).map(asText).filter(Boolean);
  if (!name) return null;
  const alignStyle = align === 'right' ? styles.alignRight : undefined;
  return (
    <View style={styles.doctorBlock}>
      <Text selectable style={[styles.doctor, alignStyle]}>
        {name}
      </Text>
      {rest.map((line, index) => (
        <Text
          key={`${line}-${index}`}
          selectable
          style={[
            styles.doctorLine,
            // The last line — the chamber — reads as the strongest after the name.
            index === rest.length - 1 && rest.length > 1 ? styles.doctorLineStrong : undefined,
            alignStyle,
          ]}
        >
          {line}
        </Text>
      ))}
    </View>
  );
};

/**
 * Who wrote it, as the printed pad sets it out: the doctor in Bangla on the
 * left and in English on the right (from the page layout's header), ruled off
 * underneath. With no header, the name and department the prescription carries.
 */
export const PadLetterhead = ({
  english,
  bangla,
  fallbackTitle,
  fallbackSubtitle,
}: {
  english?: string[];
  bangla?: string[];
  fallbackTitle?: string;
  fallbackSubtitle?: string;
}) => {
  const bn = (bangla ?? []).map(asText).filter(Boolean);
  const en = (english ?? []).map(asText).filter(Boolean);
  const right = en.length ? en : [asText(fallbackTitle), asText(fallbackSubtitle)].filter(Boolean);
  if (!bn.length && !right.length) return null;
  return (
    <View style={styles.letterhead}>
      {bn.length ? <DoctorBlock lines={bn} align="left" /> : null}
      {right.length ? <DoctorBlock lines={right} align={bn.length ? 'right' : 'left'} /> : null}
    </View>
  );
};

export interface PadField {
  label: string;
  value?: string | null;
}

/**
 * The patient on one or two lines — "Name: …  Age: …  Sex: …  Date: …" —
 * each part only when it has a value.
 */
export const PadPatient = ({ rows }: { rows: PadField[][] }) => {
  const shown = (rows ?? [])
    .map(row => (row ?? []).filter(field => asText(field?.value).trim()))
    .filter(row => row.length > 0);
  if (!shown.length) return null;
  return (
    <View style={styles.patient}>
      {shown.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.patientRow, rowIndex > 0 ? styles.patientRowGap : undefined]}>
          {row.map((field, fieldIndex) => (
            <Text key={`${asText(field?.label)}-${fieldIndex}`} selectable style={styles.patientPair}>
              <Text style={styles.patientLabel}>{`${asText(field?.label)}: `}</Text>
              <Text style={styles.patientValue}>{asText(field?.value).trim()}</Text>
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
};

/**
 * The body of the pad: findings in the narrow margin column on the left, ℞ on
 * the right. On a narrow phone, or with no findings, the two run one under the
 * other.
 */
export const PadBody = ({
  left,
  right,
  twoColumns,
}: {
  left?: ReactNode;
  right: ReactNode;
  twoColumns: boolean;
}) => (
  <View style={[styles.body, twoColumns ? styles.bodyRow : undefined]}>
    {left ? <View style={twoColumns ? styles.leftColumn : styles.leftStacked}>{left}</View> : null}
    <View style={twoColumns ? styles.rightColumn : styles.rightStacked}>{right}</View>
  </View>
);

/** A small icon for each part the API sends; one it does not know gets a plain dot. */
const SECTION_ICON: Record<string, string> = {
  physicalExamination: 'stethoscope',
  history: 'history',
  chiefComplaint: 'account-alert-outline',
  investigation: 'flask-outline',
  investigationFindings: 'file-search-outline',
  diagnosis: 'clipboard-pulse-outline',
  allergy: 'alert-circle-outline',
  treatmentPlan: 'clipboard-text-outline',
  advice: 'lightbulb-on-outline',
  followUp: 'calendar-clock',
  referred: 'account-arrow-right-outline',
};

const Heading = ({ icon, children }: { icon?: string; children: ReactNode }) => (
  <View style={styles.headingRow}>
    <Icon name={icon || 'circle-small'} size={14} color={BRAND} />
    <Text style={styles.heading}>{children}</Text>
  </View>
);

/** The examination's readings — one to a line in the narrow column, side by side when stacked. */
export const PadVitals = ({ vitals, inline }: { vitals: PadVital[]; inline?: boolean }) => {
  const { t } = useTranslation();
  if (!vitals?.length) return null;
  return (
    <View style={styles.block}>
      <Heading icon="heart-pulse">{t('reports.pad.vitals')}</Heading>
      <View style={inline ? styles.vitalsInline : undefined}>
        {(vitals ?? []).map((vital, index) => (
          <Text key={`${asText(vital?.label)}-${index}`} selectable style={styles.vital}>
            <Text style={styles.vitalLabel}>{`${asText(vital?.label)}: `}</Text>
            <Text style={styles.vitalValue}>{asText(vital?.value)}</Text>
          </Text>
        ))}
      </View>
    </View>
  );
};

/** One filled-in part — complaints, diagnosis, advice, follow-up… */
export const PadSection = ({ section }: { section: PrescriptionSection }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.block}>
      <Heading icon={SECTION_ICON[asText(section?.key)]}>{asText(section?.label)}</Heading>
      {(section?.groups ?? []).map((group, groupIndex) => (
        <View key={groupIndex} style={groupIndex > 0 ? styles.groupGap : undefined}>
          {asText(group?.groupName) ? <Text style={styles.groupName}>{asText(group?.groupName)}</Text> : null}
          {(group?.lines ?? []).map((line, lineIndex) => (
            <View key={lineIndex} style={styles.line}>
              <View style={styles.bullet} />
              <Text selectable style={styles.lineText}>
                {asText(line?.text)}
                {asText(line?.note) ? <Text style={styles.lineNote}>{` (${asText(line?.note)})`}</Text> : null}
                {line?.isUrgent ? <Text style={styles.urgent}>{`  ${t('reports.urgent')}`}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

/**
 * One period of a dose: how much, the doctor's note, then how long (or
 * "Continue"). Each is kept whole, so a narrow column wraps between them and
 * never inside "7 Days".
 */
const DoseLine = ({
  dose,
  isContinue,
  isThen,
}: {
  dose: PrescriptionDose;
  isContinue: boolean;
  isThen: boolean;
}) => {
  const { t } = useTranslation();
  const amount = formatDose(dose?.dose);
  const duration = [dose?.durationValue, dose?.durationUnit]
    .map(part => asText(part).trim())
    .filter(Boolean)
    .join(' ');

  return (
    <View style={styles.doseLine}>
      {isThen ? <Text style={styles.then}>{t('reports.pad.then')}</Text> : null}
      <Text style={styles.doseAmount}>{amount || '—'}</Text>
      {asText(dose?.note) ? <Text style={styles.doseNote}>{asText(dose?.note)}</Text> : null}
      {isContinue ? (
        <Text style={styles.continue}>{t('reports.continue')}</Text>
      ) : duration ? (
        <View style={styles.duration}>
          <Icon name="clock-outline" size={12} color={MUTED} />
          <Text style={styles.durationText}>{duration}</Text>
        </View>
      ) : null}
    </View>
  );
};

const MedicineRow = ({ medicine, index }: { medicine: PrescriptionMedicine; index: number }) => {
  const { t } = useTranslation();
  const isMulti = (medicine?.multiDose?.length ?? 0) > 0;
  const doses: PrescriptionDose[] = isMulti ? medicine?.multiDose ?? [] : [medicine];
  const subtitle = [medicine?.generic, medicine?.route]
    .map(part => asText(part).trim())
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.medicine}>
      <Text style={styles.medicineNumber}>{index + 1}.</Text>
      <View style={styles.medicineBody}>
        <Text selectable style={styles.medicineTitle}>
          {medicineTitle(medicine)}
          {medicine?.isMixed ? <Text style={styles.mixed}>{`  ${t('reports.mixed')}`}</Text> : null}
        </Text>
        {subtitle ? <Text style={styles.medicineSubtitle}>{subtitle}</Text> : null}
        {doses.map((dose, doseIndex) => (
          <DoseLine
            key={doseIndex}
            dose={dose}
            // "Continue" stands for a single dose only, as on the portal.
            isContinue={!isMulti && !!medicine?.isContinue}
            isThen={isMulti && doseIndex > 0}
          />
        ))}
      </View>
    </View>
  );
};

/** ℞ and the medicines under it. */
export const PadRx = ({ medicines }: { medicines: PrescriptionMedicine[] }) => {
  const { t } = useTranslation();
  if (!medicines?.length) return null;
  const count = medicines?.length ?? 0;
  return (
    <View style={styles.rxBlock}>
      {/* The count sat in the footer until the barcode took that line (2026-11-16). */}
      <View style={styles.rxHead}>
        <Text style={styles.rx}>
          R<Text style={styles.rxSmall}>x</Text>
        </Text>
        <View style={styles.footerCount}>
          <Icon name="pill" size={14} color={MUTED} />
          <Text style={styles.footerText}>{t('reports.medicineCount', { count })}</Text>
        </View>
      </View>
      {(medicines ?? []).map((medicine, index) => (
        <View key={index}>
          {index > 0 ? <View style={styles.medicineDivider} /> : null}
          <MedicineRow medicine={medicine} index={index} />
        </View>
      ))}
    </View>
  );
};

/** The doctor's name under a line, where the printed sheet is signed — at the foot of the column. */
export const PadSignature = ({
  name,
  meta,
  lines,
}: {
  name?: string;
  meta?: string;
  /** The doctor's own signatory block, as text — said once, without repeating the name. */
  lines?: string[];
}) => {
  if (!name) return null;
  const extra = (lines ?? []).map(asText).filter(line => line && line !== name && line !== meta);
  return (
    <View style={styles.signature}>
      <View style={styles.signatureLine} />
      <Text style={styles.signatureName}>{name}</Text>
      {meta ? <Text style={styles.signatureMeta}>{meta}</Text> : null}
      {extra.map((line, index) => (
        <Text key={`${line}-${index}`} style={styles.signatureMeta}>
          {line}
        </Text>
      ))}
    </View>
  );
};

/**
 * The foot of the pad: the hospital's address on the left and the doctor's
 * visiting hours on the right, the hospital's own line under them, then the
 * prescription number as a CODE 128 barcode — what the pharmacy and billing
 * desks scan — on a line of its own.
 */
export const PadFooter = ({
  code,
  lines,
  addressLines,
  hours,
}: {
  code?: string;
  // count: number; — off (2026-11-16): the count is drawn beside "Rx" now.
  /** The layout's footer band — the hospital's own line. */
  lines?: string[];
  /** The hospital's address (and tagline), from the page layout. */
  addressLines?: string[];
  /** The doctor's visiting hours, from the page layout's notice. */
  hours?: string;
}) => {
  const { t } = useTranslation();
  const note = (lines ?? []).map(asText).filter(Boolean);
  const address = (addressLines ?? []).map(asText).filter(Boolean);
  const visiting = asText(hours).trim();
  const rxCode = asText(code).trim();
  if (!rxCode && !note.length && !address.length && !visiting) return null;
  return (
    <View style={styles.footer}>
      {address.length || visiting ? (
        <View style={styles.footerInfo}>
          <View style={styles.footerAddress}>
            {address.map((line, index) => (
              <Text
                key={`${line}-${index}`}
                selectable
                style={index === 0 ? styles.footerAddressMain : styles.footerAddressLine}
              >
                {line}
              </Text>
            ))}
          </View>
          {visiting ? (
            <View style={styles.footerHours}>
              <Icon name="clock-outline" size={13} color={BRAND} />
              <Text selectable style={styles.footerHoursText}>
                {visiting}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {note.length ? <Text style={styles.footerNote}>{note.join('\n')}</Text> : null}
      {rxCode ? (
        <View style={styles.footerBarcode}>
          <Code128Barcode
            value={rxCode}
            height={28}
            align="center"
            color={INK}
            accessibilityLabel={`${t('reports.pad.rxNo')} ${rxCode}`}
            // A code CODE 128 cannot draw, or too long to fit, falls back to the text.
            fallback={
              <Text selectable numberOfLines={1} style={[styles.footerText, styles.footerCodeText]}>
                {`${t('reports.pad.rxNo')} ${rxCode}`}
              </Text>
            }
          />
        </View>
      ) : null}
      {/* Off (2026-11-16): "Rx No. {code}" as text beside the medicine count. The
          barcode above carries the code now, on a line of its own so it is wide
          enough to scan; the count moved up beside "Rx".
      {code || count > 0 ? (
        <View style={styles.footerRow}>
          <View style={styles.footerCode}>
            {code ? <Icon name="barcode" size={15} color={MUTED} /> : null}
            <Text selectable numberOfLines={1} style={styles.footerText}>
              {code ? `${t('reports.pad.rxNo')} ${code}` : ''}
            </Text>
          </View>
          {count > 0 ? (
            <View style={styles.footerCount}>
              <Icon name="pill" size={14} color={MUTED} />
              <Text style={styles.footerText}>{t('reports.medicineCount', { count })}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      */}
    </View>
  );
};

/** A quiet line on the sheet for one with nothing written on it. */
export const PadEmpty = ({ children }: { children: ReactNode }) => (
  <View style={styles.empty}>
    <Icon name="information-outline" size={17} color={MUTED} />
    <Text style={styles.emptyText}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  paper: {
    backgroundColor: PAPER.surface,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#0B1030',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },

  hospitalTop: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RULE,
  },
  hospitalTopName: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    lineHeight: 18.5,
    letterSpacing: 0.3,
    color: BRAND,
    textAlign: 'center',
  },
  letterhead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
  },
  doctorBlock: {
    flex: 1,
    minWidth: 0,
  },
  doctor: {
    fontFamily: fontFamilies.bold,
    fontSize: 13.5,
    lineHeight: 18,
    color: BRAND,
  },
  doctorLine: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 1,
    color: MUTED,
  },
  doctorLineStrong: {
    fontFamily: fontFamilies.semibold,
    color: INK,
  },
  alignRight: {
    textAlign: 'right',
  },

  patient: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  patientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 2,
  },
  patientRowGap: {
    marginTop: 3,
  },
  patientPair: {
    fontSize: 11.5,
    lineHeight: 16.5,
  },
  patientLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 10.5,
    color: MUTED,
  },
  patientValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
    color: INK,
  },

  body: {
    minHeight: 300,
  },
  bodyRow: {
    flexDirection: 'row',
  },
  leftColumn: {
    width: '34%',
    paddingHorizontal: 12,
    paddingBottom: 16,
    backgroundColor: COLUMN_TINT,
    borderRightWidth: 1,
    borderRightColor: RULE,
  },
  leftStacked: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLUMN_TINT,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  rightColumn: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  rightStacked: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },

  block: {
    paddingTop: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  heading: {
    flexShrink: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: BRAND,
  },
  vitalsInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
  },
  vital: {
    fontSize: 11.5,
    lineHeight: 17,
  },
  vitalLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: MUTED,
  },
  vitalValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 11.5,
    color: INK,
  },
  groupGap: {
    marginTop: 6,
  },
  groupName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    color: INK,
    marginBottom: 3,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 3,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 7.5,
    marginRight: 7,
    backgroundColor: BRAND,
  },
  lineText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    lineHeight: 17,
    color: INK,
  },
  lineNote: {
    fontSize: 10.5,
    color: MUTED,
  },
  urgent: {
    fontFamily: fontFamilies.bold,
    fontSize: 9.5,
    color: PAPER.error,
  },

  rxBlock: {
    paddingTop: 10,
  },
  rxHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rx: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontWeight: '700',
    fontSize: 26,
    lineHeight: 30,
    color: BRAND,
  },
  rxSmall: {
    fontSize: 16,
  },
  medicine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 9,
  },
  medicineDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 20,
    backgroundColor: RULE,
  },
  medicineNumber: {
    width: 20,
    fontFamily: fontFamilies.bold,
    fontSize: 12.5,
    lineHeight: 17,
    color: BRAND,
  },
  medicineBody: {
    flex: 1,
    minWidth: 0,
  },
  medicineTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 12.5,
    lineHeight: 17,
    color: INK,
  },
  mixed: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    color: MIXED_AMBER,
  },
  medicineSubtitle: {
    fontFamily: fontFamilies.regular,
    fontStyle: 'italic',
    fontSize: 10.5,
    lineHeight: 14.5,
    color: MUTED,
  },
  doseLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 2,
    marginTop: 4,
  },
  doseAmount: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    lineHeight: 16.5,
    letterSpacing: 0.3,
    color: INK,
  },
  doseNote: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    lineHeight: 16.5,
    color: INK,
  },
  then: {
    fontFamily: fontFamilies.regular,
    fontStyle: 'italic',
    fontSize: 11,
    color: MUTED,
  },
  continue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
    color: CONTINUE_GREEN,
  },
  duration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  durationText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    lineHeight: 16.5,
    color: MUTED,
  },

  signature: {
    marginTop: 'auto',
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    paddingTop: 26,
    paddingBottom: 14,
  },
  signatureLine: {
    width: 130,
    height: 1,
    marginBottom: 5,
    backgroundColor: MUTED,
  },
  signatureName: {
    fontFamily: fontFamilies.bold,
    fontSize: 11.5,
    color: INK,
    textAlign: 'right',
  },
  signatureMeta: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    color: MUTED,
    textAlign: 'right',
    marginTop: 1,
  },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 2,
    borderTopColor: BRAND,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  footerAddress: {
    flex: 1,
    minWidth: 0,
  },
  footerAddressMain: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    lineHeight: 14,
    color: INK,
  },
  footerAddressLine: {
    fontFamily: fontFamilies.regular,
    fontSize: 9.5,
    lineHeight: 13.5,
    color: MUTED,
  },
  footerHours: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    maxWidth: '48%',
  },
  footerHoursText: {
    flexShrink: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 9.5,
    lineHeight: 13.5,
    color: INK,
    textAlign: 'right',
  },
  footerNote: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    lineHeight: 16,
    color: INK,
    textAlign: 'center',
    marginBottom: 6,
  },
  footerBarcode: {
    alignSelf: 'stretch',
    marginTop: 2,
  },
  footerCodeText: {
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  footerCode: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  footerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    flexShrink: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 10.5,
    color: MUTED,
  },

  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  emptyText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    lineHeight: 17,
    color: MUTED,
  },
});
