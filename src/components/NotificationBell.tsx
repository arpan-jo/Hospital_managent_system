import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStores } from '@app/core';
import { fontFamilies } from '@app/ui';

/** The header's bell, with the unread count on it — the portal's badge, capped at 99+. */
export const NotificationBell = observer(({ onPress }: { onPress: () => void }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { notificationStore } = useStores();
  const count = notificationStore.unreadCount;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? t('notifications.bellLabelUnread', { count }) : t('notifications.bellLabel')
      }
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Icon
        name={count > 0 ? 'bell-ring-outline' : 'bell-outline'}
        size={21}
        color={theme.colors.onSurface}
      />
      {count > 0 ? (
        <View
          style={[
            styles.badge,
            { backgroundColor: theme.colors.error, borderColor: theme.colors.background },
          ]}
        >
          <Text style={[styles.badgeText, { color: theme.colors.onError }]}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    lineHeight: 13,
  },
});

export default NotificationBell;
