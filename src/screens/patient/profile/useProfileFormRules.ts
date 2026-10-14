import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GENERAL_ID, isBdMobile } from '@app/core';

/** Same shape the sign-up screen validates against, so both agree on "valid". */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Form values are typed `string | Date | undefined` (the date pickers share the
 * form), so a rule reads its value defensively rather than assuming a string.
 */
const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Validation for the profile form and the record sheets, as the portal checks
 * them: name, date of birth, mobile, blood group and gender are required (what
 * a booking needs), the ID number when the ID is not a General ID, and a phone
 * or email only once it is filled in.
 */
export const useProfileFormRules = () => {
  const { t } = useTranslation();

  return useMemo(() => {
    const required = t('patientProfile.required');

    return {
      requiredText: {
        validate: (value: unknown) => asText(value).length > 0 || required,
      },
      requiredDate: {
        validate: (value: unknown) => value instanceof Date || required,
      },
      fullName: {
        validate: (value: unknown) =>
          asText(value).length > 0 || t('patientProfile.invalidFullName'),
      },
      // Needed only when the ID type has a number of its own.
      identificationNumber: {
        validate: (value: unknown, values: { identificationType?: string }) =>
          (values?.identificationType || GENERAL_ID) === GENERAL_ID ||
          asText(value).length > 0 ||
          required,
      },
      mobile: {
        validate: (value: unknown) => {
          const text = asText(value);
          if (!text) return required;
          return isBdMobile(text) || t('patientProfile.invalidBdPhone');
        },
      },
      // Optional, but a Bangladesh mobile once filled in.
      optionalMobile: {
        validate: (value: unknown) => {
          const text = asText(value);
          return !text || isBdMobile(text) || t('patientProfile.invalidBdPhone');
        },
      },
      email: {
        validate: (value: unknown) => {
          const text = asText(value);
          return !text || EMAIL_PATTERN.test(text) || t('patientProfile.invalidEmail');
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
    };
  }, [t]);
};

export default useProfileFormRules;
