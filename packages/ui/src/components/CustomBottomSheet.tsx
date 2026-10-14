import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Keyboard, StyleSheet, View, Modal, Platform, Pressable, ViewStyle } from 'react-native';
import { Portal, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomToast } from './CustomToast';

/**
 * How long after the keyboard hides a back press still counts as the one that
 * hid it — the two reach the app in either order.
 */
const KEYBOARD_BACK_GRACE_MS = 400;

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

  /**
   * On Android the back press that hides the keyboard also reaches the Modal,
   * which would close the sheet and lose what was typed. While the keyboard is
   * up — or has only just gone — back only puts the keyboard away.
   */
  const keyboardRef = useRef({ isOpen: false, hiddenAt: 0 });
  useEffect(() => {
    if (!visible) return;
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      keyboardRef.current = { isOpen: true, hiddenAt: 0 };
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardRef.current = { isOpen: false, hiddenAt: Date.now() };
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [visible]);

  const handleRequestClose = useCallback(() => {
    const { isOpen, hiddenAt } = keyboardRef.current;
    if (isOpen || Date.now() - hiddenAt < KEYBOARD_BACK_GRACE_MS) {
      Keyboard.dismiss();
      return;
    }
    onClose();
  }, [onClose]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={handleRequestClose}
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
