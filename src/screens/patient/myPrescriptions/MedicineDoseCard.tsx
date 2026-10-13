import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DoseSlot, stripHonorific } from '@app/core';
import { CustomAvatar, fontFamilies } from '@app/ui';
import { MedicineDose } from './useTodaysMedicinesViewModel';

interface MedicineDoseCardProps {
  dose: MedicineDose;
  /** The slot tab this card is rendered under — what "taken" applies to. */
  slot: DoseSlot;
  taken: boolean;
  onToggleTaken: (medicineId: string, slot: DoseSlot) => void;
}

export const MedicineDoseCard = memo<MedicineDoseCardProps>(function MedicineDoseCard({
  dose,
  slot,
  taken,
  onToggleTaken,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const handleToggle = useCallback(
    () => onToggleTaken(dose?.id ?? '', slot),
    [onToggleTaken, dose?.id, slot],
  );

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: taken ? theme.colors.primary : theme.colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
          {dose?.name}
        </Text>
        <Pressable
          onPress={handleToggle}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: taken }}
          accessibilityLabel={t('todaysMedicines.markTaken')}
        >
          <Icon
            name={taken ? 'check-circle' : 'checkbox-blank-circle-outline'}
            size={18}
            color={taken ? theme.colors.primary : theme.colors.outlineVariant}
          />
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        {/* The doctor's own pattern, e.g. "1-0-1", shown as they wrote it. */}
        {dose?.frequency ? (
          <View style={[styles.pattern, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text style={[styles.patternText, { color: theme.colors.primary }]}>
              {dose.frequency}
            </Text>
          </View>
        ) : null}
        <Text numberOfLines={1} style={[styles.form, { color: theme.colors.onSurfaceVariant }]}>
          {[dose?.form, dose?.duration].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {dose?.instruction ? (
        <Text
          numberOfLines={1}
          style={[styles.instruction, { color: theme.colors.onSurfaceVariant }]}
        >
          {dose.instruction}
        </Text>
      ) : null}

      <View style={styles.doctorRow}>
        <CustomAvatar type="text" value={stripHonorific(dose?.doctorName) || '?'} size={18} />
        <Text numberOfLines={1} style={[styles.doctor, { color: theme.colors.onSurface }]}>
          {dose?.doctorName}
        </Text>
      </View>

      <Text numberOfLines={1} style={[styles.patient, { color: theme.colors.primary }]}>
        {dose?.patientName}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  pattern: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  patternText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
  },
  form: {
    flexShrink: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 10,
  },
  instruction: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    marginTop: 4,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  doctor: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 11,
  },
  patient: {
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    marginTop: 4,
  },
});

export default MedicineDoseCard;
