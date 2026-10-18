import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MEDICINE_SLOTS, MedicineSlot, to12Hour } from '@app/core';
import { CustomButton, CustomDatePicker, fontFamilies } from '@app/ui';
import { doseKey, useTodayMedicines } from './useTodayMedicines';
import { doctorTitle } from './prescriptionUi';

const SLOT_LOOK: Record<
  MedicineSlot,
  { icon: string; color: string; tint: string }
> = {
  morning: { icon: 'weather-sunny', color: '#D97706', tint: '#FEF3C7' },
  afternoon: {
    icon: 'weather-partly-cloudy',
    color: '#0284C7',
    tint: '#E0F2FE',
  },
  evening: { icon: 'weather-sunset', color: '#EA580C', tint: '#FFEDD5' },
  night: { icon: 'weather-night', color: '#6366F1', tint: '#E0E7FF' },
};

const DONE = '#16A34A';
const DONE_TINT = '#DCFCE7';

/** 'HH:mm' ↔ the time picker's Date. */
const toDate = (hhmm: string) => {
  const [h, m] = String(hhmm ?? '')
    .split(':')
    .map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return date;
};
const toHHmm = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;

interface TodayMedicinesPanelProps {
  /** One family member's medicines; null for everyone's. */
  patientCode?: string | null;
  /** Shown in the header when a member is chosen. */
  patientName?: string | null;
}

