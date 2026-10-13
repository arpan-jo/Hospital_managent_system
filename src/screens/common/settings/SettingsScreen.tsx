import React, { memo, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Switch, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStores } from '@app/core';
import { CustomLanguageToggler, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';

interface SettingsRowProps {
  icon: string;
  label: string;
  description?: string;
  /** Rendered at the far right — a switch, a value, etc. */
  control?: React.ReactNode;
  /** Makes the whole row tappable, with a chevron standing in for the control. */
  onPress?: () => void;
  isLast?: boolean;
}

/** One icon-badge + label row of a settings card, matching the card rows used elsewhere. */
const SettingsRow = memo<SettingsRowProps>(function SettingsRow({
  icon,
  label,
  description,
  control,
  onPress,
  isLast = false,
}) {
  const theme = useTheme();

  const rowStyle = [
    styles.row,
    !isLast && [styles.rowDivider, { borderBottomColor: theme.colors.outlineVariant }],
  ];

  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: theme.colors.primaryContainer }]}>
        <Icon name={icon} size={17} color={theme.colors.primary} />
      </View>

      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, { color: theme.colors.onSurface }]}>{label}</Text>
        {description ? (
          <Text style={[styles.rowDesc, { color: theme.colors.onSurfaceVariant }]}>
            {description}
          </Text>
        ) : null}
      </View>

      {onPress ? (
        <Icon name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
      ) : (
        control
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={rowStyle} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{content}</View>;
});

export const SettingsScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { themeStore } = useStores();
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const handleThemeChange = useCallback(
    (val: boolean) => themeStore.setDarkMode(val),
    [themeStore],
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t('settings.title')} leading="menu" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          {t('settings.themeSection').toUpperCase()}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <SettingsRow
            icon={themeStore.isDarkMode ? 'weather-night' : 'weather-sunny'}
            label={t('settings.themeDark')}
            isLast
            control={
              <Switch value={themeStore.isDarkMode} onValueChange={handleThemeChange} />
            }
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          {t('settings.languageSection').toUpperCase()}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <SettingsRow icon="translate" label={t('common.language')} isLast />
          <View style={styles.togglerWrap}>
            <CustomLanguageToggler />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    borderRadius: 14,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13.5,
  },
  rowDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 1,
  },
  togglerWrap: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});

export default SettingsScreen;
