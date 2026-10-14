import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AiDoctorMatch, PortalDoctor } from '@app/core';
import { fontFamilies, useAppTheme } from '@app/ui';
import { withAlpha } from '../../../../components/ai/aiPalette';
import DoctorListItem from '../DoctorListItem';
import { AiOrb } from './AiOrb';
import { AiTopMatchCard } from './AiTopMatchCard';

/**
 * The AI's answer, as a short chat: what the patient asked on the right, the
 * AI's reply on the left with the specialist it names, then the doctors it
 * puts forward — its first pick on its own card, the rest as the list's cards.
 */

interface AiFinderAnswerProps {
  /** What was asked last; '' when it is not known. */
  asked: string;
  match: AiDoctorMatch;
  onOpenDoctor: (doctor: PortalDoctor) => void;
  /** Whether the answer's summary is being read aloud right now. */
  isAudioPlaying: boolean;
  onToggleAudio: () => void;
}

export const AiFinderAnswer = memo<AiFinderAnswerProps>(function AiFinderAnswer({
  asked,
  match,
  onOpenDoctor,
  isAudioPlaying,
  onToggleAudio,
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const others = match?.others ?? [];

  return (
    <View style={styles.answer}>
      {asked ? (
        <View style={[styles.askedBubble, { backgroundColor: theme.colors.primary }]}>
          <Text selectable style={[styles.bubbleText, { color: theme.colors.onPrimary }]}>
            {asked}
          </Text>
        </View>
      ) : null}

      {match?.message || match?.specialist ? (
        <View style={styles.replyRow}>
          <AiOrb size={28} />
          <View style={[styles.replyBubble, { backgroundColor: theme.colors.surfaceVariant }]}>
            {match?.message ? (
              <Text selectable style={[styles.bubbleText, { color: theme.colors.onSurface }]}>
                {match.message}
              </Text>
            ) : null}

            {match?.audio ? (
              <Pressable
                onPress={onToggleAudio}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t(isAudioPlaying ? 'findDoctors.ai.stopListening' : 'findDoctors.ai.listen')}
                style={[styles.listen, { backgroundColor: theme.colors.surface }]}
              >
                <Icon
                  name={isAudioPlaying ? 'stop-circle-outline' : 'volume-high'}
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={[styles.listenText, { color: theme.colors.primary }]}>
                  {t(isAudioPlaying ? 'findDoctors.ai.stopListening' : 'findDoctors.ai.listen')}
                </Text>
              </Pressable>
            ) : null}

            {match?.specialist ? (
              <View
                style={[
                  styles.specialist,
                  match?.message ? styles.specialistBelow : null,
                  { borderTopColor: withAlpha(theme.colors.onSurface, 0.08) },
                ]}
              >
                <View style={[styles.specialistIcon, { backgroundColor: theme.colors.surface }]}>
                  <Icon name="stethoscope" size={16} color={theme.colors.primary} />
                </View>
                <View style={styles.specialistText}>
                  <Text style={[styles.specialistLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {t('findDoctors.ai.recommended')}
                  </Text>
                  <Text numberOfLines={2} style={[styles.specialistName, { color: theme.colors.primary }]}>
                    {match.specialist}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {match?.topMatch ? (
        <AiTopMatchCard doctor={match.topMatch} onOpen={onOpenDoctor} />
      ) : null}

      {others.length ? (
        <View>
          <Text style={[styles.othersLabel, { color: theme.colors.onSurfaceVariant }]}>
            {match?.topMatch
              ? t('findDoctors.ai.others')
              : t('findDoctors.ai.othersOnly', { count: others.length })}
          </Text>
          {others.map(doctor => (
            <DoctorListItem key={doctor?.employeeId} doctor={doctor} onOpen={onOpenDoctor} />
          ))}
        </View>
      ) : null}

      {!match?.topMatch && !others.length ? (
        <View style={[styles.noMatch, { borderColor: withAlpha(theme.colors.onSurface, 0.18) }]}>
          <Icon name="account-search-outline" size={22} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.noMatchTitle, { color: theme.colors.onSurface }]}>{t('findDoctors.ai.noMatch')}</Text>
          <Text style={[styles.noMatchHint, { color: theme.colors.onSurfaceVariant }]}>
            {t('findDoctors.ai.noMatchHint')}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  listen: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
  },
  listenText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  answer: {
    gap: 12,
  },
  askedBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  replyBubble: {
    flex: 1,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    lineHeight: 20,
  },
  specialist: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  specialistBelow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  specialistIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialistText: {
    flex: 1,
  },
  specialistLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 10.5,
  },
  specialistName: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  othersLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    marginBottom: 10,
  },
  noMatch: {
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  noMatchTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    textAlign: 'center',
  },
  noMatchHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    textAlign: 'center',
  },
});

export default AiFinderAnswer;
