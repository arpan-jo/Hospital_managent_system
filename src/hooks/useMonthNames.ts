import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Localised short month names in calendar order, for the `format` helpers that
 * take them as an argument (they stay Intl-free for Hermes).
 */
export const useMonthNames = (): string[] => {
  const { t } = useTranslation();
  return useMemo(() => Array.from({ length: 12 }, (_, index) => t(`months.${index}`)), [t]);
};

export default useMonthNames;
