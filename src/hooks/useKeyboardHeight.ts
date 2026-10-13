import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Height the soft keyboard currently covers, or 0 while it is hidden.
 *
 * The app targets SDK 36, so Android 15+ runs it edge-to-edge and
 * `adjustResize` no longer shrinks the window: the keyboard paints straight
 * over the content, a ScrollView never overflows, and the fields underneath
 * can neither be seen nor scrolled to. Adding this height to the scroll
 * content's `paddingBottom` restores both — and works the same on iOS, where
 * the reported height already includes the home-indicator inset.
 */
export const useKeyboardHeight = (): number => {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS reports the frame before the animation, Android only after it.
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event =>
      setHeight(event?.endCoordinates?.height ?? 0),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
};

export default useKeyboardHeight;
