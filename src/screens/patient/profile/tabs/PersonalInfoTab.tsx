import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PatientProfile, formatLongDate } from '@app/core';
import { CustomButton } from '@app/ui';
import { InfoRow, SectionCard } from '../ProfileComponents';

interface PersonalInfoTabProps {
  profile: PatientProfile;
  /** Localised month names for the date of birth. */
  months: string[];
  onEdit: () => void;
}

export const PersonalInfoTab = memo<PersonalInfoTabProps>(function PersonalInfoTab({
  profile,
  months,
  onEdit,
}) {
  const { t } = useTranslation();

  return (
    <>
      <SectionCard title={t('patientProfile.basicInformation')} icon="card-account-details-outline">
        <InfoRow
          icon="account-outline"
          label={t('patientProfile.fullName')}
          value={profile?.fullName}
        />
        <InfoRow
          icon="calendar-outline"
          label={t('patientProfile.dateOfBirth')}
          value={formatLongDate(profile?.dateOfBirth, months)}
        />
        <InfoRow
          icon="gender-male-female"
          label={t('patientProfile.gender')}
          value={profile?.gender}
        />
        <InfoRow
          icon="water-outline"
          label={t('patientProfile.bloodType')}
          value={profile?.bloodType}
          last
        />
      </SectionCard>

      <SectionCard title={t('patientProfile.contactInformation')} icon="phone-outline">
        <InfoRow icon="phone-outline" label={t('patientProfile.phone')} value={profile?.phone} />
        <InfoRow icon="email-outline" label={t('patientProfile.email')} value={profile?.email} />
        <InfoRow
          icon="map-marker-outline"
          label={t('patientProfile.address')}
          value={profile?.address}
          last
        />
      </SectionCard>

      <SectionCard title={t('patientProfile.emergencyContact')} warning>
        <InfoRow
          icon="account-outline"
          label={t('patientProfile.contactPerson')}
          value={profile?.emergencyContact}
          warning
        />
        <InfoRow
          icon="phone-outline"
          label={t('patientProfile.phone')}
          value={profile?.emergencyPhone}
          warning
          last
        />
      </SectionCard>

      <CustomButton mode="outlined" icon="pencil-outline" onPress={onEdit} style={styles.editButton}>
        {t('patientProfile.editProfile')}
      </CustomButton>
    </>
  );
});

const styles = StyleSheet.create({
  editButton: {
    marginTop: 16,
    borderRadius: 12,
  },
});

export default PersonalInfoTab;
