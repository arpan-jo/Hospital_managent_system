import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  FamilyProfileForm,
  PatientProfile,
  UploadFile,
  calculateAge,
  formatLongDate,
  getFileUrl,
  useStores,
} from '@app/core';
import { CustomAvatar, CustomDialog, fontFamilies } from '@app/ui';
import PhotoPickerSheet from '../../../../components/PhotoPickerSheet';
import AddConditionSheet from '../../../common/profileSheets/AddConditionSheet';
import AddAllergySheet from '../../../common/profileSheets/AddAllergySheet';
import { EmptyState, ListHeader, SectionLoader } from '../ProfileComponents';
import RecordCard from '../RecordCard';
import FamilyMemberSheet from '../FamilyMemberSheet';
import { BLOOD_COLOR, SEVERITY_COLOR, STATUS_COLOR, cardShadow } from '../profileConstants';
import { FamilyProfilesViewModel, MemberRecords } from '../useFamilyProfilesViewModel';

/** Each relationship's badge colours, as the portal tints them. */
const RELATION_COLOR: Record<string, { bg: string; fg: string }> = {
  self: { bg: '#EAF0FF', fg: '#2F55D4' },
  spouse: { bg: '#FDECF3', fg: '#D23F7A' },
  child: { bg: '#FFF6DB', fg: '#B07D00' },
  parent: { bg: '#F2EAFE', fg: '#7C4DDB' },
  sibling: { bg: '#E6F6EC', fg: '#1B8A4B' },
  other: { bg: '#F1F2F4', fg: '#616B7A' },
};

const relationKey = (relationship?: string) =>
  RELATION_COLOR[relationship ?? ''] ? (relationship as string) : 'other';

// ─── The patient code, copied on tap ───────────────────────────────────────

const CopyCode = memo<{ code: string }>(function CopyCode({ code }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { toastStore } = useStores();
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [isCopied]);

  const handleCopy = useCallback(() => {
    if (!code) return;
    Clipboard.setString(code);
    setIsCopied(true);
    toastStore.show(t('patientProfile.codeCopied'), 'success');
  }, [code, toastStore, t]);

  return (
    <Pressable
      onPress={handleCopy}
      disabled={!code}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t('patientProfile.copyCode')}
      style={[styles.copy, { backgroundColor: theme.colors.primaryContainer }]}
    >
      <Text style={[styles.code, { color: theme.colors.primary }]}>{code || '—'}</Text>
      {code ? (
        <Icon
          name={isCopied ? 'check' : 'content-copy'}
          size={13}
          color={isCopied ? '#1B9C5D' : theme.colors.primary}
        />
      ) : null}
    </Pressable>
  );
});

// ─── One profile's records ─────────────────────────────────────────────────

const RecordsPanel = memo<{
  records?: MemberRecords;
  months: string[];
  onRetry: () => void;
  onAddCondition: () => void;
  onAddAllergy: () => void;
  onRemoveCondition: (id: string) => void;
  onRemoveAllergy: (id: string) => void;
}>(function RecordsPanel({
  records,
  months,
  onRetry,
  onAddCondition,
  onAddAllergy,
  onRemoveCondition,
  onRemoveAllergy,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (!records || records?.isLoading) return <SectionLoader />;
  if (records?.error !== null) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title={records?.error || t('common.somethingWentWrong')}
        actionLabel={t('common.retry')}
        onAction={onRetry}
      />
    );
  }

  const conditions = records?.conditions ?? [];
  const allergies = records?.allergies ?? [];
  const muted = { color: theme.colors.onSurfaceVariant };

  return (
    <View style={styles.panel}>
      <ListHeader
        title={`${t('patientProfile.medicalHistory')} (${conditions.length})`}
        actionLabel={t('patientProfile.add')}
        onAction={onAddCondition}
      />
      {conditions.length ? (
        conditions.map(condition => (
          <RecordCard
            key={condition?.id}
            accent={STATUS_COLOR[condition?.status] ?? STATUS_COLOR.Active}
            icon="pulse"
            title={condition?.name}
            badgeLabel={t(`patientProfile.status${condition?.status}`)}
            meta={
              condition?.diagnosedDate
                ? t('patientProfile.diagnosed', {
                    date: formatLongDate(condition.diagnosedDate, months),
                  })
                : undefined
            }
            metaIcon="calendar-outline"
            detailLabel={t('patientProfile.notes')}
            detailText={condition?.notes}
            removeLabel={t('patientProfile.removeCondition')}
            onRemove={() => onRemoveCondition(condition?.id)}
          />
        ))
      ) : (
        <Text style={[styles.emptyText, muted]}>{t('patientProfile.noConditions')}</Text>
      )}

      <ListHeader
        title={`${t('patientProfile.tabAllergies')} (${allergies.length})`}
        actionLabel={t('patientProfile.add')}
        onAction={onAddAllergy}
      />
      {allergies.length ? (
        allergies.map(allergy => (
          <RecordCard
            key={allergy?.id}
            accent={SEVERITY_COLOR[allergy?.severity] ?? SEVERITY_COLOR.Mild}
            icon="alert-outline"
            title={allergy?.name}
            badgeLabel={t(`patientProfile.severity${allergy?.severity}`)}
            detailLabel={t('patientProfile.reaction')}
            detailText={allergy?.reaction}
            removeLabel={t('patientProfile.removeAllergy')}
            onRemove={() => onRemoveAllergy(allergy?.id)}
          />
        ))
      ) : (
        <Text style={[styles.emptyText, muted]}>{t('patientProfile.noAllergies')}</Text>
      )}
    </View>
  );
});

