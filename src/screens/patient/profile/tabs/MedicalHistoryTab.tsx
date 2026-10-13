import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MedicalCondition, formatLongDate } from '@app/core';
import { EmptyState, ListHeader, SectionLoader } from '../ProfileComponents';
import RecordCard from '../RecordCard';
import { STATUS_COLOR } from '../profileConstants';

interface MedicalHistoryTabProps {
  conditions: MedicalCondition[];
  isLoading: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export const MedicalHistoryTab = memo<MedicalHistoryTabProps>(function MedicalHistoryTab({
  conditions,
  isLoading,
  onAdd,
  onRemove,
}) {
  const { t } = useTranslation();
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => t(`months.${index}`)), [t]);

  return (
    <>
      <ListHeader
        title={t('patientProfile.conditionsOnRecord', { count: conditions?.length ?? 0 })}
        actionLabel={t('patientProfile.addConditionAction')}
        onAction={onAdd}
      />

      {isLoading ? (
        <SectionLoader />
      ) : conditions?.length ? (
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
            onRemove={() => onRemove(condition?.id)}
          />
        ))
      ) : (
        <EmptyState
          icon="clipboard-pulse-outline"
          title={t('patientProfile.noConditions')}
          description={t('patientProfile.noConditionsDesc')}
          actionLabel={t('patientProfile.addConditionAction')}
          onAction={onAdd}
        />
      )}
    </>
  );
});

export default MedicalHistoryTab;
