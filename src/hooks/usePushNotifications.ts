import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavigationContainerRef } from '@react-navigation/native';
import {
  NotificationRepository,
  NotificationTarget,
  PushOpen,
  createPushChannel,
  notificationTarget,
  registerPushDevice,
  watchPush,
} from '@app/core';
import { navigationRef } from '../navigation/navigationRef';
import type { DrawerParamList } from '../navigation/DrawerNavigator';
import { openNotificationTarget } from '../screens/common/notifications/openNotificationTarget';
import { useRefreshUnreadNotifications } from './useUnreadNotifications';

/** Signed in, the root navigator is the drawer — what openNotificationTarget navigates. */
const drawerRef = navigationRef as unknown as NavigationContainerRef<DrawerParamList>;

/** A tap that launched the app can come before navigation is ready: tried for a few seconds. */
const openWhenReady = (target: NotificationTarget, tries = 20) => {
  if (drawerRef?.isReady?.()) {
    openNotificationTarget(drawerRef, target);
  } else if (tries > 0) {
    setTimeout(() => openWhenReady(target, tries - 1), 250);
  }
};

/**
 * Push notifications while signed in: this phone's token goes to the backend,
 * a push that comes while the app is open is shown and the bell reads again,
 * and a tap opens what it is about — as a tap in the Notifications screen does,
 * marking it read. Mount once, under the signed-in navigator.
 */
export const usePushNotifications = () => {
  const { t } = useTranslation();
  const refreshBell = useRefreshUnreadNotifications();
  const refreshRef = useRef(refreshBell);
  refreshRef.current = refreshBell;
  const channelName = t('notifications.pushChannel');

  useEffect(() => {
    createPushChannel(channelName);
  }, [channelName]);

  useEffect(() => {
    registerPushDevice();
    return watchPush({
      onMessage: () => refreshRef.current?.(),
      onOpen: (open: PushOpen) => {
        if (open?.notificationId) {
          NotificationRepository.markRead(open.notificationId)
            .catch((e: any) => console.log('push markRead error ==>', e?.message))
            .finally(() => refreshRef.current?.());
        }
        const target = notificationTarget(open?.link);
        if (target) openWhenReady(target);
      },
    });
  }, []);
};

export default usePushNotifications;