// ─── One profile's card ────────────────────────────────────────────────────

const MemberCard = memo<{
  profile: PatientProfile;
  isExpanded: boolean;
  isPhotoUploading: boolean;
  onPhoto: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onToggle: () => void;
  children?: React.ReactNode;
}>(function MemberCard({
  profile,
  isExpanded,
  isPhotoUploading,
  onPhoto,
  onEdit,
  onRemove,
  onToggle,
  children,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isSelf = profile?.relationship === 'self';
  const relation = relationKey(profile?.relationship);
  const relationColor = RELATION_COLOR[relation];
  const muted = theme.colors.onSurfaceVariant;

  const summary = [
    profile?.gender,
    profile?.dateOfBirth
      ? t('patientProfile.years', { count: calculateAge(profile.dateOfBirth) })
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={[
        styles.card,
        cardShadow,
        {
          backgroundColor: theme.colors.surface,
          borderColor: isExpanded ? theme.colors.primary : 'transparent',
        },
      ]}
    >
      <View style={styles.topRow}>
        <Pressable
          onPress={onPhoto}
          disabled={isPhotoUploading}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t('photoPicker.title')}
        >
          <CustomAvatar
            type="image"
            value={getFileUrl(profile?.photoUrl)}
            fallback={profile?.fullName}
            size={56}
          />
          {isPhotoUploading ? (
            <View style={styles.uploading}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : null}
          <View
            style={[
              styles.cameraBadge,
              { backgroundColor: theme.colors.primary, borderColor: theme.colors.surface },
            ]}
          >
            <Icon name="camera-outline" size={10} color={theme.colors.onPrimary} />
          </View>
        </Pressable>

        <View style={styles.identity}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
            {profile?.fullName || t('patientProfile.unnamed')}
          </Text>
          <Text numberOfLines={1} style={[styles.summary, { color: muted }]}>
            {summary || '—'}
          </Text>
        </View>

        {/* The holder's own profile is edited on the Personal tab and cannot be removed. */}
        {isSelf ? null : (
          <View style={styles.cardActions}>
            <Pressable
              onPress={onEdit}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('patientProfile.editProfile')}
              style={[styles.iconButton, { backgroundColor: theme.colors.primaryContainer }]}
            >
              <Icon name="pencil-outline" size={15} color={theme.colors.primary} />
            </Pressable>
            <Pressable
              onPress={onRemove}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('patientProfile.removeProfile')}
              style={[styles.iconButton, { backgroundColor: theme.colors.errorContainer }]}
            >
              <Icon name="trash-can-outline" size={15} color={theme.colors.error} />
            </Pressable>
          </View>
        )}
      </View>

      <View style={[styles.metaBlock, { borderTopColor: theme.colors.outlineVariant }]}>
        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: muted }]}>{t('patientProfile.relationship')}</Text>
          <View style={[styles.relationBadge, { backgroundColor: relationColor.bg }]}>
            <Text style={[styles.relationText, { color: relationColor.fg }]}>
              {t(`patientProfile.relation_${relation}`)}
            </Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: muted }]}>{t('patientProfile.patientCode')}</Text>
          <CopyCode code={profile?.patientCode ?? ''} />
        </View>
        {profile?.bloodType ? (
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: muted }]}>{t('patientProfile.blood')}</Text>
            <Text style={[styles.metaValue, { color: BLOOD_COLOR }]}>{profile.bloodType}</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        style={[
          styles.toggle,
          isExpanded
            ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
            : { borderColor: theme.colors.outlineVariant },
        ]}
      >
        <Icon
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={isExpanded ? theme.colors.onPrimary : muted}
        />
        <Text
          style={[styles.toggleText, { color: isExpanded ? theme.colors.onPrimary : muted }]}
        >
          {isExpanded ? t('patientProfile.hideDetails') : t('patientProfile.medicalAndAllergies')}
        </Text>
      </Pressable>

      {isExpanded ? children : null}
    </View>
  );
});

// ─── The tab ───────────────────────────────────────────────────────────────

interface FamilyProfilesTabProps {
  viewModel: FamilyProfilesViewModel;
}

