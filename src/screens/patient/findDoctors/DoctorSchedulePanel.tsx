import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatLongDate, fromISODate, to12Hour, toISODate } from '@app/core';
import {
  CustomButton,
  CustomDatePicker,
  CustomInput,
  fontFamilies,
} from '@app/ui';
import { useMonthNames } from '../../../hooks/useMonthNames';
import { AVAILABLE_COLOR, taka } from './DoctorListItem';
import { DoctorDetailsViewModel } from './useDoctorDetailsViewModel';
import { DAY_ORDER, dayIndexOf } from './weekdays';

interface DoctorSchedulePanelProps {
  viewModel: DoctorDetailsViewModel;
}

/**
 * The Schedule tab of a doctor's page — the whole booking form: who the visit
 * is for, the date, that date's windows, a time inside the chosen one, the
 * visit type and the complaint.
 */
export const DoctorSchedulePanel = memo<DoctorSchedulePanelProps>(
  function DoctorSchedulePanel({ viewModel }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const monthNames = useMonthNames();

    const {
      patient,
      date,
      dayName,
      isCustomDate,
      scheduledDays,
      slots,
      isSlotsLoading,
      selectedSlot,
      selectedSlotId,
      subSlotTime,
      isSubSlotsOpen,
      autoTime,
      bookingTime,
      consultationOptions,
      consultationType,
      detail,
      officeName,
    } = viewModel;

    const muted = theme.colors.onSurfaceVariant;
    const subSlots = selectedSlot?.subSlots ?? [];
    const autoLabel = autoTime
      ? t('doctorProfile.autoTime', { time: to12Hour(autoTime) })
      : t('doctorProfile.auto');

    /** The small line under a visit type: what it covers or how long it holds. */
    const hintOf = (type: string): string => {
      if (type === 'follow_up') {
        return detail?.followUpValidDuration
          ? t('doctorProfile.validDays', { count: detail.followUpValidDuration })
          : '';
      }
      if (type === 'report') return t('doctorProfile.reportDiscussion');
      return officeName;
    };

    return (
      <View>
        {/* Without the doctor's terms there are no days and no visit types to
            choose, so the way to read them again comes first. */}
        {detail ? null : (
          <View style={[styles.notice, { backgroundColor: theme.colors.errorContainer }]}>
            <Text style={[styles.noticeText, { color: theme.colors.onErrorContainer }]}>
              {viewModel.detailError || t('common.somethingWentWrong')}
            </Text>
            <CustomButton
              mode="text"
              onPress={viewModel.reloadDetail}
              textColor={theme.colors.onErrorContainer}
              style={styles.noticeButton}
            >
              {t('common.retry')}
            </CustomButton>
          </View>
        )}

        {/* ── Who the visit is for: always the signed-in patient ── */}
        <Text style={[styles.label, { color: theme.colors.onSurface }]}>
          {t('doctorProfile.appointmentFor')}
        </Text>
        <View
          style={[
            styles.patientCard,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <View style={[styles.patientIcon, { backgroundColor: theme.colors.primary }]}>
            <Icon name="account" size={18} color={theme.colors.onPrimary} />
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={[styles.patientName, { color: theme.colors.onSurface }]}>
              {patient?.fullName || t('common.na')}
            </Text>
            {patient?.phone || patient?.patientCode ? (
              <Text numberOfLines={1} style={[styles.caption, { color: muted }]}>
                {[patient?.phone, patient?.patientCode].filter(Boolean).join('  •  ')}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ── Date ── */}
        <View style={styles.labelRow}>
          <Text style={[styles.label, styles.labelInRow, { color: theme.colors.onSurface }]}>
            {t('doctorProfile.appointmentDate')}
          </Text>
          <Pressable onPress={viewModel.toggleCustomDate} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.link, { color: theme.colors.primary }]}>
              {t(isCustomDate ? 'doctorProfile.pickWeekday' : 'doctorProfile.pickCustomDate')}
            </Text>
          </Pressable>
        </View>

        {isCustomDate ? (
          <CustomDatePicker
            label={t('doctorProfile.appointmentDate')}
            value={date ? fromISODate(date) : undefined}
            onChange={picked => viewModel.pickDate(toISODate(picked))}
            minimumDate={new Date()}
            formatString={picked => formatLongDate(toISODate(picked), monthNames)}
          />
        ) : (
          <View style={styles.dayRow}>
            {DAY_ORDER.map(abbr => {
              const enabled = scheduledDays?.has(abbr) ?? false;
              const active = enabled && viewModel.isWeekdayActive(abbr);

              return (
                <Pressable
                  key={abbr}
                  disabled={!enabled}
                  onPress={() => viewModel.pickWeekday(abbr)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !enabled, selected: active }}
                  accessibilityHint={enabled ? undefined : t('doctorProfile.noScheduleDay')}
                  style={[
                    styles.dayPill,
                    {
                      backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                      borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                    },
                    !enabled && styles.disabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: active ? theme.colors.onPrimary : theme.colors.onSurface },
                    ]}
                  >
                    {t(`days.${dayIndexOf(abbr)}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {date ? (
          <Text style={[styles.caption, styles.dateLine, { color: muted }]}>
            {`${formatLongDate(date, monthNames)}  •  ${dayName}`}
          </Text>
        ) : null}

        {/* ── That date's windows ── */}
        {date ? (
          <View>
            <View style={styles.labelRow}>
              <Text style={[styles.label, styles.labelInRow, { color: theme.colors.onSurface }]}>
                {t('doctorProfile.availableSlots', { day: dayName })}
              </Text>
              {selectedSlot ? (
                <Text style={[styles.selectedTime, { color: AVAILABLE_COLOR }]}>
                  {t('doctorProfile.timeSelected', { time: to12Hour(bookingTime) })}
                </Text>
              ) : null}
            </View>

            {isSlotsLoading ? (
              <View style={styles.loader}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : (slots?.length ?? 0) === 0 ? (
              <View style={[styles.emptyBox, { borderColor: theme.colors.outlineVariant }]}>
                <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                  {t('doctorProfile.noAvailability', { day: dayName })}
                </Text>
                <Text style={[styles.caption, { color: muted }]}>
                  {t('doctorProfile.pickAnotherDate')}
                </Text>
              </View>
            ) : (
              <View style={styles.slotGrid}>
                {slots?.map(slot => {
                  const hasCapacity = (slot?.bookingCapacity ?? 0) > 0;
                  const full = hasCapacity && (slot?.availableSlots ?? 0) <= 0;
                  const active = slot?.slotId === selectedSlotId;

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
                      <Text
                        style={[
                          styles.slotTime,
                          { color: active ? theme.colors.onPrimary : theme.colors.onSurface },
                        ]}
                      >
                        {`${to12Hour(slot?.startTime ?? '')} – ${to12Hour(slot?.endTime ?? '')}`}
                      </Text>
                      {full || hasCapacity ? (
                        <Text
                          style={[
                            styles.caption,
                            { color: active ? theme.colors.onPrimary : full ? theme.colors.error : muted },
                          ]}
                        >
                          {full
                            ? t('doctorProfile.full')
                            : t('doctorProfile.slotLeft', {
                                available: slot?.availableSlots ?? 0,
                                capacity: slot?.bookingCapacity ?? 0,
                              })}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {/* ── A time inside the chosen window; "Auto" leaves it to the server ── */}
        {selectedSlot && subSlots.length > 1 ? (
          <View style={[styles.subSlotBox, { borderColor: theme.colors.outlineVariant }]}>
            <Pressable
              onPress={viewModel.toggleSubSlots}
              accessibilityRole="button"
              style={styles.subSlotHeader}
            >
              <Text style={[styles.subSlotTitle, { color: theme.colors.onSurface }]}>
                {t('doctorProfile.pickTime', { minutes: selectedSlot?.perPatientMinutes ?? 0 })}
              </Text>
              <Text style={[styles.caption, { color: subSlotTime ? AVAILABLE_COLOR : muted }]}>
                {subSlotTime ? `✓ ${to12Hour(subSlotTime)}` : autoLabel}
              </Text>
              <Icon name={isSubSlotsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={muted} />
            </Pressable>

            {isSubSlotsOpen ? (
              <View style={styles.timeGrid}>
                <Pressable
                  onPress={() => viewModel.setSubSlotTime('')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !subSlotTime }}
                  style={[
                    styles.time,
                    {
                      backgroundColor: !subSlotTime ? theme.colors.primary : theme.colors.surface,
                      borderColor: !subSlotTime ? theme.colors.primary : theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.timeText,
                      { color: !subSlotTime ? theme.colors.onPrimary : theme.colors.onSurface },
                    ]}
                  >
                    {autoLabel}
                  </Text>
                </Pressable>

                {subSlots.map(sub => {
                  const taken = Boolean(sub?.isBooked || sub?.isPast);
                  const active = !!subSlotTime && subSlotTime === sub?.startTime;

                  return (
                    <Pressable
                      key={sub?.startTime}
                      disabled={taken}
                      onPress={() => viewModel.setSubSlotTime(sub?.startTime ?? '')}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: taken, selected: active }}
                      accessibilityHint={
                        taken
                          ? t(sub?.isBooked ? 'doctorProfile.alreadyBooked' : 'doctorProfile.timePassed')
                          : undefined
                      }
                      style={[
                        styles.time,
                        {
                          backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                          borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                        },
                        taken && styles.disabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.timeText,
                          taken && styles.struck,
                          { color: active ? theme.colors.onPrimary : theme.colors.onSurface },
                        ]}
                      >
                        {to12Hour(sub?.startTime ?? '')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── What has been chosen so far ── */}
        {viewModel.canBook && selectedSlot ? (
          <View style={[styles.selectedBanner, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon name="calendar-check-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.selectedText, { color: theme.colors.onPrimaryContainer }]}>
              {t('doctorProfile.selected', {
                date: formatLongDate(date, monthNames),
                time: to12Hour(bookingTime),
              })}
            </Text>
            <Pressable onPress={viewModel.clearSelection} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.link, { color: theme.colors.primary }]}>
                {t('doctorProfile.clear')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Visit type: only the ones the doctor has priced ── */}
        {consultationOptions.length > 0 ? (
          <View>
            <Text style={[styles.label, styles.labelSpaced, { color: theme.colors.onSurface }]}>
              {t('doctorProfile.consultationOptions')}
            </Text>
            {consultationOptions.map(option => {
              const active = option.type === consultationType;
              const hint = hintOf(option.type);

              return (
                <Pressable
                  key={option.type}
                  onPress={() => viewModel.setConsultationType(option.type)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: active ? theme.colors.primaryContainer : theme.colors.surface,
                      borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <Icon
                    name={active ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={active ? theme.colors.primary : muted}
                  />
                  <View style={styles.flex}>
                    <Text style={[styles.optionTitle, { color: theme.colors.onSurface }]}>
                      {t(option.labelKey)}
                    </Text>
                    {hint ? (
                      <Text numberOfLines={1} style={[styles.caption, { color: muted }]}>
                        {hint}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.optionFee, { color: theme.colors.primary }]}>
                    {taka(option.fee)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* ── Complaint: optional ── */}
        <Text style={[styles.label, styles.labelSpaced, { color: theme.colors.onSurface }]}>
          {t('doctorProfile.chiefComplaint')}
        </Text>
        <CustomInput
          label={t('doctorProfile.chiefComplaint')}
          value={viewModel.reason}
          onChangeText={viewModel.setReason}
          placeholder={t('doctorProfile.chiefComplaintPlaceholder')}
          compact
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingLeft: 12,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
  },
  noticeButton: {
    marginVertical: 0,
  },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
  },
  labelInRow: {
    marginBottom: 0,
    flexShrink: 1,
  },
  labelSpaced: {
    marginTop: 18,
  },
  link: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  caption: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 12,
  },
  patientIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
  },
  dayText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  disabled: {
    opacity: 0.4,
  },
  dateLine: {
    marginTop: 8,
  },
  selectedTime: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  loader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 18,
    gap: 2,
  },
  emptyTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 2,
  },
  slotTime: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  subSlotBox: {
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  subSlotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  subSlotTitle: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 12,
  },
  time: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  timeText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  selectedText: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  optionTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  optionFee: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },
});

export default DoctorSchedulePanel;