/** The portal's Today's Medicines panel. */
export const TodayMedicinesPanel = memo<TodayMedicinesPanelProps>(
  function TodayMedicinesPanel({ patientCode, patientName }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const today = useTodayMedicines(patientCode || null);
    const [showSettings, setShowSettings] = useState(false);
    const muted = theme.colors.onSurfaceVariant;

    if (today.isLoading) {
      return (
        <View
          style={[
            styles.card,
            styles.center,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      );
    }

    if (!today.medicines.length) {
      return (
        <View
          style={[
            styles.card,
            styles.center,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Icon name="pill" size={26} color={theme.colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
            {patientName
              ? t('todayMedicines.emptyFor', { name: patientName })
              : t('todayMedicines.empty')}
          </Text>
          <Text style={[styles.emptyHint, { color: muted }]}>
            {t('todayMedicines.emptyHint')}
          </Text>
        </View>
      );
    }

    const total = today.totalDoses;
    const taken = today.takenDoses;
    const allTaken = total > 0 && taken === total;
    const percent = total > 0 ? Math.round((taken / total) * 100) : 0;
    const lateNight = !allTaken && new Date().getHours() >= 21;
    const accent = allTaken ? DONE : theme.colors.primary;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: allTaken ? DONE : 'transparent',
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View
            style={[
              styles.headerIcon,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Icon name="pill" size={18} color={theme.colors.primary} />
          </View>
          <View style={styles.headerBody}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                {t('todayMedicines.title')}
              </Text>
              {patientName ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Icon
                    name="account-outline"
                    size={11}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[styles.badgeText, { color: theme.colors.primary }]}
                  >
                    {patientName}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[styles.progressText, { color: allTaken ? DONE : muted }]}
            >
              {allTaken
                ? t('todayMedicines.allTaken')
                : t('todayMedicines.takenOf', { taken, count: total })}
            </Text>
          </View>
          <View style={[styles.percent, { borderColor: accent }]}>
            <Text
              style={[styles.percentText, { color: accent }]}
            >{`${percent}%`}</Text>
          </View>
        </View>

        <View
          style={[styles.bar, { backgroundColor: theme.colors.surfaceVariant }]}
        >
          <View
            style={[
              styles.barFill,
              { width: `${percent}%`, backgroundColor: accent },
            ]}
          />
        </View>

        <Pressable
          onPress={() => setShowSettings(value => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showSettings }}
          style={[
            styles.scheduleToggle,
            showSettings
              ? {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.primary,
                }
              : { borderColor: theme.colors.outlineVariant },
          ]}
        >
          <Icon
            name="cog-outline"
            size={14}
            color={showSettings ? theme.colors.onPrimary : muted}
          />
          <Text
            style={[
              styles.scheduleText,
              { color: showSettings ? theme.colors.onPrimary : muted },
            ]}
          >
            {t('todayMedicines.schedule')}
          </Text>
          <Icon
            name={showSettings ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={showSettings ? theme.colors.onPrimary : muted}
          />
        </Pressable>

        {/* Reminder times */}
        {showSettings ? (
          <View
            style={[
              styles.settings,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Text
              style={[styles.settingsTitle, { color: theme.colors.onSurface }]}
            >
              {t('todayMedicines.reminderTimes')}
            </Text>
            <Text style={[styles.settingsHint, { color: muted }]}>
              {t('todayMedicines.reminderHint')}
            </Text>
            <View style={styles.timeGrid}>
              {MEDICINE_SLOTS.map(slot => (
                <View
                  key={slot}
                  style={[
                    styles.timeCell,
                    { backgroundColor: theme.colors.surface },
                  ]}
                >
                  <View style={styles.slotLabelRow}>
                    <Icon
                      name={SLOT_LOOK[slot].icon}
                      size={14}
                      color={SLOT_LOOK[slot].color}
                    />
                    <Text
                      style={[
                        styles.slotLabel,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      {t(`todayMedicines.slot.${slot}`)}
                    </Text>
                  </View>
                  <CustomDatePicker
                    label=""
                    mode="time"
                    value={toDate(today.draftTimes?.[slot])}
                    onChange={(date?: Date) => {
                      if (date) today.setDraftTime(slot, toHHmm(date));
                    }}
                  />
                  <Text style={[styles.activeTime, { color: muted }]}>
                    {t('todayMedicines.active', {
                      time: to12Hour(today.slotTimes?.[slot]),
                    })}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.settingsActions}>
              <CustomButton
                mode="outlined"
                icon="refresh"
                onPress={today.resetSchedule}
                disabled={today.isScheduling}
                style={styles.settingsButton}
              >
                {t('todayMedicines.resetDefaults')}
              </CustomButton>
              <CustomButton
                mode="contained"
                icon="check"
                onPress={async () => {
                  if (await today.saveSchedule()) setShowSettings(false);
                }}
                loading={today.isScheduling}
                disabled={today.isScheduling}
                style={styles.settingsButton}
              >
                {t('todayMedicines.saveSchedule')}
              </CustomButton>
            </View>
          </View>
        ) : null}

        {/* Slots */}
        {today.groups.map(group => {
          const look = SLOT_LOOK[group.slot];
          const state = today.slotState(group.slot);
          const slotDone = group.medicines.every(
            item => today.log?.[doseKey(item?.prescriptionId, group.slot)],
          );
          return (
            <View key={group.slot} style={styles.slot}>
              <View style={[styles.slotHeader, { backgroundColor: look.tint }]}>
                <Icon name={look.icon} size={16} color={look.color} />
                <Text style={[styles.slotName, { color: look.color }]}>
                  {t(`todayMedicines.slot.${group.slot}`)}
                </Text>
                <Text style={[styles.slotTime, { color: muted }]}>
                  {to12Hour(today.slotTimes?.[group.slot])}
                </Text>
                {state === 'now' ? (
                  <View
                    style={[
                      styles.stateTag,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stateTagText,
                        { color: theme.colors.onPrimary },
                      ]}
                    >
                      {t('todayMedicines.now')}
                    </Text>
                  </View>
                ) : state === 'past' ? (
                  <View
                    style={[
                      styles.stateTag,
                      { backgroundColor: 'rgba(0,0,0,0.08)' },
                    ]}
                  >
                    <Text style={[styles.stateTagText, { color: muted }]}>
                      {t('todayMedicines.past')}
                    </Text>
                  </View>
                ) : null}
                {slotDone ? (
                  <View style={styles.slotDone}>
                    <Icon name="check" size={12} color={DONE} />
                    <Text style={[styles.slotDoneText, { color: DONE }]}>
                      {t('todayMedicines.slotAllTaken')}
                    </Text>
                  </View>
                ) : null}
              </View>

              {group.medicines.map(item => {
                const key = doseKey(item?.prescriptionId, group.slot);
                const isTaken = !!today.log?.[key];
                return (
                  <Pressable
                    key={key}
                    onPress={() =>
                      today.toggleTaken(item?.prescriptionId, group.slot)
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isTaken }}
                    style={[
                      styles.dose,
                      {
                        backgroundColor: isTaken
                          ? DONE_TINT
                          : theme.colors.surfaceVariant,
                        borderColor: isTaken ? DONE : 'transparent',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.check,
                        {
                          borderColor: isTaken ? DONE : theme.colors.outline,
                          backgroundColor: isTaken ? DONE : 'transparent',
                        },
                      ]}
                    >
                      {isTaken ? (
                        <Icon name="check" size={13} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <View style={styles.doseBody}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.doseName,
                          { color: isTaken ? DONE : theme.colors.onSurface },
                          isTaken ? styles.struck : null,
                        ]}
                      >
                        {item?.medicine}
                      </Text>
                      {item?.dosage || item?.formType ? (
                        <Text style={[styles.doseMeta, { color: muted }]}>
                          {[item?.dosage, item?.formType]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      ) : null}
                      {item?.instructions ? (
                        <Text
                          numberOfLines={1}
                          style={[styles.doseNote, { color: muted }]}
                        >
                          {item.instructions}
                        </Text>
                      ) : null}
                      {item?.doctorName ? (
                        <Text style={[styles.doseMeta, { color: muted }]}>
                          {doctorTitle(item.doctorName)}
                        </Text>
                      ) : null}
                      {!patientCode && item?.patientName ? (
                        <View
                          style={[
                            styles.badge,
                            styles.doseBadge,
                            { backgroundColor: theme.colors.primaryContainer },
                          ]}
                        >
                          <Icon
                            name="account-outline"
                            size={10}
                            color={theme.colors.primary}
                          />
                          <Text
                            style={[
                              styles.badgeText,
                              { color: theme.colors.primary },
                            ]}
                          >
                            {item.patientName}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {isTaken ? (
                      <Text style={[styles.doneTag, { color: DONE }]}>
                        {t('todayMedicines.done')}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        {lateNight ? (
          <View style={styles.warning}>
            <Icon name="alert-circle-outline" size={16} color="#B45309" />
            <Text style={styles.warningText}>
              {t('todayMedicines.lateNight', { count: total - taken })}
            </Text>
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 14,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#0B1030',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  center: {
    alignItems: 'center',
    paddingVertical: 26,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14.5,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBody: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: fontFamilies.medium,
    fontSize: 10.5,
  },
  progressText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
  },
  percent: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 12,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  scheduleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  scheduleText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  settings: {
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  settingsTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  settingsHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    marginTop: 2,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  timeCell: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 10,
    padding: 8,
  },
  slotLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  slotLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  activeTime: {
    fontFamily: fontFamilies.regular,
    fontSize: 10.5,
  },
  // Stacked: side by side, "Reset to Defaults" does not fit a phone's width.
  settingsActions: {
    flexDirection: 'column-reverse',
    gap: 8,
    marginTop: 10,
  },
  settingsButton: {
    borderRadius: 10,
    marginVertical: 0,
  },
  slot: {
    marginTop: 14,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  slotName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  slotTime: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
  },
  stateTag: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  stateTagText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
  },
  slotDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  slotDoneText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10.5,
  },
  dose: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  doseBody: {
    flex: 1,
  },
  doseName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  doseMeta: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    marginTop: 2,
  },
  doseNote: {
    fontFamily: fontFamilies.regular,
    fontStyle: 'italic',
    fontSize: 11,
    marginTop: 2,
  },
  doseBadge: {
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  doneTag: {
    fontFamily: fontFamilies.bold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    padding: 10,
    marginTop: 6,
  },
  warningText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: '#92400E',
  },
});

export default TodayMedicinesPanel;
