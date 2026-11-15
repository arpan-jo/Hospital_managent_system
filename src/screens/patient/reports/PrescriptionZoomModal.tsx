import React, { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '@app/ui';
import ZoomableView from '../../../components/ZoomableView';

/**
 * The prescription sheet on its own, filling the screen, to pinch in on —
 * double-tap goes in and back out, one finger moves it about. Back or the
 * close button leaves.
 */
export const PrescriptionZoomModal = ({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="fade" statusBarTranslucent>
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.background, paddingTop: insets?.top ?? 0, paddingBottom: insets?.bottom ?? 0 },
        ]}
      >
        <View style={styles.bar}>
          <View style={styles.titles}>
            {title ? (
              <Text numberOfLines={1} style={[styles.title, { color: theme.colors.onSurface }]}>
                {title}
              </Text>
            ) : null}
            <Text numberOfLines={2} style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
              {t('reports.pad.zoomHint')}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={[styles.close, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <Icon name="close" size={20} color={theme.colors.onSurface} />
          </Pressable>
        </View>

        <ZoomableView>
          {/* The gestures belong to the zoom view: the sheet takes no touches, so a
              double tap zooms rather than selecting a word. */}
          <View style={styles.page} pointerEvents="none">
            {children}
          </View>
        </ZoomableView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
  },
  hint: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    marginTop: 1,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  page: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 24,
  },
});

export default PrescriptionZoomModal;
