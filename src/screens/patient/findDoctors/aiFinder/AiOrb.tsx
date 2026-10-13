import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '@app/ui';
import { aiPalette } from '../../../../components/ai/aiPalette';

/**
 * The AI doctor finder's mark — the robot, on the AI cyan running into the
 * brand blue. The card's header wears it, and so does every answer, so what
 * the AI says is always signed.
 */
export const AiOrb = memo<{ size?: number }>(function AiOrb({ size = 40 }) {
  const theme = useAppTheme();
  const palette = aiPalette(theme);

  return (
    <View
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          backgroundColor: theme.colors.primary,
          experimental_backgroundImage: `linear-gradient(135deg, ${palette.glow} 0%, ${theme.colors.primary} 70%)`,
        },
      ]}
    >
      <Icon name="robot-outline" size={Math.round(size * 0.55)} color={theme.colors.onPrimary} />
    </View>
  );
});

const styles = StyleSheet.create({
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AiOrb;
