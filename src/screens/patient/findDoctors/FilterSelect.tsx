import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '@app/ui';

export interface SelectOption<T extends string> {
  label: string;
  value: T;
}

interface FilterSelectProps<T extends string> {
  label: string;
  value: T;
  items: SelectOption<T>[];
  placeholder: string;
  onChange: (value: T) => void;
}

/** Roughly five rows — past that the list scrolls instead of growing the sheet. */
const MAX_OPTIONS_HEIGHT = 220;

/**
 * Bordered select that expands its options inline.
 *
 * Deliberately not `CustomDropdown`/Paper `Menu`: those render the option list
 * in a `Portal` mounted at the app root, which is a separate layer from the
 * native `Modal` behind `CustomBottomSheet` — the list opens behind the sheet
 * and is invisible. Expanding in place keeps everything in one layer.
 */
export function FilterSelect<T extends string>({
  label,
  value,
  items,
  placeholder,
  onChange,
}: FilterSelectProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const selected = items.find(item => item.value === value);

  const toggle = useCallback(() => setOpen(prev => !prev), []);

  const handleSelect = useCallback(
    (next: T) => {
      onChange(next);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.onSurface }]}>
        {label}
      </Text>

      <Pressable
        onPress={toggle}
        style={[
          styles.field,
          {
            backgroundColor: theme.colors.surface,
            borderColor: open
              ? theme.colors.primary
              : theme.colors.outlineVariant,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.fieldText,
            {
              color: selected
                ? theme.colors.onSurface
                : theme.colors.onSurfaceVariant,
            },
          ]}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Icon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>

      {open ? (
        <View
          style={[
            styles.options,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        >
          {/*
            Bounded and scrollable: a long list would otherwise push the rest of
            the fields past the sheet's own 85% cap. `nestedScrollEnabled` is
            what lets it scroll inside the sheet's ScrollView on Android.
          */}
          <ScrollView
            style={styles.optionList}
            nestedScrollEnabled
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {items.map(item => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  key={item.value || 'all'}
                  onPress={() => handleSelect(item.value)}
                  style={[
                    styles.option,
                    isSelected && {
                      backgroundColor: theme.colors.primaryContainer,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.optionText,
                      {
                        color: isSelected
                          ? theme.colors.primary
                          : theme.colors.onSurface,
                        fontFamily: isSelected
                          ? fontFamilies.semibold
                          : fontFamilies.regular,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isSelected ? (
                    <Icon name="check" size={16} color={theme.colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
  },
  fieldText: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  options: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
  },
  optionList: {
    maxHeight: MAX_OPTIONS_HEIGHT,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  optionText: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
});

export default FilterSelect;
