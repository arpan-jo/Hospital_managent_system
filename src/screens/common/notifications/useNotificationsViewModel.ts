import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  AppNotification,
  NotificationRepository,
  isServerUnreachable,
  serverMessageOf,
  useStores,
} from '@app/core';
import { unreadSession } from '../../../hooks/useUnreadNotifications';

export type NotificationFilter = 'all' | 'unread';
export type NotificationSectionKey = 'today' | 'yesterday' | 'earlier';
export type NotificationSection = { key: NotificationSectionKey; data: AppNotification[] };

/**
 * Why the list could not be read: the server's words ('' when none), its status
 * (0 when it gave none) and whether no answer came back at all.
 */
export type NotificationsError = { message: string; status: number; unreachable: boolean };

const SECTION_ORDER: NotificationSectionKey[] = ['today', 'yesterday', 'earlier'];

const unreadIn = (list: AppNotification[]): number =>
  list?.filter(item => !item?.isRead)?.length ?? 0;

/** Today / Yesterday / Earlier, on the phone's own calendar. */
const sectionOf = (createdAt: string, now: Date): NotificationSectionKey => {
  const time = new Date(createdAt).getTime();
  if (!Number.isFinite(time)) return 'earlier';
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  if (time >= todayStart) return 'today';
  if (time >= yesterdayStart) return 'yesterday';
  return 'earlier';
};

/**
 * The notification inbox, with the portal bell's business: the newest page
 * with its unread total, read each time the screen comes into view and on
 * pull-to-refresh; mark one or all read; delete one; clear the read ones. A
 * change shows at once and the next read from the server settles it, as the
 * portal re-reads after every change.
 */
export const useNotificationsViewModel = () => {
  const { t } = useTranslation();
  const { notificationStore, toastStore } = useStores();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<NotificationsError | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [isClearing, setIsClearing] = useState(false);

  /** Bumped by every read, so an older answer never lands over a newer one. */
  const requestRef = useRef(0);
  /**
   * Bumped by every change made here. A read that left before a change carries
   * the list as it was, so its rows are dropped and the change stays on screen.
   */
  const changeRef = useRef(0);

  const load = useCallback(
    async (mode: 'initial' | 'quiet' | 'refresh' = 'initial') => {
      const requestId = ++requestRef.current;
      const changeId = changeRef.current;
      const readSession = unreadSession();
      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);
      try {
        const page = await NotificationRepository.getNotifications();
        if (requestId !== requestRef.current || changeId !== changeRef.current) return;
        setNotifications(page?.notifications ?? []);
        // An answer that arrives after sign-out is the old account's count.
        if (readSession === unreadSession()) {
          notificationStore.setUnreadCount(page?.unreadCount ?? 0);
        }
        setError(null);
      } catch (e: any) {
        if (requestId !== requestRef.current) return;
        console.log('getNotifications error ==>', e?.message);
        // A quiet re-read that fails keeps what is already on screen.
        if (mode !== 'quiet') {
          setNotifications([]);
          setError({
          message: serverMessageOf(e),
          status: Number(e?.status ?? 0) || 0,
          unreachable: isServerUnreachable(e),
        });
        }
      } finally {
        if (requestId === requestRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [notificationStore],
  );

  // The first visit shows a loader; coming back re-reads behind what is shown.
  const hasLoadedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      load(hasLoadedRef.current ? 'quiet' : 'initial');
      hasLoadedRef.current = true;
    }, [load]),
  );

  /** Puts a change on screen before the server answers, and keeps the badge in step with it. */
  const applyLocal = useCallback(
    (next: AppNotification[]) => {
      changeRef.current += 1;
      const readNow = unreadIn(notifications) - unreadIn(next);
      setNotifications(next);
      if (readNow) notificationStore.setUnreadCount(notificationStore.unreadCount - readNow);
    },
    [notifications, notificationStore],
  );

  const reportFailure = useCallback(
    (e: any) => toastStore.show(serverMessageOf(e) || t('notifications.actionFailed'), 'error'),
    [toastStore, t],
  );

  /**
   * Marks one read. `quiet` when it rides along with opening the notification:
   * the patient is on their way to another screen, so a failure is not shown.
   */
  const markRead = useCallback(
    async (id: number, quiet = false) => {
      const item = notifications.find(entry => entry?.id === id);
      if (!item || item.isRead) return;
      applyLocal(notifications.map(entry => (entry.id === id ? { ...entry, isRead: true } : entry)));
      try {
        await NotificationRepository.markRead(id);
      } catch (e: any) {
        console.log('markRead error ==>', e?.message);
        if (!quiet) reportFailure(e);
      }
      load('quiet');
    },
    [notifications, applyLocal, reportFailure, load],
  );

  const markAllRead = useCallback(async () => {
    if (!notificationStore.unreadCount && !unreadIn(notifications)) return;
    applyLocal(notifications.map(entry => (entry.isRead ? entry : { ...entry, isRead: true })));
    // Rows past the first page are read on the server too.
    notificationStore.setUnreadCount(0);
    try {
      await NotificationRepository.markAllRead();
    } catch (e: any) {
      console.log('markAllRead error ==>', e?.message);
      reportFailure(e);
    }
    load('quiet');
  }, [notifications, notificationStore, applyLocal, reportFailure, load]);

  const remove = useCallback(
    async (id: number) => {
      if (!notifications.some(entry => entry?.id === id)) return;
      applyLocal(notifications.filter(entry => entry.id !== id));
      try {
        await NotificationRepository.remove(id);
      } catch (e: any) {
        console.log('removeNotification error ==>', e?.message);
        reportFailure(e);
      }
      load('quiet');
    },
    [notifications, applyLocal, reportFailure, load],
  );

  /** Clears every read notification; true once the server has done it. */
  const clearRead = useCallback(async (): Promise<boolean> => {
    if (isClearing) return false;
    setIsClearing(true);
    try {
      await NotificationRepository.clearRead();
      applyLocal(notifications.filter(entry => !entry.isRead));
      return true;
    } catch (e: any) {
      console.log('clearRead error ==>', e?.message);
      reportFailure(e);
      return false;
    } finally {
      setIsClearing(false);
      load('quiet');
    }
  }, [isClearing, notifications, applyLocal, reportFailure, load]);

  const readCount = useMemo(
    () => notifications?.filter(item => item?.isRead)?.length ?? 0,
    [notifications],
  );

  const sections = useMemo<NotificationSection[]>(() => {
    const now = new Date();
    const visible =
      filter === 'unread' ? notifications.filter(item => !item?.isRead) : notifications;
    const grouped: Record<NotificationSectionKey, AppNotification[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    visible.forEach(item => grouped[sectionOf(item?.createdAt ?? '', now)].push(item));
    return SECTION_ORDER.filter(key => grouped[key].length).map(key => ({
      key,
      data: grouped[key],
    }));
  }, [notifications, filter]);

  return {
    sections,
    filter,
    setFilter,
    unreadCount: notificationStore.unreadCount,
    hasNotifications: notifications.length > 0,
    readCount,
    isLoading,
    isRefreshing,
    error,
    retry: () => load('initial'),
    refresh: () => load('refresh'),
    markRead,
    markAllRead,
    remove,
    clearRead,
    isClearing,
  };
};

export default useNotificationsViewModel;
