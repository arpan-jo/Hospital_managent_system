import React, { memo, useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  DEFAULT_REMINDER_SCHEDULE,
  DoseSlot,
  DOSE_SLOTS,
  ReminderSchedule,
  to12Hour,
} from '@app/core';
import { CustomBottomSheet, CustomButton, fontFamilies } from '@app/ui';

interface ReminderScheduleSheetProps {
  visible: boolean;
  onClose: () => void;
  schedule: ReminderSchedule;
  onSave: (schedule: ReminderSchedule) => void;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** 'HH:mm' -> today's Date at that time. Unparseable input falls back to 08:00. */
const toDate = (time: string): Date => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? '');
  const date = new Date();
  date.setHours(match ? Number(match[1]) : 8, match ? Number(match[2]) : 0, 0, 0);
  return date;
};

const toTimeString = (date: Date): string => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

/**
 * The picker is rendered inline rather than through `CustomDatePicker`, whose
 * iOS dialog lives in a Portal at the app root — a separate layer from the
 * native Modal behind `CustomBottomSheet`, so it would open behind the sheet.
 */
export const ReminderScheduleSheet = memo<ReminderScheduleSheetProps>(
  function ReminderScheduleSheet({ visible, onClose, schedule, onSave }) {
    const theme = useTheme();
    const { t } = useTranslation();
      const [draft, setDraft] = useState<ReminderSchedule>(schedule);
    const [editingSlot, setEditingSlot] = useState<DoseSlot | null>(null);

    // Re-seeds the draft from the saved schedule each time the sheet opens.
    useEffect(() => {
      if (visible) {
        setDraft(schedule);
        setEditingSlot(null);
      }
    }, [visible, schedule]);

    const handleChange = useCallback(
      (event: DateTimePickerEvent, selected?: Date) => {
        if (Platform.OS === 'android') setEditingSlot(null);
        if (event.type === 'set' && selected && editingSlot) {
          setDraft(prev => ({ ...prev, [editingSlot]: toTimeString(selected) }));
        }
      },
      [editingSlot],
    );

    const handleReset = useCallback(() => setDraft(DEFAULT_REMINDER_SCHEDULE), []);
    const handleSave = useCallback(() => onSave(draft), [onSave, draft]);

    return (
      <CustomBottomSheet visible={visible} onClose={onClose} style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerTitles}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {t('todaysMedicines.scheduleTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
              {t('todaysMedicines.scheduleSubtitle')}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={[styles.close, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <Icon name="close" size={16} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        </View>

        {DOSE_SLOTS.map(slot => {
          const isEditing = editingSlot === slot;
          return (
            <View key={slot}>
              <Pressable
                onPress={() => setEditingSlot(isEditing ? null : slot)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isEditing }}
                style={[
                  styles.row,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: isEditing ? theme.colors.primary : theme.colors.outlineVariant,
                  },
                ]}
              >
                <Text style={[styles.slotLabel, { color: theme.colors.onSurface }]}>
                  {t(`todaysMedicines.slots.${slot}`)}
                </Text>
                <View style={styles.timeRow}>
                  <Text style={[styles.time, { color: theme.colors.onSurface }]}>
                    {to12Hour(draft[slot])}
                  </Text>
                  <Icon
                    name={isEditing ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.colors.onSurfaceVariant}
                  />
                </View>
              </Pressable>

              {isEditing && Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={toDate(draft[slot])}
                  mode="time"
                  display="spinner"
                  onChange={handleChange}
                  textColor={theme.colors.onSurface}
                />
              ) : null}
            </View>
          );
        })}

        {editingSlot && Platform.OS === 'android' ? (
          <DateTimePicker
            value={toDate(draft[editingSlot])}
            mode="time"
            display="default"
            onChange={handleChange}
          />
        ) : null}

        <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
          {t('todaysMedicines.scheduleHint')}
        </Text>

        {/* No bottom padding here — CustomBottomSheet already applies the safe-area gap. */}
      <View style={styles.actions}>
          <Pressable onPress={handleReset} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.resetText, { color: theme.colors.onSurfaceVariant }]}>
              {t('todaysMedicines.resetDefaults')}
            </Text>
          </Pressable>
          <CustomButton mode="contained" onPress={handleSave} style={styles.saveButton}>
            {t('todaysMedicines.saveSchedule')}
          </CustomButton>
        </View>
      </CustomBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitles: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
  },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 8,
  },
  slotLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  time: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  hint: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  resetText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  saveButton: {
    marginVertical: 0,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
});

export default ReminderScheduleSheet;
