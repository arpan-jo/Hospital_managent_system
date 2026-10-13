import React, { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DoctorSummary } from '@app/core';
import { fontFamilies, useAppTheme } from '@app/ui';
import { withAlpha } from '../../../../components/ai/aiPalette';
import { AiFinderAnswer } from './AiFinderAnswer';
import { AiListeningRow, AiWorkingRow } from './AiFinderStatus';
import { AiOrb } from './AiOrb';
import {
  AiFinderNotice,
  MIN_SYMPTOM_RECORDING_MS,
  useAiDoctorFinderViewModel,
} from './useAiDoctorFinderViewModel';

/**
 * AI Doctor Match — the top of Find Doctors, where a patient who does not know
 * which doctor they need can just say how they feel.
 *
 * Built in the screen's own look — its card, its search field, its chips,
 * its Book — so it reads as part of the app. What is the AI's own wears its
 * mark: the robot on the cyan-to-blue wash.
 */

/** The examples offered before anything is asked, in the order shown, each with its icon. */
const EXAMPLES = [
  { key: 'fever', icon: 'thermometer' },
  { key: 'chest', icon: 'heart-pulse' },
  { key: 'skin', icon: 'allergy' },
  { key: 'stomach', icon: 'stomach' },
  { key: 'back', icon: 'human' },
  { key: 'cough', icon: 'lungs' },
] as const;

/** Past this the box scrolls instead of pushing the page down. */
const INPUT_MAX_HEIGHT = 84;
const INPUT_MAX_LENGTH = 500;

interface AiDoctorFinderProps {
  onOpenDoctor: (doctor: DoctorSummary) => void;
  onBookDoctor: (doctor: DoctorSummary) => void;
}

/** Why the last ask came back with nothing, and what the service said, if anything. */
const NoticeBanner = memo<{ notice: AiFinderNotice; message: string }>(function NoticeBanner({
  notice,
  message,
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const color = theme.colors.onErrorContainer;

  return (
    <View
      style={[styles.notice, { backgroundColor: theme.colors.errorContainer }]}
      accessibilityLiveRegion="polite"
    >
      <Icon name={notice === 'network' ? 'wifi-off' : 'alert-circle-outline'} size={18} color={color} />
      <View style={styles.noticeBody}>
        <Text style={[styles.noticeText, { color }]}>{t(`findDoctors.ai.notices.${notice}`)}</Text>
        {message ? (
          <Text selectable style={[styles.noticeMessage, { color }]}>
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

export const AiDoctorFinder = memo<AiDoctorFinderProps>(function AiDoctorFinder({
  onOpenDoctor,
  onBookDoctor,
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);

  const {
    input,
    setInput,
    phase,
    match,
    asked,
    notice,
    noticeMessage,
    submit,
    startVoice,
    stopVoice,
    cancelVoice,
    cancelAsk,
    reset,
    recordingMs,
    recordingLevels,
    isRecordingSilent,
  } = useAiDoctorFinderViewModel();

  const isBusy = phase !== 'idle';
  const canSend = Boolean(input.trim()) && !isBusy;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          experimental_backgroundImage: `linear-gradient(180deg, ${withAlpha(theme.colors.primary, 0.07)} 0%, ${theme.colors.surface} 45%)`,
          borderColor: withAlpha(theme.colors.primary, 0.14),
        },
      ]}
    >
      <View style={styles.header}>
        <AiOrb />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>{t('findDoctors.ai.title')}</Text>
          {/* Once there is an answer the card explains itself, and New search needs the room. */}
          {match ? null : (
            <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
              {t('findDoctors.ai.subtitle')}
            </Text>
          )}
        </View>
        {match && !isBusy ? (
          <Pressable
            onPress={reset}
            hitSlop={6}
            accessibilityRole="button"
            style={[styles.newSearch, { backgroundColor: theme.colors.primaryContainer }]}
          >
            <Icon name="plus" size={14} color={theme.colors.primary} />
            <Text style={[styles.newSearchText, { color: theme.colors.primary }]}>
              {t('findDoctors.ai.newSearch')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {phase === 'recording' ? (
        <AiListeningRow
          elapsedMs={recordingMs}
          levels={recordingLevels}
          isSilent={isRecordingSilent}
          canStop={recordingMs >= MIN_SYMPTOM_RECORDING_MS}
          onCancel={cancelVoice}
          onStop={stopVoice}
        />
      ) : isBusy ? (
        <AiWorkingRow isTranscribing={phase === 'transcribing'} onCancel={cancelAsk} />
      ) : (
        <View
          style={[
            styles.inputField,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: isFocused ? theme.colors.primary : theme.colors.surfaceVariant,
            },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={() => submit()}
            placeholder={t(match ? 'findDoctors.ai.followUpPlaceholder' : 'findDoctors.ai.placeholder')}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            selectionColor={theme.colors.primary}
            multiline
            submitBehavior="blurAndSubmit"
            returnKeyType="search"
            maxLength={INPUT_MAX_LENGTH}
            style={[styles.input, { color: theme.colors.onSurface }]}
          />
          <Pressable
            onPress={startVoice}
            accessibilityRole="button"
            accessibilityLabel={t('findDoctors.ai.speak')}
            style={[styles.roundButton, { backgroundColor: theme.colors.surface }]}
          >
            <Icon name="microphone" size={20} color={theme.colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => submit()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('findDoctors.ai.send')}
            accessibilityState={{ disabled: !canSend }}
            style={[
              styles.roundButton,
              { backgroundColor: canSend ? theme.colors.primary : withAlpha(theme.colors.onSurface, 0.1) },
            ]}
          >
            <Icon name="arrow-up" size={20} color={canSend ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} />
          </Pressable>
        </View>
      )}

      {notice && !isBusy ? <NoticeBanner notice={notice} message={noticeMessage} /> : null}

      {!match && !isBusy ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.examples}
        >
          <Text style={[styles.tryLabel, { color: theme.colors.onSurfaceVariant }]}>{t('findDoctors.ai.tryLabel')}</Text>
          {EXAMPLES.map(({ key, icon }) => {
            const example = t(`findDoctors.ai.examples.${key}`);
            return (
              <Pressable
                key={key}
                onPress={() => submit(example)}
                accessibilityRole="button"
                style={[
                  styles.example,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
                ]}
              >
                <Icon name={icon} size={15} color={theme.colors.primary} />
                <Text style={[styles.exampleText, { color: theme.colors.onSurface }]}>{example}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {match ? (
        <AiFinderAnswer asked={asked} match={match} onOpenDoctor={onOpenDoctor} onBookDoctor={onBookDoctor} />
      ) : null}

      <View style={styles.disclaimer}>
        <Icon name="shield-check-outline" size={13} color={theme.colors.onSurfaceVariant} />
        <Text style={[styles.disclaimerText, { color: theme.colors.onSurfaceVariant }]}>
          {t('findDoctors.ai.disclaimer')}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    lineHeight: 16,
  },
  newSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 6,
  },
  newSearchText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11.5,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    maxHeight: INPUT_MAX_HEIGHT,
    minHeight: 40,
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 0,
    textAlignVertical: 'center',
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeBody: {
    flex: 1,
    gap: 2,
  },
  noticeText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    lineHeight: 17,
  },
  noticeMessage: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    lineHeight: 15,
    opacity: 0.85,
  },
  examples: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  tryLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
  },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 7,
  },
  exampleText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 10.5,
  },
});

export default AiDoctorFinder;
