import React, { ReactNode, memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PatientProfile, PatientRepository } from '@app/core';
import { fontFamilies } from '@app/ui';
import FilterPills, { FilterPill } from '../FilterPills';
import { forWhomLabel } from '../forWhomLabel';

/** The amber of a line the AI was unsure of, in light and dark. */
export const UNSURE = {
  light: { ink: '#8A5A00', tint: '#FEF3E0', border: '#F5C26B' },
  dark: { ink: '#F5C26B', tint: '#3A2E14', border: '#8A5A00' },
};

/**
 * The account's profiles that have a hospital registration — only those can
 * hold a reviewed upload — and which one it is for: the one the upload named,
 * else the first, as the portal's review starts.
 */
/** Below this width the footer's two buttons are too narrow for the tick and "Confirm & save". */
const ROOMY_FOOTER_WIDTH = 400;

/**
 * The review footer's buttons. On a narrow phone (360dp) the confirm button
 * drops its tick and both labels take less side margin, so the words fit whole.
 */
export const useReviewFooter = () => {
  const { width } = useWindowDimensions();
  const roomy = width >= ROOMY_FOOTER_WIDTH;
  return {
    confirmIcon: roomy ? 'check' : undefined,
    labelStyle: roomy ? undefined : footerStyles.narrowLabel,
  };
};

const footerStyles = StyleSheet.create({
  narrowLabel: {
    marginHorizontal: 12,
  },
});

export const useReviewProfiles = (defaultRegistrationId?: number | null) => {
  const [profiles, setProfiles] = useState<PatientProfile[]>([]);
  const [registrationId, setRegistrationId] = useState<number>(Number(defaultRegistrationId ?? 0) || 0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    PatientRepository.getAllProfiles()
      .then(rows => {
        if (!isMountedRef.current) return;
        const linked = (rows ?? []).filter(profile => (profile?.registrationId ?? 0) > 0);
        setProfiles(linked);
        setRegistrationId(current => current || linked?.[0]?.registrationId || 0);
      })
      .catch((e: any) => console.log('getAllProfiles (review) error ==>', e?.message));
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const selected = useMemo(
    () => profiles.find(profile => profile?.registrationId === registrationId) ?? null,
    [profiles, registrationId],
  );

  return { profiles, registrationId, setRegistrationId, selected };
};

/**
 * The name printed on the sheet, when it is not the chosen profile's — neither
 * name contains the other, as the portal compares them. '' when they agree or
 * either is missing.
 */
export const mismatchedName = (sheetName: string | null | undefined, profileName: string | null | undefined): string => {
  const sheet = String(sheetName ?? '').trim();
  const profile = String(profileName ?? '').trim();
  if (!sheet || !profile) return '';
  const a = sheet.toLowerCase();
  const b = profile.toLowerCase();
  return a.includes(b) || b.includes(a) ? '' : sheet;
};

/** A titled card on a review screen. */
export const ReviewCard = ({ title, icon, children, right }: { title?: string; icon?: string; children: ReactNode; right?: ReactNode }) => {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      {title ? (
        <View style={styles.cardHead}>
          {icon ? <Icon name={icon} size={16} color={theme.colors.primary} /> : null}
          <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>{title}</Text>
          {right ?? null}
        </View>
      ) : null}
      {children}
    </View>
  );
};

/**
 * Whose it is: the profile chips, each with who they are to the account, and
 * a warning when the read names someone else — "the sheet says" for a
 * prescription, "the report says" for a lab report, as the portal words it.
 */
export const ForWhomPicker = memo<{
  profiles: PatientProfile[];
  registrationId: number;
  onPick: (registrationId: number) => void;
  sheetName?: string | null;
  selectedName?: string | null;
  kind?: 'rx' | 'lab';
}>(function ForWhomPicker({ profiles, registrationId, onPick, sheetName, selectedName, kind = 'rx' }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const unsure = theme.dark ? UNSURE.dark : UNSURE.light;
  const pills: FilterPill[] = useMemo(
    () =>
      (profiles ?? []).map(profile => ({
        key: String(profile?.registrationId ?? ''),
        label: forWhomLabel(profile, t),
      })),
    [profiles, t],
  );
  const mismatch = mismatchedName(sheetName, selectedName);

  return (
    <ReviewCard title={`${t('reports.read.forWhom')} *`} icon="account-outline">
      {pills.length ? (
        <FilterPills items={pills} selected={String(registrationId || '')} onSelect={key => onPick(Number(key) || 0)} />
      ) : (
        <Text style={[styles.muted, { color: theme.colors.onSurfaceVariant }]}>{t('reports.review.noProfiles')}</Text>
      )}
      {mismatch ? (
        <View style={[styles.warning, { backgroundColor: unsure.tint }]}>
          <Icon name="alert-outline" size={15} color={unsure.ink} />
          <Text style={[styles.warningText, { color: unsure.ink }]}>
            {t(kind === 'lab' ? 'reports.review.nameMismatchLab' : 'reports.review.nameMismatch', { name: mismatch })}
          </Text>
        </View>
      ) : null}
    </ReviewCard>
  );
});

/** The note at the top: the AI read this, and what amber means. */
export const AiReadNote = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.aiNote, { backgroundColor: theme.colors.primaryContainer }]}>
      <Icon name="creation" size={18} color={theme.colors.primary} />
      <Text style={[styles.aiNoteText, { color: theme.colors.onPrimaryContainer }]}>{t('reports.review.aiNote')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 14.5,
  },
  muted: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  warningText: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
  },
  aiNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  aiNoteText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
});
