import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStores } from '@app/core';
import { fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';

type AppLanguage = 'en' | 'bn';

/**
 * Each language is named and described in itself, never translated, so a
 * patient who can't read the current one still finds their own.
 */
const LANGUAGES: { value: AppLanguage; badge: string; label: string; description: string }[] = [
  { value: 'en', badge: 'EN', label: 'English', description: 'Use the app in English' },
  { value: 'bn', badge: 'বা', label: 'বাংলা', description: 'অ্যাপটি বাংলায় দেখুন' },
];

interface ChoiceRowProps {
  /** A MaterialCommunityIcons name, or `badge` text in its place. */
  icon?: string;
  badge?: string;
  label: string;
  description?: string;
  selected: boolean;
  isLast?: boolean;
  onPress: () => void;
}

/** One option of a pick-one settings card: leading tile, label, and a tick when chosen. */
const ChoiceRow = memo<ChoiceRowProps>(function ChoiceRow({
  icon,
  badge,
  label,
  description,
  selected,
  isLast = false,
  onPress,
}) {
  const theme = useTheme();
  const tileInk = selected ? theme.colors.onPrimary : theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={[
        styles.row,
        !isLast && [styles.rowDivider, { borderBottomColor: theme.colors.outlineVariant }],
      ]}
    >
      <View
        style={[
          styles.rowTile,
          { backgroundColor: selected ? theme.colors.primary : theme.colors.primaryContainer },
        ]}
      >
        {icon ? (
          <Icon name={icon} size={17} color={tileInk} />
        ) : (
          <Text style={[styles.badgeText, { color: tileInk }]}>{badge}</Text>
        )}
      </View>

      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, { color: theme.colors.onSurface }]}>{label}</Text>
        {description ? (
          <Text style={[styles.rowDesc, { color: theme.colors.onSurfaceVariant }]}>
            {description}
          </Text>
        ) : null}
      </View>

      <Icon
        name={selected ? 'check-circle' : 'circle-outline'}
        size={22}
        color={selected ? theme.colors.primary : theme.colors.onSurfaceVariant}
      />
    </Pressable>
  );
});

export const SettingsScreen = observer(() => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { themeStore, languageStore } = useStores();
  // Light background — needs dark icons so the status bar stays legible.
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

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
          <ChoiceRow
            icon="weather-sunny"
            label={t('common.light')}
            selected={!themeStore.isDarkMode}
            onPress={() => themeStore.setDarkMode(false)}
          />
          <ChoiceRow
            icon="weather-night"
            label={t('common.dark')}
            selected={themeStore.isDarkMode}
            isLast
            onPress={() => themeStore.setDarkMode(true)}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          {t('settings.languageSection').toUpperCase()}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          {LANGUAGES.map((option, index) => (
            <ChoiceRow
              key={option.value}
              badge={option.badge}
              label={option.label}
              description={option.description}
              selected={languageStore.language === option.value}
              isLast={index === LANGUAGES.length - 1}
              onPress={() => languageStore.setLanguage(option.value)}
            />
          ))}
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
  rowTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
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
});

export default SettingsScreen;
