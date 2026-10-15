import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStores } from '@app/core';
import { fontFamilies } from '@app/ui';

interface ScreenHeaderProps {
  title: string;
  /**
   * 'menu' for screens the drawer opens directly, 'back' for anything pushed on
   * top of one. A drawer entry point has nothing to go back to, so it must
   * offer the drawer instead.
   */
  leading: 'menu' | 'back';
  /**
   * Replaces the default drawer/back action. Screens that must not be returned
   * to — a placed booking, for one — send the user somewhere else instead.
   */
  onLeadingPress?: () => void;
  /** Small caption under the title — record counts, progress, etc. */
  subtitle?: string;
  /** Rendered at the far right — avatar, action button, etc. */
  right?: React.ReactNode;
}

export const ScreenHeader = observer(function ScreenHeader({
  title,
  leading,
  onLeadingPress,
  subtitle,
  right,
}: ScreenHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { notificationStore } = useStores();
  // Unread notifications wait in the drawer: the menu button carries a dot for them.
  const showMenuDot = leading === 'menu' && notificationStore.unreadCount > 0;

  const handlePress = useCallback(() => {
    if (onLeadingPress) {
      onLeadingPress();
    } else if (leading === 'menu') {
      navigation.dispatch(DrawerActions.openDrawer());
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [leading, onLeadingPress, navigation]);

  return (
    <View style={styles.header}>
      <Pressable
        onPress={handlePress}
        style={styles.leadingButton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={leading === 'menu' ? t('common.menu') : t('common.cancel')}
      >
        <Icon
          name={leading === 'menu' ? 'menu' : 'arrow-left'}
          size={22}
          color={theme.colors.onSurface}
        />
        {showMenuDot ? (
          <View
            style={[
              styles.menuDot,
              { backgroundColor: theme.colors.error, borderColor: theme.colors.background },
            ]}
          />
        ) : null}
      </Pressable>

      <View style={styles.titles}>
        {/* Shrinks a little before it is cut — "My Reports & Documents" beside
            the Upload button does not fit a 360dp phone at full size. */}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[styles.title, { color: theme.colors.onSurface }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right ?? null}
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  leadingButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
  },
  menuDot: {
    position: 'absolute',
    top: 3,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  titles: {
    flex: 1,
    marginLeft: 6,
    marginRight: 8,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 1,
  },
});

export default ScreenHeader;
