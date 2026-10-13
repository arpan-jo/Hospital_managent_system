import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies, useAppTheme } from '@app/ui';
import { aiPalette, withAlpha } from '../../../../components/ai/aiPalette';
import { SILENT_LEVEL } from '../../../../hooks/useVoiceRecorder';

/**
 * What the AI doctor finder shows while it is busy — listening to the patient,
 * or working out who they should see. Each takes the input's place, so the
 * patient's eye stays where they were typing.
 */

/** Bars in the live waveform — the last couple of seconds of speech. */
const WAVE_BARS = 26;
const WAVE_MIN = 3;
const WAVE_MAX = 20;

/** The listening dot's red — the recording colour every phone uses. */
const RECORDING_RED = '#EF4444';

const formatClock = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** A dot that breathes while it is shown. */
const PulsingDot = memo<{ color: string }>(function PulsingDot({ color }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = useMemo(() => pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }), [pulse]);

  return <Animated.View style={[styles.dot, { backgroundColor: color, opacity }]} />;
});

/** Three dots rising in turn — the AI at work. */
const ThinkingDots = memo<{ colors: string[] }>(function ThinkingDots({ colors }) {
  const dots = useMemo(() => colors.map(() => new Animated.Value(0)), [colors]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(
        150,
        dots.map(dot =>
          Animated.sequence([
            Animated.timing(dot, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]),
        ),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [dots]);

  return (
    <View style={styles.thinkingDots}>
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          style={[
            styles.thinkingDot,
            {
              backgroundColor: colors[index],
              opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
});

/** The round ✕ both rows share. */
const CancelButton = memo<{ onPress: () => void }>(function CancelButton({ onPress }) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t('findDoctors.ai.cancel')}
      style={[styles.roundButton, { backgroundColor: theme.colors.surface }]}
    >
      <Icon name="close" size={18} color={theme.colors.onSurfaceVariant} />
    </Pressable>
  );
});

interface AiListeningRowProps {
  elapsedMs: number;
  levels: number[];
  isSilent: boolean;
  /** Done is held back for the first moment, so a slipped tap sends nothing. */
  canStop: boolean;
  onCancel: () => void;
  onStop: () => void;
}

export const AiListeningRow = memo<AiListeningRowProps>(function AiListeningRow({
  elapsedMs,
  levels,
  isSilent,
  canStop,
  onCancel,
  onStop,
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  const bars = useMemo(
    () => Array.from({ length: WAVE_BARS }, (_, index) => levels[levels.length - WAVE_BARS + index] ?? 0),
    [levels],
  );

  return (
    <View>
      <View
        style={[
          styles.pill,
          { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.primary },
        ]}
        accessibilityLiveRegion="polite"
      >
        <CancelButton onPress={onCancel} />

        <View style={styles.listeningBody}>
          <View style={styles.listeningTop}>
            <PulsingDot color={RECORDING_RED} />
            <Text numberOfLines={1} style={[styles.statusText, styles.grow, { color: theme.colors.onSurface }]}>
              {t('findDoctors.ai.listening')}
            </Text>
            <Text style={[styles.clock, { color: theme.colors.onSurfaceVariant }]}>{formatClock(elapsedMs)}</Text>
          </View>
          <View style={styles.wave}>
            {bars.map((value, index) => (
              <View
                key={index}
                style={[
                  styles.waveBar,
                  {
                    height: WAVE_MIN + value * (WAVE_MAX - WAVE_MIN),
                    backgroundColor:
                      value >= SILENT_LEVEL ? theme.colors.primary : withAlpha(theme.colors.onSurfaceVariant, 0.4),
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <Pressable
          onPress={onStop}
          disabled={!canStop}
          accessibilityRole="button"
          accessibilityLabel={t('findDoctors.ai.stopAndFind')}
          accessibilityState={{ disabled: !canStop }}
          style={[
            styles.roundButton,
            styles.doneButton,
            {
              backgroundColor: canStop ? theme.colors.primary : withAlpha(theme.colors.onSurface, 0.1),
            },
          ]}
        >
          <Icon name="check" size={22} color={canStop ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} />
        </Pressable>
      </View>

      {isSilent ? (
        <Text style={[styles.hint, { color: RECORDING_RED }]}>{t('findDoctors.ai.noSound')}</Text>
      ) : null}
    </View>
  );
});

interface AiWorkingRowProps {
  /** Turning the recording into words, rather than matching doctors. */
  isTranscribing: boolean;
  onCancel: () => void;
}

export const AiWorkingRow = memo<AiWorkingRowProps>(function AiWorkingRow({
  isTranscribing,
  onCancel,
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const palette = aiPalette(theme);
  const dotColors = useMemo(
    () => [palette.glow, theme.colors.primary, palette.glow],
    [palette.glow, theme.colors.primary],
  );

  return (
    <View
      style={[
        styles.pill,
        styles.workingPill,
        { backgroundColor: theme.colors.surfaceVariant, borderColor: withAlpha(theme.colors.primary, 0.35) },
      ]}
      accessibilityLiveRegion="polite"
    >
      <ThinkingDots colors={dotColors} />
      <Text numberOfLines={2} style={[styles.statusText, styles.grow, { color: theme.colors.onSurface }]}>
        {t(isTranscribing ? 'findDoctors.ai.transcribing' : 'findDoctors.ai.thinking')}
      </Text>
      <CancelButton onPress={onCancel} />
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  workingPill: {
    paddingLeft: 16,
  },
  grow: {
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listeningBody: {
    flex: 1,
    gap: 5,
  },
  listeningTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: WAVE_MAX,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  clock: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  thinkingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 20,
  },
  thinkingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  hint: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    marginTop: 6,
    marginLeft: 4,
  },
});
