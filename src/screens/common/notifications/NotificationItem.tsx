import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppNotification, notificationTarget } from '@app/core';
import { fontFamilies } from '@app/ui';
import { TYPE_ICON, targetLabelKey, toneOf, unreadBackground } from './notificationUi';

interface NotificationItemProps {
  item: AppNotification;
  /** "3h ago" / "12 Oct, 4:30 PM", worked out by the list. */
  timeLabel: string;
  onPress: (item: AppNotification) => void;
  /** The row's own actions — from the ⋯ button or a long press. */
  onMore: (item: AppNotification) => void;
}

/**
 * One notification: its kind as a tinted icon, the server's title and message,
 * when it came, and — when it leads somewhere — what tapping it opens. Unread
 * ones sit on a brand tint with a dot on the icon.
 */
export const NotificationItem = memo<NotificationItemProps>(function NotificationItem({
  item,
  timeLabel,
  onPress,
  onMore,
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const tone = toneOf(item?.type, theme.dark);
  const unread = !item?.isRead;
  const target = notificationTarget(item?.link);
  const targetLabel = targetLabelKey(target);

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={() => onMore(item)}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityState={{ selected: unread }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: unread ? unreadBackground(theme.dark) : theme.colors.surface,
          borderColor: unread ? theme.colors.primaryContainer : theme.colors.outlineVariant,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: tone.tint }]}>
        <Icon name={TYPE_ICON[item?.type] ?? TYPE_ICON.general} size={22} color={tone.color} />
        {unread ? (
          <View
            style={[
              styles.unreadDot,
              {
                backgroundColor: theme.colors.primary,
                borderColor: unreadBackground(theme.dark),
              },
            ]}
          />
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            numberOfLines={2}
            style={[
              styles.title,
              {
                color: theme.colors.onSurface,
                fontFamily: unread ? fontFamilies.bold : fontFamilies.semibold,
              },
            ]}
          >
            {item?.title || t('notifications.title')}
          </Text>
          <Pressable
            onPress={() => onMore(item)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('notifications.more')}
            style={styles.moreButton}
          >
            <Icon name="dots-horizontal" size={20} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        </View>

        {item?.message ? (
          <Text
            numberOfLines={3}
            style={[styles.message, { color: theme.colors.onSurfaceVariant }]}
          >
            {item.message}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.time,
              { color: unread ? theme.colors.primary : theme.colors.onSurfaceVariant },
            ]}
          >
            {timeLabel}
          </Text>
          {targetLabel ? (
            <View style={styles.openLink}>
              <Text numberOfLines={1} style={[styles.openText, { color: theme.colors.primary }]}>
                {t(targetLabel)}
              </Text>
              <Icon name="chevron-right" size={16} color={theme.colors.primary} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#0B1030',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  body: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 20,
  },
  moreButton: {
    marginLeft: 8,
    marginTop: -1,
  },
  message: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  time: {
    flexShrink: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
  },
  openLink: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  openText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
});

export default NotificationItem;
