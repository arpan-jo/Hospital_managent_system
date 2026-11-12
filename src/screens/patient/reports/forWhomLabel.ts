/** What `forWhomLabel` reads off a profile. */
export interface ForWhomProfile {
  fullName?: string | null;
  patientCode?: string | null;
  relationship?: string | null;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * A profile as the "For whom" choices name it: the name, then who they are to
 * the account — "Rahim (Spouse)", "Al Amin (Self)" — as the portal labels
 * them, so two family members with like names are told apart. A relationship
 * the app has no word for shows as the server sent it.
 */
export const forWhomLabel = (profile: ForWhomProfile | null | undefined, t: Translate): string => {
  const name = profile?.fullName?.trim() || profile?.patientCode?.trim() || '—';
  const relationship = String(profile?.relationship ?? '').trim().toLowerCase();
  if (!relationship) return name;
  const label =
    relationship === 'self'
      ? t('reports.read.self')
      : t(`patientProfile.relation_${relationship}`, { defaultValue: relationship });
  return label ? `${name} (${label})` : name;
};
