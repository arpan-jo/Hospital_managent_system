import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '@app/ui';
import { ProfileTab } from './useProfileViewModel';

const TABS: { key: ProfileTab; labelKey: string; icon: string }[] = [
  { key: 'personal', labelKey: 'patientProfile.tabPersonal', icon: 'account-outline' },
  { key: 'medical', labelKey: 'patientProfile.tabMedical', icon: 'pulse' },
  { key: 'allergies', labelKey: 'patientProfile.tabAllergies', icon: 'alert-circle-outline' },
  { key: 'family', labelKey: 'patientProfile.tabFamily', icon: 'account-multiple-outline' },
];

/**
 * Scrolls horizontally instead of squeezing four pills into the screen width —
 * translated labels are longer than the English ones and must not be clipped.
 *
 * `only` narrows the row to a subset in the order declared above, which is what
 * a relative's records screen shows: it has medical and allergies, and neither
 * a personal tab nor a family one.
 */
export const ProfileTabs = memo<{
  value: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  only?: readonly ProfileTab[];
}>(
  function ProfileTabs({ value, onChange, only }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const tabs = only?.length ? TABS.filter(tab => only.includes(tab.key)) : TABS;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.row}
        contentContainerStyle={styles.rowContent}
      >
        {tabs.map(tab => {
          const selected = tab.key === value;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[
                styles.tab,
                {
                  backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                  borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                },
              ]}
            >
              <Icon
                name={tab.icon}
                size={14}
                color={selected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.tabText,
                  { color: selected ? theme.colors.onPrimary : theme.colors.onSurface },
                ]}
              >
                {t(tab.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  },
);

const styles = StyleSheet.create({
  // Bleeds past the screen padding so pills can scroll edge to edge.
  row: {
    marginHorizontal: -16,
    marginTop: 16,
    flexGrow: 0,
  },
  rowContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tabText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
});

export default ProfileTabs;
