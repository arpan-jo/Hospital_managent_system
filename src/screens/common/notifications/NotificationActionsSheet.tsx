import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppNotification, notificationTarget } from '@app/core';
import { CustomBottomSheet, fontFamilies } from '@app/ui';
import { TYPE_ICON, targetLabelKey, toneOf } from './notificationUi';

interface NotificationActionsSheetProps {
  /** The notification the sheet is for; null closes it. */
  item: AppNotification | null;
  onClose: () => void;
  onOpen: (item: AppNotification) => void;
  onMarkRead: (item: AppNotification) => void;
  onDelete: (item: AppNotification) => void;
}

/** One notification's actions — open it, mark it read, delete it — the portal row's buttons. */
export const NotificationActionsSheet = memo<NotificationActionsSheetProps>(
  function NotificationActionsSheet({ item, onClose, onOpen, onMarkRead, onDelete }) {
    const theme = useTheme();
    const { t } = useTranslation();

    const tone = toneOf(item?.type ?? 'general', theme.dark);
    const targetLabel = targetLabelKey(notificationTarget(item?.link));

    const run = (action: (entry: AppNotification) => void) => () => {
      if (!item) return;
      onClose();
      action(item);
    };

    return (
      <CustomBottomSheet visible={!!item} onClose={onClose}>
        <View style={styles.header}>
          <View style={[styles.iconTile, { backgroundColor: tone.tint }]}>
            <Icon
              name={TYPE_ICON[item?.type ?? 'general'] ?? TYPE_ICON.general}
              size={20}
              color={tone.color}
            />
          </View>
          <Text numberOfLines={2} style={[styles.title, { color: theme.colors.onSurface }]}>
            {item?.title || t('notifications.title')}
          </Text>
        </View>

        {targetLabel ? (
          <Option icon="arrow-top-right" label={t(targetLabel)} onPress={run(onOpen)} />
        ) : null}
        {item && !item.isRead ? (
          <Option icon="check" label={t('notifications.markRead')} onPress={run(onMarkRead)} />
        ) : null}
        <Option
          icon="trash-can-outline"
          label={t('notifications.delete')}
          onPress={run(onDelete)}
          destructive
        />
      </CustomBottomSheet>
    );
  },
);

const Option = memo<{
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}>(function Option({ icon, label, onPress, destructive }) {
  const theme = useTheme();
  const color = destructive ? theme.colors.error : theme.colors.onSurface;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.option,
        { borderColor: theme.colors.outlineVariant, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View
        style={[
          styles.optionIcon,
          {
            backgroundColor: destructive
              ? theme.colors.errorContainer
              : theme.colors.primaryContainer,
          },
        ]}
      >
        <Icon
          name={icon}
          size={18}
          color={destructive ? theme.colors.error : theme.colors.primary}
        />
      </View>
      <Text style={[styles.optionText, { color }]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 15.5,
    lineHeight: 21,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
});

export default NotificationActionsSheet;
