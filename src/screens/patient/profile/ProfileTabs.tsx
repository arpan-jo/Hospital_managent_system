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
 * The profile's sections as one segmented control. The segments share the
 * strip when their labels fit and it scrolls sideways when they do not, as the
 * portal's tab strip does — a narrow phone would otherwise cut them to "Perso…".
 */
export const ProfileTabs = memo<{
  value: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}>(function ProfileTabs({ value, onChange }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={[
        styles.row,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
      ]}
      contentContainerStyle={styles.rowContent}
    >
      {TABS.map(tab => {
        const selected = tab.key === value;
        const color = selected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.tab, selected ? { backgroundColor: theme.colors.primary } : null]}
          >
            <Icon name={tab.icon} size={15} color={color} />
            <Text numberOfLines={1} style={[styles.tabText, { color }]}>
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  row: {
    // A ScrollView shrinks by default — never below its own tabs.
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowContent: {
    flexGrow: 1,
    padding: 4,
  },
  tab: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  tabText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
});

export default ProfileTabs;
