import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Allergy } from '@app/core';
import { fontFamilies } from '@app/ui';
import { EmptyState, ListHeader, SectionLoader } from '../ProfileComponents';
import RecordCard from '../RecordCard';
import { SEVERITY_COLOR, useWarningColors } from '../profileConstants';

interface AllergiesTabProps {
  allergies: Allergy[];
  isLoading: boolean;
  /** Null while the list loaded; otherwise the server's words, '' when it sent none. */
  error: string | null;
  onRetry: () => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export const AllergiesTab = memo<AllergiesTabProps>(function AllergiesTab({
  allergies,
  isLoading,
  error,
  onRetry,
  onAdd,
  onRemove,
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const amber = useWarningColors(theme.dark);

  return (
    <>
      <View
        style={[
          styles.banner,
          { backgroundColor: amber.background, borderColor: amber.border },
        ]}
      >
        <Icon name="alert-outline" size={16} color={amber.border} />
        <View style={styles.bannerText}>
          <Text style={[styles.bannerTitle, { color: amber.title }]}>
            {t('patientProfile.knownAllergies')}
          </Text>
          <Text style={[styles.bannerDesc, { color: amber.text }]}>
            {t('patientProfile.knownAllergiesDesc')}
          </Text>
        </View>
      </View>

      <ListHeader
        title={t('patientProfile.allergiesRecorded', { count: allergies?.length ?? 0 })}
        actionLabel={t('patientProfile.addAllergyAction')}
        onAction={onAdd}
      />

      {isLoading ? (
        <SectionLoader />
      ) : error !== null ? (
        <EmptyState
          icon="alert-circle-outline"
          title={error || t('common.somethingWentWrong')}
          actionLabel={t('common.retry')}
          onAction={onRetry}
        />
      ) : allergies?.length ? (
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
            onRemove={() => onRemove(allergy?.id)}
          />
        ))
      ) : (
        <EmptyState
          icon="shield-alert-outline"
          title={t('patientProfile.noAllergies')}
          description={t('patientProfile.noAllergiesDesc')}
          actionLabel={t('patientProfile.addAllergyAction')}
          onAction={onAdd}
        />
      )}
    </>
  );
});

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
  },
  bannerDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
});

export default AllergiesTab;
