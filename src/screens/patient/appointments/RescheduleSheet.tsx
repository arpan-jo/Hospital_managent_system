import React, { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppointmentDetail, formatLongDate, fromISODate, to12Hour, toISODate } from '@app/core';
import { CustomBottomSheet, CustomButton, CustomDatePicker, fontFamilies } from '@app/ui';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { RESCHEDULE_DAYS, isSlotFull, useReschedule } from './useReschedule';

interface RescheduleSheetProps {
  visible: boolean;
  detail: AppointmentDetail | null;
  onClose: () => void;
  /** The appointment as the server answered after moving it — null when it sent none. */
  onRescheduled: (updated: AppointmentDetail | null) => void;
}

/** The next fortnight, today first, as "YYYY-MM-DD". */
const nextDays = (count: number): string[] => {
  const start = new Date();
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return toISODate(day);
  });
};

/**
 * The portal's Reschedule sheet, laid out for a phone: a strip of the coming
 * days (and a calendar for later ones), that day's windows, a time inside the
 * chosen one, and the button that moves the appointment.
 */
export const RescheduleSheet = memo<RescheduleSheetProps>(function RescheduleSheet({
  visible,
  detail,
  onClose,
  onRescheduled,
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const months = useMonthNames();
  const muted = theme.colors.onSurfaceVariant;

  const viewModel = useReschedule(detail, visible, updated => {
    onRescheduled(updated);
    onClose();
  });
  const { date, slots, selectedSlot, time } = viewModel;
  const days = useMemo(() => (visible ? nextDays(RESCHEDULE_DAYS) : []), [visible]);
  const today = days[0] ?? toISODate(new Date());
  const subSlots = selectedSlot?.subSlots ?? [];

  const close = () => {
    if (!viewModel.isSaving) onClose();
  };

  return (
    <CustomBottomSheet visible={visible} onClose={close}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name="calendar-clock" size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>{t('reschedule.title')}</Text>
          <Text style={[styles.subtitle, { color: muted }]}>{t('reschedule.subtitle')}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Now ── */}
        {detail?.date ? (
          <View style={[styles.current, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Icon name="calendar-outline" size={15} color={muted} />
            <Text style={[styles.currentText, { color: muted }]}>
              {t('reschedule.current', {
                date: formatLongDate(detail.date, months),
                time: to12Hour(detail?.time ?? '') || '—',
              })}
            </Text>
          </View>
        ) : null}

        {/* ── A day ── */}
        <Text style={[styles.label, { color: theme.colors.onSurface }]}>{t('reschedule.pickDate')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
          {days.map(day => {
            const value = fromISODate(day);
            const active = day === date;
            return (
              <Pressable
                key={day}
                onPress={() => viewModel.pickDate(day)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={formatLongDate(day, months)}
                style={[
                  styles.day,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                    borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                  },
                ]}
              >
                <Text style={[styles.dayName, { color: active ? theme.colors.onPrimary : muted }]}>
                  {day === today ? t('reschedule.today') : t(`days.${value.getDay()}`)}
                </Text>
                <Text style={[styles.dayNumber, { color: active ? theme.colors.onPrimary : theme.colors.onSurface }]}>
                  {value.getDate()}
                </Text>
                <Text style={[styles.dayMonth, { color: active ? theme.colors.onPrimary : muted }]}>
                  {months?.[value.getMonth()] ?? ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <CustomDatePicker
          label={t('reschedule.otherDate')}
          value={fromISODate(date)}
          minimumDate={fromISODate(today)}
          onChange={picked => {
            if (picked) viewModel.pickDate(toISODate(picked));
          }}
          formatString={picked => formatLongDate(toISODate(picked), months)}
          style={styles.datePicker}
        />

        {/* ── That day's windows ── */}
        <Text style={[styles.label, { color: theme.colors.onSurface }]}>{t('reschedule.pickSlot')}</Text>
        {viewModel.isSlotsLoading ? (
          <View style={styles.state}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : viewModel.slotsError !== null ? (
          <View style={[styles.empty, { borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.emptyText, { color: muted }]}>
              {viewModel.slotsError || t('reschedule.slotsFailed')}
            </Text>
            <CustomButton mode="text" onPress={viewModel.retrySlots}>
              {t('common.retry')}
            </CustomButton>
          </View>
        ) : slots.length === 0 ? (
          <View style={[styles.empty, { borderColor: theme.colors.outlineVariant }]}>
            <Icon name="calendar-remove-outline" size={22} color={muted} />
            <Text style={[styles.emptyText, { color: muted }]}>{t('reschedule.noSlots')}</Text>
          </View>
        ) : (
          <View style={styles.slots}>
            {slots.map(slot => {
              const full = isSlotFull(slot);
              const active = slot?.slotId === viewModel.slotId;
              const hasCapacity = (slot?.bookingCapacity ?? 0) > 0;
              return (
                <Pressable
                  key={slot?.slotId}
                  disabled={full}
                  onPress={() => viewModel.pickSlot(slot)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: full, selected: active }}
                  style={[
                    styles.slot,
                    {
                      backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                      borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                    },
                    full && styles.disabled,
                  ]}
                >
                  <Text style={[styles.slotTime, { color: active ? theme.colors.onPrimary : theme.colors.onSurface }]}>
                    {`${to12Hour(slot?.startTime ?? '')} – ${to12Hour(slot?.endTime ?? '')}`}
                  </Text>
                  {full || hasCapacity ? (
                    <Text
                      style={[
                        styles.slotLeft,
                        { color: active ? theme.colors.onPrimary : full ? theme.colors.error : muted },
                      ]}
                    >
                      {full ? t('reschedule.full') : t('reschedule.left', { count: slot?.availableSlots ?? 0 })}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── A time inside the window; "Auto" leaves it to the server ── */}
        {/* Shown whenever the window has times — the portal's own rule (`subSlots.length > 0`). */}
        {selectedSlot && subSlots.length > 0 ? (
          <>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>{t('reschedule.pickTime')}</Text>
            <View style={styles.times}>
              {[{ startTime: '', isBooked: false, isPast: false }, ...subSlots].map(sub => {
                const value = sub?.startTime ?? '';
                const taken = Boolean(sub?.isBooked || sub?.isPast);
                const active = value === time;
                return (
                  <Pressable
                    key={value || 'auto'}
                    disabled={taken}
                    onPress={() => viewModel.setTime(value)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: taken, selected: active }}
                    style={[
                      styles.time,
                      {
                        backgroundColor: active ? theme.colors.primaryContainer : theme.colors.surface,
                        borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                      },
                      taken && styles.disabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeText,
                        { color: active ? theme.colors.primary : theme.colors.onSurface },
                        taken && styles.struck,
                      ]}
                    >
                      {value ? to12Hour(value) : t('reschedule.auto')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <CustomButton mode="outlined" onPress={close} disabled={viewModel.isSaving} style={styles.action}>
          {t('common.cancel')}
        </CustomButton>
        <CustomButton
          mode="contained"
          icon="calendar-check"
          onPress={viewModel.submit}
          disabled={!viewModel.canSubmit}
          loading={viewModel.isSaving}
          style={styles.action}
        >
          {t('reschedule.confirm')}
        </CustomButton>
      </View>
    </CustomBottomSheet>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    marginTop: 1,
  },
  body: {
    maxHeight: 460,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  currentText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
  },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
    marginTop: 16,
    marginBottom: 8,
  },
  days: {
    gap: 8,
  },
  day: {
    width: 58,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 8,
  },
  dayName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
  },
  dayNumber: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    marginVertical: 1,
  },
  dayMonth: {
    fontFamily: fontFamilies.regular,
    fontSize: 10.5,
  },
  datePicker: {
    marginTop: 10,
  },
  state: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  emptyText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  slots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    width: '48.5%',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  slotTime: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  slotLeft: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 2,
  },
  times: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  time: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  timeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  disabled: {
    opacity: 0.45,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  action: {
    flex: 1,
  },
});

export default RescheduleSheet;
