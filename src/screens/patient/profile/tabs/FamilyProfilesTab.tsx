import React, { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Menu, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FAMILY_RELATIONSHIPS, FamilyMember, FamilyRelationship, getFileUrl } from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
import { EmptyState, ListHeader, SectionLoader } from '../ProfileComponents';
import { MemberRecords } from '../useProfileViewModel';
import { BLOOD_COLOR, cardShadow } from '../profileConstants';

interface FamilyProfilesTabProps {
  members: FamilyMember[];
  isLoading: boolean;
  /** The account holder's own counts — relatives come from `memberRecords`. */
  selfConditionCount: number;
  selfAllergyCount: number;
  /** Keyed by patientCode; filled when a relative's card is expanded. */
  memberRecords: Record<string, MemberRecords>;
  onLoadRecords: (patientCode?: string) => void;
  onAddMember: () => void;
  onEditMember: (member: FamilyMember) => void;
  onRemoveMember: (member: FamilyMember) => void;
  onOpenRecords: (member: FamilyMember, section: 'medical' | 'allergies') => void;
}

export const FamilyProfilesTab = memo<FamilyProfilesTabProps>(function FamilyProfilesTab({
  members,
  isLoading,
  selfConditionCount,
  selfAllergyCount,
  memberRecords,
  onLoadRecords,
  onAddMember,
  onEditMember,
  onRemoveMember,
  onOpenRecords,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const toggleExpanded = useCallback((member: FamilyMember) => {
    const id = member?.id ?? '';
    setExpandedId(current => (current === id ? null : id));
  }, []);

  /**
   * A relative's records are only worth fetching once their card opens — and
   * again if the cache was dropped underneath it, which is how returning from
   * their records screen brings the counts back up to date. Reading the cache
   * here rather than firing on tap is what makes the second case work.
   */
  useEffect(() => {
    const member = members?.find(item => (item?.id ?? '') === expandedId);
    if (!member || member?.relationship === 'Myself') return;

    const code = member?.patientCode ?? '';
    if (!code || memberRecords?.[code]) return;

    onLoadRecords(code);
  }, [expandedId, members, memberRecords, onLoadRecords]);

  return (
    <>
      <Text style={[styles.desc, { color: theme.colors.onSurfaceVariant }]}>
        {t('patientProfile.familyDesc')}
      </Text>

      <ListHeader
        title={t('patientProfile.familyMembersCount', { count: members?.length ?? 0 })}
        actionLabel={t('patientProfile.addFamily')}
        onAction={onAddMember}
      />

      {isLoading ? (
        <SectionLoader />
      ) : members?.length ? (
        members.map(member => {
          const isSelf = member?.relationship === 'Myself';
          const expanded = expandedId === member?.id;
          const records = memberRecords?.[member?.patientCode ?? ''];
          const conditionCount = isSelf
            ? selfConditionCount
            : records?.conditions?.length ?? 0;
          const allergyCount = isSelf ? selfAllergyCount : records?.allergies?.length ?? 0;

          return (
            <View
              key={member?.id}
              style={[styles.card, cardShadow, { backgroundColor: theme.colors.surface }]}
            >
              <View style={styles.topRow}>
                <CustomAvatar
                  type="image"
                  value={getFileUrl(member?.photoUrl)}
                  fallback={member?.fullName}
                  size={42}
                />
                <View style={styles.info}>
                  <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
                    {member?.fullName}
                  </Text>
                  <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
                    {[
                      member?.gender,
                      // A relative added without a date of birth has no age to show.
                      member?.age ? t('patientProfile.years', { count: member.age }) : '',
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.relationBadge,
                    {
                      backgroundColor: isSelf
                        ? theme.colors.primaryContainer
                        : theme.colors.surfaceVariant,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.relationText,
                      { color: isSelf ? theme.colors.primary : theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {isSelf ? t('patientProfile.myself') : relationLabel(member, t)}
                  </Text>
                </View>

                {/* Own profile is edited from the header card, not from here. */}
                {isSelf ? null : (
                  <Menu
                    visible={menuFor === member?.id}
                    onDismiss={() => setMenuFor(null)}
                    anchor={
                      <Pressable
                        onPress={() => setMenuFor(member?.id ?? null)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('patientProfile.editMember')}
                        style={styles.menuButton}
                      >
                        <Icon
                          name="dots-vertical"
                          size={18}
                          color={theme.colors.onSurfaceVariant}
                        />
                      </Pressable>
                    }
                  >
                    <Menu.Item
                      leadingIcon="pencil-outline"
                      title={t('patientProfile.editMember')}
                      onPress={() => {
                        setMenuFor(null);
                        onEditMember(member);
                      }}
                    />
                    <Menu.Item
                      leadingIcon="trash-can-outline"
                      title={t('patientProfile.removeMember')}
                      onPress={() => {
                        setMenuFor(null);
                        onRemoveMember(member);
                      }}
                    />
                  </Menu>
                )}
              </View>

              <View style={[styles.codeRow, { borderTopColor: theme.colors.outlineVariant }]}>
                <View style={styles.codeCol}>
                  <Text style={[styles.codeLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {t('patientProfile.patientCode')}
                  </Text>
                  <Text numberOfLines={1} style={[styles.codeValue, { color: theme.colors.onSurface }]}>
                    {member?.patientCode || '—'}
                  </Text>
                </View>
                <View style={styles.bloodCol}>
                  <Text style={[styles.codeLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {t('patientProfile.blood')}
                  </Text>
                  <Text style={[styles.bloodValue, { color: BLOOD_COLOR }]}>
                    {member?.bloodType || '—'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => toggleExpanded(member)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={[styles.expandRow, { borderTopColor: theme.colors.outlineVariant }]}
              >
                <Icon
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={[styles.expandText, { color: theme.colors.primary }]}>
                  {t('patientProfile.medicalAndAllergies')}
                </Text>
              </Pressable>

              {expanded ? (
                records?.isLoading ? (
                  <View style={styles.recordLoader}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  </View>
                ) : (
                  <View style={styles.recordLinks}>
                    <RecordLink
                      icon="pulse"
                      label={t('patientProfile.medicalHistoryLink')}
                      count={conditionCount}
                      onPress={() => onOpenRecords(member, 'medical')}
                    />
                    <RecordLink
                      icon="alert-circle-outline"
                      label={t('patientProfile.allergiesLink')}
                      count={allergyCount}
                      onPress={() => onOpenRecords(member, 'allergies')}
                    />
                  </View>
                )
              ) : null}
            </View>
          );
        })
      ) : (
        <EmptyState
          icon="account-multiple-outline"
          title={t('patientProfile.noFamilyMembers')}
          description={t('patientProfile.noFamilyMembersDesc')}
        />
      )}

      <Pressable
        onPress={onAddMember}
        accessibilityRole="button"
        style={[styles.addCard, { borderColor: theme.colors.primary }]}
      >
        <Icon name="plus-circle-outline" size={18} color={theme.colors.primary} />
        <Text style={[styles.addCardText, { color: theme.colors.primary }]}>
          {t('patientProfile.addFamilyMember')}
        </Text>
      </Pressable>
    </>
  );
});

/** Known relationships get a translated label; anything else shows as stored. */
const relationLabel = (member: FamilyMember, t: (key: string) => string): string => {
  const label = member?.relationshipLabel ?? '';
  return FAMILY_RELATIONSHIPS.includes(label as FamilyRelationship)
    ? t(`patientProfile.relationship${label}`)
    : label || t('patientProfile.other');
};

/** One "Medical History · 2" row inside an expanded member card. */
const RecordLink = memo<{ icon: string; label: string; count: number; onPress: () => void }>(
  function RecordLink({ icon, label, count, onPress }) {
    const theme = useTheme();

    return (
      <Pressable
        onPress={onPress}
        style={[styles.recordLink, { backgroundColor: theme.colors.surfaceVariant }]}
      >
        <Icon name={icon} size={14} color={theme.colors.primary} />
        <Text numberOfLines={1} style={[styles.recordLinkText, { color: theme.colors.onSurface }]}>
          {label}
        </Text>
        <View style={[styles.countBadge, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.countText, { color: theme.colors.onSurfaceVariant }]}>{count}</Text>
        </View>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  desc: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 16,
  },
  card: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 10,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
  },
  meta: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 1,
  },
  relationBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  relationText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
  },
  menuButton: {
    paddingLeft: 6,
    paddingVertical: 2,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
  },
  codeCol: {
    flex: 1,
  },
  bloodCol: {
    alignItems: 'flex-end',
  },
  codeLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
  },
  codeValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    marginTop: 1,
  },
  bloodValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    marginTop: 1,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 10,
  },
  expandText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  recordLoader: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  recordLinks: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  recordLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  recordLinkText: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  countBadge: {
    minWidth: 20,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: 'center',
  },
  countText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  addCardText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
});

export default FamilyProfilesTab;
