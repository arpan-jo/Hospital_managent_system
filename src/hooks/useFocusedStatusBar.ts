import { useCallback } from 'react';
import { StatusBar, StatusBarStyle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Applies a status bar style for as long as this screen is focused.
 *
 * RN's status bar is global state, and navigator screens stay mounted, so a
 * screen with a coloured header (white icons) leaves those white icons behind
 * on the next light-background screen — where they are invisible. Re-applying
 * on focus makes every screen correct itself on entry.
 *
 * Only the bar style is set: `App.tsx` runs a translucent, transparent-background
 * status bar so each screen's own header paints through it.
 */
export const useFocusedStatusBar = (barStyle: StatusBarStyle) => {
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle(barStyle, true);
    }, [barStyle]),
  );
};

export default useFocusedStatusBar;
