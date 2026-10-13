import { useCallback, useRef } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

/**
 * Calls `reload` each time the screen comes back into view.
 *
 * Tab and drawer screens stay mounted, so a screen left open still shows what
 * it read the first time: a change made on another screen, or on the portal,
 * would not appear until the app restarted. The focus that comes with
 * mounting is skipped — the screen's own first read covers it — but only when
 * the screen mounted in view; one mounted out of sight reloads on its first
 * focus.
 *
 * `reload` is held in a ref, so a new function on every render does not make
 * the focus effect run again.
 */
export const useReloadOnRefocus = (reload: () => void) => {
  const navigation = useNavigation();
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const skipNextFocusRef = useRef(navigation.isFocused());

  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusRef.current) {
        skipNextFocusRef.current = false;
        return;
      }
      reloadRef.current();
    }, []),
  );
};

export default useReloadOnRefocus;
