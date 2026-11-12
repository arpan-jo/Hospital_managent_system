import React, { memo, useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { ActivityIndicator, ProgressBar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies, useAppTheme } from '@app/ui';
import { UploadProgress } from './useUploadsViewModel';

/** After this long the modal adds that it is taking a while — so it never looks stuck. */
const SLOW_AFTER_MS = 20_000;

const RING_SIZE = 76;

interface UploadProgressModalProps {
  /** Null hides it. */
  progress: UploadProgress | null;
}

/**
 * While a prescription or lab report uploads and the AI reads it: a spinning
 * ring, one line saying which step runs, and a running bar. It cannot be
 * closed — it goes by itself when the review opens or the read gives up.
 *
 * An RN Modal, not a Portal: it has to sit over the upload sheet, which is a
 * Modal of its own.
 */
export const UploadProgressModal = memo<UploadProgressModalProps>(function UploadProgressModal({ progress }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const visible = Boolean(progress);
  const isReading = progress?.stage === 'reading';
  const accent = isReading ? theme.colors.aiGlow : theme.colors.primary;

  const [isSlow, setIsSlow] = useState(false);
  useEffect(() => {
    if (!visible) {
      setIsSlow(false);
      return;
    }
    const timer = setTimeout(() => setIsSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  const label = !isReading
    ? t('reports.progress.uploading')
    : progress?.kind === 'lab'
      ? t('reports.progress.readingLab')
      : t('reports.progress.readingRx');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Nothing to cancel: the file is saved and the read finishes on its own.
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.ring}>
            <ActivityIndicator size={RING_SIZE} color={accent} style={StyleSheet.absoluteFill} />
            <Icon name={isReading ? 'creation' : 'cloud-upload-outline'} size={30} color={accent} />
          </View>

          <Text
            accessibilityLiveRegion="polite"
            style={[styles.label, { color: theme.colors.onSurface }]}
          >
            {label}
          </Text>

          <ProgressBar indeterminate color={accent} style={styles.bar} />

          {isSlow ? (
            <Text style={[styles.slow, { color: theme.colors.onSurfaceVariant }]}>
              {t('reports.progress.slow')}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 12, 30, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
    textAlign: 'center',
  },
  bar: {
    width: 200,
    height: 4,
    borderRadius: 2,
    marginTop: 16,
  },
  slow: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
});

export default UploadProgressModal;
