import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';

/**
 * How much of a view the soft keyboard covers — 0 while it is hidden, or while
 * the window has already made room for it.
 *
 * `useKeyboardHeight` suits a scroll view, where extra room at the end is
 * harmless. A box pinned to the bottom — a chat's composer — needs the exact
 * overlap: on Android 15+ the app runs edge-to-edge and the keyboard paints
 * over the window, but an older Android still resizes the window
 * (`adjustResize`), and padding by the whole keyboard there would lift the box
 * a keyboard's height too far. So the view is measured on the screen and only
 * the part under the keyboard's top edge counts. Pass the view's `onLayout`
 * through `remeasure`, so a window resized after the keyboard event is caught.
 */
export const useKeyboardOverlap = (ref: RefObject<View | null>) => {
  const [overlap, setOverlap] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  /** The keyboard's top edge on the screen; null while it is hidden. */
  const keyboardTopRef = useRef<number | null>(null);

  const remeasure = useCallback(() => {
    const keyboardTop = keyboardTopRef.current;
    if (keyboardTop === null) {
      setOverlap(0);
      return;
    }
    const node = ref?.current;
    if (!node?.measureInWindow) return;
    node.measureInWindow((_x, y, _width, height) => {
      if (keyboardTopRef.current === null) return;
      const covered = Math.round((y ?? 0) + (height ?? 0) - keyboardTop);
      setOverlap(Number.isFinite(covered) && covered > 0 ? covered : 0);
    });
  }, [ref]);

  useEffect(() => {
    // iOS reports the frame before the animation, Android only after it.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event => {
      const top = event?.endCoordinates?.screenY;
      keyboardTopRef.current = Number.isFinite(top) ? top : null;
      setIsKeyboardOpen(true);
      remeasure();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardTopRef.current = null;
      setIsKeyboardOpen(false);
      setOverlap(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [remeasure]);

  return { overlap, isKeyboardOpen, remeasure };
};

export default useKeyboardOverlap;
