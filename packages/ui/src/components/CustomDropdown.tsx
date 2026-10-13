import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import {
  ActivityIndicator,
  HelperText,
  Menu,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamilies } from '../theme/typography';

/** Hard ceiling for the menu, so a long list never grows into the safe areas. */
const MAX_MENU_HEIGHT = 320;
/** Floor, so a cramped anchor still leaves a usable (scrollable) list. */
const MIN_MENU_HEIGHT = 176;
/** Paper's own edge padding around the menu (its `SCREEN_INDENT`). */
const SCREEN_INDENT = 8;
/** Vertical padding Paper's surface adds around the list, plus our own. */
const MENU_CHROME = 24;

export interface DropdownItem<T extends string = string> {
  label: string;
  value: T;
}

interface CustomDropdownProps<T extends string = string> {
  label: string;
  items: DropdownItem<T>[];
  value: T | '';
  onValueChange: (value: T) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  /** Adds a filter box above the list — for rosters too long to scroll. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Shown in place of the list when the filter matches nothing. */
  emptyText?: string;
  /** Replaces the list with a spinner while the items are still loading. */
  loading?: boolean;
  style?: ViewStyle;
}

export function CustomDropdown<T extends string = string>({
  label,
  items,
  value,
  onValueChange,
  placeholder = 'Select an option',
  error,
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search…',
  emptyText = 'No results found',
  loading = false,
  style,
}: CustomDropdownProps<T>) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [listHeight, setListHeight] = useState(MAX_MENU_HEIGHT);
  const anchorRef = useRef<View>(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const selectedLabel = useMemo(
    () => items?.find(item => item?.value === value)?.label ?? '',
    [items, value],
  );

  // Matching on the label alone is enough: callers that need a second field
  // searchable (a phone next to a name) fold it into the label they pass in.
  const visibleItems = useMemo(() => {
    const search = query?.trim()?.toLowerCase() ?? '';
    if (!searchable || !search) return items ?? [];

    return (items ?? []).filter(item =>
      item?.label?.toLowerCase()?.includes(search),
    );
  }, [items, query, searchable]);

  const menuContentStyle = useMemo(
    () => [styles.menuContent, { backgroundColor: theme.colors.surface }],
    [theme.colors.surface],
  );

  // Left to itself, Paper stretches an overflowing menu to the full window and
  // can push its top above y=0 — the first item then hides under the status
  // bar. Capping the list keeps positioning in Paper's "fits on screen" path.
  const listStyle = useMemo(() => ({ maxHeight: listHeight }), [listHeight]);

  // Measured against the same numbers Paper uses to place the menu, so the list
  // always fits the taller side of the anchor. If it did not, Paper would wrap
  // the children in a ScrollView of its own — and on Android the inner one then
  // stops scrolling (nested scrolling is off by default), stranding the items
  // past the fold.
  const open = useCallback(() => {
    if (disabled) {
      return;
    }

    const show = (height: number) => {
      setListHeight(height);
      setVisible(true);
    };

    if (!anchorRef.current) {
      show(MAX_MENU_HEIGHT);
      return;
    }

    anchorRef.current.measureInWindow((_x, y, _width, height) => {
      // Paper subtracts the keyboard from the window, and on Android offsets
      // everything by the status bar (the `statusBarHeight` passed below).
      const keyboardHeight = Keyboard.isVisible()
        ? Keyboard.metrics()?.height ?? 0
        : 0;
      const statusBarOffset = Platform.OS === 'android' ? insets.top : 0;
      const available = windowHeight - keyboardHeight;

      // The menu is anchored at the field's top edge, expanding down or up.
      const spaceBelow = available - y - SCREEN_INDENT - statusBarOffset;
      const spaceAbove = y + height - SCREEN_INDENT + statusBarOffset;

      show(
        Math.max(
          MIN_MENU_HEIGHT,
          Math.min(
            MAX_MENU_HEIGHT,
            Math.max(spaceBelow, spaceAbove) - MENU_CHROME,
          ),
        ),
      );
    });
  }, [disabled, insets.top, windowHeight]);

  const close = useCallback(() => {
    setVisible(false);
    // The next open starts on the full list rather than the last search.
    setQuery('');
  }, []);

  const menuItems = useMemo(
    () =>
      visibleItems.map(item => (
        <Menu.Item
          key={item?.value}
          title={item?.label}
          onPress={() => {
            onValueChange(item?.value);
            close();
          }}
          titleStyle={[
            styles.menuItemTitle,
            item?.value === value && { color: theme.colors.primary },
          ]}
          trailingIcon={item?.value === value ? 'check' : undefined}
        />
      )),
    [visibleItems, value, onValueChange, close, theme.colors.primary],
  );

  return (
    <View style={[styles.container, style]}>
      <Menu
        visible={visible}
        onDismiss={close}
        contentStyle={menuContentStyle}
        statusBarHeight={insets.top}
        anchor={
          // A non-editable TextInput swallows touches on Android, so only its
          // icon would open the menu. The whole field is the trigger instead,
          // with the input itself made transparent to touches.
          <Pressable
            ref={anchorRef}
            onPress={open}
            disabled={disabled}
            accessibilityRole="button"
          >
            <View pointerEvents="none">
              <TextInput
                mode="outlined"
                label={label}
                value={selectedLabel}
                placeholder={placeholder}
                editable={false}
                error={!!error}
                disabled={disabled}
                right={
                  <TextInput.Icon icon={visible ? 'chevron-up' : 'chevron-down'} />
                }
                style={[styles.input, { fontFamily: fontFamilies.regular }]}
              />
            </View>
          </Pressable>
        }
      >
        {searchable ? (
          <View style={styles.searchWrap}>
            <TextInput
              mode="outlined"
              dense
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              left={<TextInput.Icon icon="magnify" />}
              right={
                query ? (
                  <TextInput.Icon icon="close" onPress={() => setQuery('')} />
                ) : undefined
              }
              style={[styles.search, { fontFamily: fontFamilies.regular }]}
            />
          </View>
        ) : null}

        {loading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={listStyle}
            bounces={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {menuItems?.length ? (
              menuItems
            ) : (
              <View style={styles.stateWrap}>
                <Text style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                  {emptyText}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </Menu>
      <HelperText type="error" visible={!!error} style={styles.helper}>
        {error}
      </HelperText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    width: '100%',
  },
  input: {
    fontSize: 16,
  },
  menuContent: {
    borderRadius: 8,
    paddingVertical: 4,
  },
  menuItemTitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
  },
  searchWrap: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  search: {
    fontSize: 14,
  },
  stateWrap: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  stateText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  helper: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
  },
});

export default CustomDropdown;
