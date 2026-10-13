import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isBdMobile } from '@app/core';

/** Same shape the sign-up screen validates against, so both agree on "valid". */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Any phone-looking number — a relative can live abroad, and the web's family form does not check. */
const ANY_PHONE_PATTERN = /^[0-9+\-\s]{6,}$/;

/**
 * Form values are typed `string | Date | undefined` (the date pickers share the
 * form), so a rule reads its value defensively rather than assuming a string.
 */
const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Validation rules for the profile forms, in the same `rules={{ required }}`
 * shape the auth screens use — so a missing field reads "Please enter your …"
 * under the field, not a silently disabled button.
 *
 * Required-ness follows the API: only `fullName` (plus `relationship` for a
 * relative) is mandatory — swagger's `CreatePatientProfileDto`, and
 * `strFullName`/`strCondition`/`strAllergen` are the NOT NULL columns.
 * Everything else is validated only once the user has filled it in.
 */
export const useProfileFormRules = () => {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      fullName: {
        validate: (value: unknown) =>
          asText(value).length > 0 || t('patientProfile.invalidFullName'),
      },
      relationship: {
        validate: (value: unknown) =>
          asText(value).length > 0 || t('patientProfile.invalidRelationship'),
      },
      // Optional, but a typo must not reach the API as a 400.
      email: {
        validate: (value: unknown) => {
          const text = asText(value);
          return !text || EMAIL_PATTERN.test(text) || t('patientProfile.invalidEmail');
        },
      },
      // A Bangladesh mobile number, as the web profile form requires
      // (`validateBDPhone`) — '+880' and spaces are fine, any six digits are not.
      phone: {
        validate: (value: unknown) => {
          const text = asText(value);
          return !text || isBdMobile(text) || t('patientProfile.invalidBdPhone');
        },
      },
      memberPhone: {
        validate: (value: unknown) => {
          const text = asText(value);
          return !text || ANY_PHONE_PATTERN.test(text) || t('patientProfile.invalidPhone');
        },
      },
      condition: {
        validate: (value: unknown) =>
          asText(value).length > 0 || t('patientProfile.invalidCondition'),
      },
      allergen: {
        validate: (value: unknown) =>
          asText(value).length > 0 || t('patientProfile.invalidAllergen'),
      },
    }),
    [t],
  );
};

export default useProfileFormRules;
