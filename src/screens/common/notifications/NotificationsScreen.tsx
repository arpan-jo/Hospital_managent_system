import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { Menu, Text, useTheme } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppNotification, NotificationTarget, notificationTarget } from '@app/core';
import { CustomButton, CustomDialog, fontFamilies } from '@app/ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { DrawerParamList } from '../../../navigation/DrawerNavigator';
import { useFocusedStatusBar } from '../../../hooks/useFocusedStatusBar';
import { useMonthNames } from '../../../hooks/useMonthNames';
import NotificationItem from './NotificationItem';
import NotificationActionsSheet from './NotificationActionsSheet';
import { notificationTimeLabel } from './notificationUi';
import { NotificationSection, useNotificationsViewModel } from './useNotificationsViewModel';

/**
 * Notifications — the portal header bell's inbox as a full screen: Today /
 * Yesterday / Earlier, an Unread filter, tap to open what it is about, and each
 * row's own actions behind ⋯ or a long press.
 */
export const NotificationsScreen = observer(() => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<DrawerNavigationProp<DrawerParamList>>();
  const insets = useSafeAreaInsets();
  const months = useMonthNames();
  const viewModel = useNotificationsViewModel();
  useFocusedStatusBar(theme.dark ? 'light-content' : 'dark-content');

  const [menuVisible, setMenuVisible] = useState(false);
  const [sheetItem, setSheetItem] = useState<AppNotification | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const muted = theme.colors.onSurfaceVariant;
  const unread = viewModel.unreadCount;

  /** The app screen a portal link names — the same places the portal's links lead. */
  const openTarget = useCallback(
    (target: NotificationTarget) => {
      switch (target.screen) {
        case 'appointment':
          navigation.navigate('MainTabs', {
            screen: 'ActivityTab',
            params: {
              screen: 'AppointmentDetails',
              params: { appointmentId: target.appointmentId },
              initial: false,
            },
          });
          break;
        case 'appointments':
          navigation.navigate('MainTabs', {
            screen: 'ActivityTab',
            params: { screen: 'AppointmentsList' },
          });
          break;
        case 'followUps':
          navigation.navigate('FollowUps');
          break;
        case 'prescriptions':
          navigation.navigate('Prescriptions');
          break;
        case 'reports':
          navigation.navigate('MainTabs', { screen: 'ReportsTab' });
          break;
        case 'findDoctors':
          navigation.navigate('MainTabs', { screen: 'HomeTab' });
          break;
        case 'profile':
          navigation.navigate('MainTabs', { screen: 'ProfileTab' });
          break;
      }
    },
    [navigation],
  );

  /** As on the portal: opening one marks it read, and a link takes the patient there. */
  const handleOpen = useCallback(
    (item: AppNotification) => {
      if (!item?.isRead) viewModel.markRead(item.id, true);
      const target = notificationTarget(item?.link);
      if (target) openTarget(target);
    },
    [viewModel, openTarget],
  );

  const handleConfirmClear = useCallback(async () => {
    if (await viewModel.clearRead()) setShowClearDialog(false);
  }, [viewModel]);

  const now = new Date();

  const renderSectionHeader = useCallback(
    ({ section }: { section: NotificationSection }) => (
      <Text style={[styles.sectionLabel, { color: muted }]}>
        {t(`notifications.${section.key}`)}
      </Text>
    ),
    [muted, t],
  );

  const renderItem = ({ item }: { item: AppNotification }) => (
    <NotificationItem
      item={item}
      timeLabel={notificationTimeLabel(item?.createdAt ?? '', now, t, months)}
      onPress={handleOpen}
      onMore={setSheetItem}
    />
  );

  const error = viewModel.error;
  const showToolbar = !viewModel.isLoading && !error && viewModel.hasNotifications;

  const emptyState =
    viewModel.filter === 'unread' ? (
      <StateView
        icon="email-open-outline"
        title={t('notifications.emptyUnreadTitle')}
        hint={t('notifications.emptyUnreadHint')}
        action={t('notifications.showAll')}
        onAction={() => viewModel.setFilter('all')}
        mode="text"
      />
    ) : (
      <StateView
        icon="bell-check-outline"
        title={t('notifications.emptyTitle')}
        hint={t('notifications.emptyHint')}
      />
    );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader
        title={t('notifications.title')}
        subtitle={
          unread > 0
            ? t('notifications.unreadSubtitle', { count: unread })
            : viewModel.hasNotifications
            ? t('notifications.caughtUpSubtitle')
            : undefined
        }
        leading="back"
        right={
          showToolbar ? (
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Pressable
                  onPress={() => setMenuVisible(true)}
                  hitSlop={8}
                  style={styles.menuButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('notifications.more')}
                >
                  <Icon name="dots-vertical" size={22} color={theme.colors.onSurface} />
                </Pressable>
              }
            >
              <Menu.Item
                leadingIcon="check-all"
                title={t('notifications.markAllRead')}
                disabled={unread <= 0}
                onPress={() => {
                  setMenuVisible(false);
                  viewModel.markAllRead();
                }}
              />
              <Menu.Item
                leadingIcon="broom"
                title={t('notifications.clearRead')}
                disabled={viewModel.readCount <= 0}
                onPress={() => {
                  setMenuVisible(false);
                  setShowClearDialog(true);
                }}
              />
            </Menu>
          ) : null
        }
      />

      {showToolbar ? (
        <View style={styles.toolbar}>
          <View style={styles.filters}>
            <FilterPill
              label={t('notifications.filterAll')}
              selected={viewModel.filter === 'all'}
              onPress={() => viewModel.setFilter('all')}
            />
            <FilterPill
              label={t('notifications.filterUnread')}
              count={unread}
              selected={viewModel.filter === 'unread'}
              onPress={() => viewModel.setFilter('unread')}
            />
          </View>
          {unread > 0 ? (
            <Pressable
              onPress={viewModel.markAllRead}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.markAll}
            >
              <Icon name="check-all" size={16} color={theme.colors.primary} />
              <Text numberOfLines={1} style={[styles.markAllText, { color: theme.colors.primary }]}>
                {t('notifications.markAllRead')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {viewModel.isLoading ? (
        <NotificationsSkeleton />
      ) : error ? (
        // A failed read must not look like an empty inbox.
        <ScrollView
          contentContainerStyle={styles.stateScroll}
          refreshControl={
            <RefreshControl
              refreshing={viewModel.isRefreshing}
              onRefresh={viewModel.refresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          <StateView
            icon="alert-circle-outline"
            tone="error"
            title={t('notifications.loadFailed')}
            hint={
              error.message ||
              (error.status
                ? t('notifications.serverResponded', { status: error.status })
                : error.unreachable
                ? t('notifications.serverUnreachable')
                : t('common.somethingWentWrong'))
            }
            action={t('notifications.tryAgain')}
            onAction={viewModel.retry}
          />
        </ScrollView>
      ) : (
        <SectionList
          sections={viewModel.sections}
          keyExtractor={item => String(item?.id)}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={emptyState}
          refreshControl={
            <RefreshControl
              refreshing={viewModel.isRefreshing}
              onRefresh={viewModel.refresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      <NotificationActionsSheet
        item={sheetItem}
        onClose={() => setSheetItem(null)}
        onOpen={handleOpen}
        onMarkRead={item => viewModel.markRead(item.id)}
        onDelete={item => viewModel.remove(item.id)}
      />

      <CustomDialog
        visible={showClearDialog}
        title={t('notifications.clearReadTitle')}
        message={t('notifications.clearReadMessage', { count: viewModel.readCount })}
        confirmText={t('notifications.clearReadConfirm')}
        cancelText={t('common.cancel')}
        loading={viewModel.isClearing}
        onConfirm={handleConfirmClear}
        onDismiss={() => setShowClearDialog(false)}
      />
    </SafeAreaView>
  );
});

const FilterPill = ({
  label,
  count = 0,
  selected,
  onPress,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
}) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={[
        styles.pill,
        selected
          ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
          : { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
      ]}
    >
      <Text
        style={[
          styles.pillText,
          { color: selected ? theme.colors.onPrimary : theme.colors.onSurface },
        ]}
      >
        {label}
      </Text>
      {count > 0 ? (
        <View
          style={[
            styles.pillCount,
            {
              backgroundColor: selected ? 'rgba(255,255,255,0.25)' : theme.colors.primaryContainer,
            },
          ]}
        >
          <Text
            style={[
              styles.pillCountText,
              { color: selected ? theme.colors.onPrimary : theme.colors.onPrimaryContainer },
            ]}
          >
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const StateView = ({
  icon,
  title,
  hint,
  action,
  onAction,
  tone = 'primary',
  mode = 'outlined',
}: {
  icon: string;
  title: string;
  hint: string;
  action?: string;
  onAction?: () => void;
  tone?: 'primary' | 'error';
  mode?: 'outlined' | 'text';
}) => {
  const theme = useTheme();
  const isError = tone === 'error';
  return (
    <View style={styles.state}>
      <View
        style={[
          styles.stateIcon,
          { backgroundColor: isError ? theme.colors.errorContainer : theme.colors.primaryContainer },
        ]}
      >
        <Icon name={icon} size={30} color={isError ? theme.colors.error : theme.colors.primary} />
      </View>
      <Text style={[styles.stateTitle, { color: theme.colors.onSurface }]}>{title}</Text>
      <Text style={[styles.stateHint, { color: theme.colors.onSurfaceVariant }]}>{hint}</Text>
      {action && onAction ? (
        <CustomButton mode={mode} onPress={onAction} style={styles.stateButton}>
          {action}
        </CustomButton>
      ) : null}
    </View>
  );
};

/** Grey rows in the shape of the cards, breathing while the first read is on its way. */
const NotificationsSkeleton = () => {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const block = { backgroundColor: theme.colors.surfaceVariant };

  return (
    <Animated.View style={[styles.listContent, { opacity: pulse }]}>
      <View style={[styles.skeletonLabel, block]} />
      {[0, 1, 2, 3].map(index => (
        <View
          key={index}
          style={[
            styles.skeletonCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
          ]}
        >
          <View style={[styles.skeletonIcon, block]} />
          <View style={styles.skeletonBody}>
            <View style={[styles.skeletonLine, styles.skeletonTitle, block]} />
            <View style={[styles.skeletonLine, styles.skeletonMessage, block]} />
            <View style={[styles.skeletonLine, styles.skeletonMessageEnd, block]} />
            <View style={[styles.skeletonLine, styles.skeletonTime, block]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 8,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pillText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  pillCount: {
    minWidth: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: 'center',
  },
  pillCountText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  markAllText: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
    flexShrink: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  sectionLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
    marginLeft: 2,
  },
  stateScroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  state: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 24,
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stateTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
    textAlign: 'center',
  },
  stateHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
  },
  stateButton: {
    marginTop: 18,
    borderRadius: 12,
    minWidth: 160,
  },
  skeletonLabel: {
    width: 60,
    height: 10,
    borderRadius: 5,
    marginTop: 18,
    marginBottom: 12,
  },
  skeletonCard: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  skeletonIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  skeletonBody: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonLine: {
    height: 11,
    borderRadius: 6,
  },
  skeletonTitle: {
    width: '70%',
  },
  skeletonMessage: {
    width: '95%',
    marginTop: 10,
  },
  skeletonMessageEnd: {
    width: '55%',
    marginTop: 6,
  },
  skeletonTime: {
    width: '28%',
    height: 8,
    marginTop: 12,
  },
});

export default NotificationsScreen;
