import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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

/** The profile's sections as one segmented control, each segment an equal share. */
export const ProfileTabs = memo<{
  value: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}>(function ProfileTabs({ value, onChange }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.row,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
      ]}
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
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginTop: 16,
    padding: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  tabText: {
    flexShrink: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
});

export default ProfileTabs;
