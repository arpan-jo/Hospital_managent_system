import React, { memo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PortalDoctor } from '@app/core';
import { fontFamilies, useAppTheme } from '@app/ui';
import { aiPalette, withAlpha } from '../../../../components/ai/aiPalette';
import { AiFinderAnswer } from './AiFinderAnswer';
import { AiListeningRow, AiWorkingRow } from './AiFinderStatus';
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
 * mark: the header on the brand wash, the robot with the cyan spark.
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
  onOpenDoctor: (doctor: PortalDoctor) => void;
}

/** Why the last ask came back with nothing — in the service's words when it gave any. */
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
      <Icon name="alert-circle-outline" size={18} color={color} />
      <Text selectable style={[styles.noticeText, { color }]}>
        {message || t(`findDoctors.ai.notices.${notice}`)}
      </Text>
    </View>
  );
});

export const AiDoctorFinder = memo<AiDoctorFinderProps>(function AiDoctorFinder({
  onOpenDoctor,
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
    isAudioPlaying,
    toggleAudio,
  } = useAiDoctorFinderViewModel();

  const palette = aiPalette(theme);
  const isBusy = phase !== 'idle';
  const canSend = Boolean(input.trim()) && !isBusy;

  // Sending or speaking swaps the text box for the working or listening row, so
  // the keyboard goes with it — as the keyboard's own Search key already does.
  // The box is gone before its blur arrives, so it is marked unfocused here.
  const putKeyboardAway = () => {
    Keyboard.dismiss();
    setIsFocused(false);
  };
  const send = (text?: string) => {
    putKeyboardAway();
    submit(text);
  };
  const listen = () => {
    putKeyboardAway();
    startVoice();
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: withAlpha(theme.colors.primary, 0.14),
          boxShadow: `0px 8px 24px ${withAlpha(theme.colors.primary, 0.12)}`,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: palette.base, experimental_backgroundImage: palette.gradient },
        ]}
      >
        {/* Echo of the rings on the sign-in hero and the drawer's card. */}
        <View pointerEvents="none" style={[styles.ring, styles.ringLarge, { borderColor: palette.onGradient }]} />
        <View pointerEvents="none" style={[styles.ring, styles.ringSmall, { borderColor: palette.glow }]} />

        <View style={[styles.mark, { backgroundColor: withAlpha(palette.onGradient, 0.16) }]}>
          <Icon name="robot-outline" size={24} color={palette.onGradient} />
          <View style={[styles.spark, { backgroundColor: palette.glow, borderColor: palette.base }]}>
            <Icon name="creation" size={10} color={theme.colors.secondary} />
          </View>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: palette.onGradient }]}>{t('findDoctors.ai.title')}</Text>
          {/* Once there is an answer the card explains itself, and New search needs the room. */}
          {match ? null : (
            <Text style={[styles.subtitle, { color: withAlpha(palette.onGradient, 0.82) }]}>
              {t('findDoctors.ai.subtitle')}
            </Text>
          )}
        </View>
        {match && !isBusy ? (
          <Pressable
            onPress={reset}
            hitSlop={6}
            accessibilityRole="button"
            style={[styles.newSearch, { backgroundColor: withAlpha(palette.onGradient, 0.18) }]}
          >
            <Icon name="plus" size={14} color={palette.onGradient} />
            <Text style={[styles.newSearchText, { color: palette.onGradient }]}>
              {t('findDoctors.ai.newSearch')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
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
                borderColor: isFocused ? theme.colors.primary : theme.colors.outlineVariant,
              },
            ]}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onSubmitEditing={() => submit()}
              placeholder={t('findDoctors.ai.placeholder')}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              selectionColor={theme.colors.primary}
              multiline
              submitBehavior="blurAndSubmit"
              returnKeyType="search"
              maxLength={INPUT_MAX_LENGTH}
              style={[styles.input, { color: theme.colors.onSurface }]}
            />
            <Pressable
              onPress={listen}
              accessibilityRole="button"
              accessibilityLabel={t('findDoctors.ai.speak')}
              style={[styles.roundButton, { backgroundColor: theme.colors.primaryContainer }]}
            >
              <Icon name="microphone" size={20} color={theme.colors.onPrimaryContainer} />
            </Pressable>
            <Pressable
              onPress={() => send()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={t('findDoctors.ai.send')}
              accessibilityState={{ disabled: !canSend }}
              style={[
                styles.roundButton,
                canSend
                  ? {
                      backgroundColor: palette.base,
                      experimental_backgroundImage: palette.gradient,
                      boxShadow: palette.glowShadow,
                    }
                  : { backgroundColor: withAlpha(theme.colors.onSurface, 0.08) },
              ]}
            >
              <Icon name="arrow-up" size={20} color={canSend ? palette.onGradient : theme.colors.onSurfaceVariant} />
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
                  onPress={() => send(example)}
                  accessibilityRole="button"
                  style={[
                    styles.example,
                    {
                      backgroundColor: withAlpha(theme.colors.primary, 0.06),
                      borderColor: withAlpha(theme.colors.primary, 0.12),
                    },
                  ]}
                >
                  <Icon name={icon} size={15} color={palette.accent} />
                  <Text style={[styles.exampleText, { color: theme.colors.onSurface }]}>{example}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {match ? (
          <AiFinderAnswer
            asked={asked}
            match={match}
            onOpenDoctor={onOpenDoctor}
            isAudioPlaying={isAudioPlaying}
            onToggleAudio={toggleAudio}
          />
        ) : null}

        <View style={[styles.disclaimer, { borderTopColor: theme.colors.outlineVariant }]}>
          <Icon name="shield-check-outline" size={13} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.disclaimerText, { color: theme.colors.onSurfaceVariant }]}>
            {t('findDoctors.ai.disclaimer')}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    opacity: 0.18,
  },
  ringLarge: {
    width: 170,
    height: 170,
    borderRadius: 85,
    top: -96,
    right: -48,
  },
  ringSmall: {
    width: 90,
    height: 90,
    borderRadius: 45,
    bottom: -58,
    right: 64,
  },
  mark: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  body: {
    padding: 14,
    gap: 12,
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
    borderRadius: 20,
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
  noticeText: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    lineHeight: 17,
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
    borderTopWidth: 1,
    paddingTop: 10,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 10.5,
  },
});

export default AiDoctorFinder;
