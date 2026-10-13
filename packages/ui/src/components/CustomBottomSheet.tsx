import React, { memo } from 'react';
import { StyleSheet, View, Modal, Platform, Pressable, ViewStyle } from 'react-native';
import { Portal, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomToast } from './CustomToast';

interface CustomBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Hide the drag handle when the sheet supplies its own close affordance. */
  showHandle?: boolean;
  style?: ViewStyle;
}

export const CustomBottomSheet = memo<CustomBottomSheetProps>(function CustomBottomSheet({
  visible,
  onClose,
  children,
  showHandle = true,
  style,
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  /**
   * Android draws a Modal inside its own window, which the system has already
   * inset past the gesture bar — the sheet visibly stops short of the screen
   * edge, so adding `insets.bottom` here counts that gap twice and leaves dead
   * space under the content. An iOS modal really does cover the home indicator,
   * so there the inset is what keeps buttons off it.
   *
   * Either way the sheet owns this gap: content inside must not add its own.
   */
  const bottomPadding = Platform.OS === 'ios' ? insets.bottom + 12 : 16;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      {/*
        Portals mount into the nearest host above them, and the app-root host is
        behind this native Modal — so without a host of its own, anything the
        sheet renders through a Portal (Paper `Menu`, `Dialog`, and therefore
        `CustomDropdown`'s option list) opens invisibly underneath the sheet.
      */}
      <Portal.Host>
        <View style={styles.backdrop}>
          <Pressable style={styles.dismissArea} onPress={onClose} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                paddingBottom: bottomPadding,
              },
              style,
            ]}
          >
            {showHandle && (
              <View style={[styles.dragHandle, { backgroundColor: theme.colors.outlineVariant }]} />
            )}
            {children}
          </View>
        </View>
        {/* The app's toast sits behind this window too, so a "saved" or "failed"
            raised while the sheet is open would go unseen without its own copy. */}
        <CustomToast />
      </Portal.Host>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    minHeight: 200,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
});