/** The portal's Family Profiles: every profile on the account, each with its own records. */
export const FamilyProfilesTab = memo<FamilyProfilesTabProps>(function FamilyProfilesTab({
  viewModel,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => t(`months.${index}`)), [t]);

  const {
    profiles,
    isLoading,
    error,
    reload,
    records,
    loadRecords,
    addCondition,
    removeCondition,
    addAllergy,
    removeAllergy,
    saveMember,
    removeMember,
    uploadPhoto,
    photoUploadingCode,
  } = viewModel;

  const [expandedCode, setExpandedCode] = useState('');
  /** Which sheet is open: the member form (null target adds), a record sheet, or the photo picker. */
  const [memberSheet, setMemberSheet] = useState<{ target: PatientProfile | null } | null>(null);
  const [conditionFor, setConditionFor] = useState('');
  const [allergyFor, setAllergyFor] = useState('');
  const [photoFor, setPhotoFor] = useState<PatientProfile | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PatientProfile | null>(null);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggle = useCallback(
    (code: string) => {
      setExpandedCode(current => {
        const next = current === code ? '' : code;
        if (next) loadRecords(next);
        return next;
      });
    },
    [loadRecords],
  );

  const handleSave = useCallback(
    (form: FamilyProfileForm, photo: UploadFile | null) =>
      saveMember(form, photo, memberSheet?.target ?? null),
    [saveMember, memberSheet],
  );

  const handlePhotoPicked = useCallback(
    (file: UploadFile) => {
      if (photoFor) uploadPhoto(photoFor, file);
    },
    [photoFor, uploadPhoto],
  );

  const handleConfirmRemove = useCallback(() => {
    const code = removeTarget?.patientCode ?? '';
    setRemoveTarget(null);
    if (code) removeMember(code);
  }, [removeTarget, removeMember]);

  const openAdd = useCallback(() => setMemberSheet({ target: null }), []);

  return (
    <>
      <Text style={[styles.desc, { color: theme.colors.onSurfaceVariant }]}>
        {t('patientProfile.familyDesc')}
      </Text>
      <ListHeader
        title={t('patientProfile.familyProfilesCount', { count: profiles?.length ?? 0 })}
        actionLabel={t('patientProfile.addFamilyMember')}
        onAction={openAdd}
      />

      {isLoading && !profiles?.length ? (
        <SectionLoader />
      ) : error !== null ? (
        <EmptyState
          icon="alert-circle-outline"
          title={error || t('common.somethingWentWrong')}
          actionLabel={t('common.retry')}
          onAction={reload}
        />
      ) : (
        <>
          {profiles?.map(profile => {
            const code = profile?.patientCode ?? '';
            return (
              <MemberCard
                key={code || String(profile?.patientProfileId)}
                profile={profile}
                isExpanded={!!code && expandedCode === code}
                isPhotoUploading={!!code && photoUploadingCode === code}
                onPhoto={() => setPhotoFor(profile)}
                onEdit={() => setMemberSheet({ target: profile })}
                onRemove={() => setRemoveTarget(profile)}
                onToggle={() => toggle(code)}
              >
                <RecordsPanel
                  records={records?.[code]}
                  months={months}
                  onRetry={() => loadRecords(code)}
                  onAddCondition={() => setConditionFor(code)}
                  onAddAllergy={() => setAllergyFor(code)}
                  onRemoveCondition={id => removeCondition(code, id)}
                  onRemoveAllergy={id => removeAllergy(code, id)}
                />
              </MemberCard>
            );
          })}

          <Pressable
            onPress={openAdd}
            accessibilityRole="button"
            style={[styles.addCard, { borderColor: theme.colors.outlineVariant }]}
          >
            <View style={[styles.addIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon name="plus" size={20} color={theme.colors.primary} />
            </View>
            <Text style={[styles.addText, { color: theme.colors.onSurfaceVariant }]}>
              {t('patientProfile.addFamilyMember')}
            </Text>
          </Pressable>
        </>
      )}

      <FamilyMemberSheet
        visible={!!memberSheet}
        target={memberSheet?.target ?? null}
        onClose={() => setMemberSheet(null)}
        onSave={handleSave}
      />
      <AddConditionSheet
        visible={!!conditionFor}
        onClose={() => setConditionFor('')}
        onAdd={input => addCondition(conditionFor, input)}
      />
      <AddAllergySheet
        visible={!!allergyFor}
        onClose={() => setAllergyFor('')}
        onAdd={input => addAllergy(allergyFor, input)}
      />
      <PhotoPickerSheet
        visible={!!photoFor}
        onClose={() => setPhotoFor(null)}
        onPicked={handlePhotoPicked}
      />
      <CustomDialog
        visible={!!removeTarget}
        title={t('patientProfile.removeProfile')}
        message={t('patientProfile.removeProfileConfirm', {
          name: removeTarget?.fullName || removeTarget?.patientCode || '',
        })}
        confirmText={t('patientProfile.remove')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmRemove}
        onDismiss={() => setRemoveTarget(null)}
      />
    </>
  );
});

const styles = StyleSheet.create({
  desc: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginTop: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploading: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
  },
  summary: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 10,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  relationBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  relationText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  code: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    marginTop: 12,
  },
  toggleText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  panel: {
    marginTop: 4,
  },
  emptyText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 10,
  },
  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 22,
    marginTop: 12,
  },
  addIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
});

export default FamilyProfilesTab;
