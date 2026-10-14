import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GENERAL_ID, PatientProfile, calculateAge, formatLongDate } from '@app/core';
import { CustomButton } from '@app/ui';
import { InfoRow, SectionCard } from '../ProfileComponents';

interface PersonalInfoTabProps {
  profile: PatientProfile;
  /** Localised month names for the date of birth. */
  months: string[];
  onEdit: () => void;
}

/** The profile read-only, in the portal's sections; an empty field reads "—". */
export const PersonalInfoTab = memo<PersonalInfoTabProps>(function PersonalInfoTab({
  profile,
  months,
  onEdit,
}) {
  const { t } = useTranslation();
  const idType = profile?.identificationType || GENERAL_ID;
  // A General ID has no number of its own.
  const hasIdNumber = idType !== GENERAL_ID;

  return (
    <>
      <SectionCard title={t('patientProfile.patientInformation')} icon="card-account-details-outline">
        <InfoRow
          icon="card-account-details-outline"
          label={t('patientProfile.identificationType')}
          value={idType}
        />
        {hasIdNumber ? (
          <InfoRow
            icon="numeric"
            label={t('patientProfile.identificationNumber', { type: idType })}
            value={profile?.identificationNumber}
          />
        ) : null}
        <InfoRow icon="account-outline" label={t('patientProfile.fullName')} value={profile?.fullName} />
        <InfoRow
          icon="calendar-outline"
          label={t('patientProfile.dateOfBirth')}
          value={formatLongDate(profile?.dateOfBirth, months)}
        />
        <InfoRow
          icon="cake-variant-outline"
          label={t('patientProfile.age')}
          value={
            profile?.dateOfBirth
              ? t('patientProfile.years', { count: calculateAge(profile.dateOfBirth) })
              : ''
          }
        />
        <InfoRow icon="phone-outline" label={t('patientProfile.mobileNumber')} value={profile?.phone} />
        <InfoRow icon="water-outline" label={t('patientProfile.bloodType')} value={profile?.bloodType} />
        <InfoRow icon="gender-male-female" label={t('patientProfile.gender')} value={profile?.gender} last />
      </SectionCard>

      <SectionCard title={t('patientProfile.contactInformation')} icon="map-marker-outline">
        <InfoRow icon="map-outline" label={t('patientProfile.division')} value={profile?.division} />
        <InfoRow icon="city-variant-outline" label={t('patientProfile.district')} value={profile?.district} />
        <InfoRow icon="home-city-outline" label={t('patientProfile.upazila')} value={profile?.upazila} />
        <InfoRow icon="map-marker-outline" label={t('patientProfile.address')} value={profile?.address} last />
      </SectionCard>

      <SectionCard title={t('patientProfile.careOf')} icon="account-supervisor-outline">
        <InfoRow icon="account-outline" label={t('patientProfile.name')} value={profile?.coName} />
        <InfoRow
          icon="account-heart-outline"
          label={t('patientProfile.relationship')}
          value={profile?.coRelationship}
        />
        <InfoRow
          icon="phone-outline"
          label={t('patientProfile.mobileNumber')}
          value={profile?.coMobileNumber}
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
          icon="account-heart-outline"
          label={t('patientProfile.relationship')}
          value={profile?.emergencyRelationship}
          warning
        />
        <InfoRow
          icon="phone-outline"
          label={t('patientProfile.mobileNumber')}
          value={profile?.emergencyPhone}
          warning
        />
        <InfoRow
          icon="map-marker-outline"
          label={t('patientProfile.address')}
          value={profile?.emergencyAddress}
          warning
          last
        />
      </SectionCard>

      <SectionCard title={t('patientProfile.otherInformation')} icon="information-outline">
        <InfoRow icon="briefcase-outline" label={t('patientProfile.occupation')} value={profile?.occupation} />
        <InfoRow icon="flag-outline" label={t('patientProfile.nationality')} value={profile?.nationality} />
        <InfoRow
          icon="fingerprint"
          label={t('patientProfile.identityMark')}
          value={profile?.identityMark}
        />
        <InfoRow icon="hands-pray" label={t('patientProfile.religion')} value={profile?.religion} />
        <InfoRow icon="email-outline" label={t('patientProfile.email')} value={profile?.email} last />
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
