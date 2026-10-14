import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { fontFamilies } from '@app/ui';

export interface FilterPill {
  key: string;
  label: string;
  /** A count badge; left out when undefined. */
  count?: number;
}

interface FilterPillsProps {
  items: FilterPill[];
  selected: string;
  onSelect: (key: string) => void;
}

/** A scrolling row of pills — the category chips and the family-member chips. */
export const FilterPills = ({ items, selected, onSelect }: FilterPillsProps) => {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {items.map(item => {
        const isSelected = item.key === selected;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.pill,
              {
                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                borderColor: isSelected ? theme.colors.primary : theme.colors.outlineVariant,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface },
              ]}
            >
              {item.label}
            </Text>
            {item.count !== undefined ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isSelected
                      ? 'rgba(255,255,255,0.22)'
                      : theme.colors.primaryContainer,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: isSelected ? theme.colors.onPrimary : theme.colors.primary },
                  ]}
                >
                  {item.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    gap: 8,
    paddingHorizontal: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  badge: {
    minWidth: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignItems: 'center',
  },
  badgeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
  },
});

export default FilterPills;
