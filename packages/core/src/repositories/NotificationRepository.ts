/**
 * The signed-in user's notifications, as the portal's header bell reads and
 * manages them: the newest page with the unread total, the unread count alone
 * for polling, and marking read or deleting one or all of them.
 */
import { API_URL } from '@env';
import apiRequest, { ApiRequestOptions } from '../network/apiRequest';
import { ENDPOINTS } from '../network/endpoints';
import { toNotificationTimestamp } from '../utils/notifications';

export const NOTIFICATION_TYPES = [
  'appointment_new',
  'appointment_confirmed',
  'appointment_cancelled',
  'follow_up_scheduled',
  'prescription_ready',
  'consultation_note',
  'general',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  /** The portal path it points at, e.g. "/appointments/3295" — '' when none. */
  link: string;
  isRead: boolean;
  /** ISO timestamp with its offset — see `toNotificationTimestamp`. */
  createdAt: string;
}

export interface NotificationPage {
  notifications: AppNotification[];
  unreadCount: number;
}

/** The portal's bell reads one page of the newest 30. */
export const NOTIFICATION_PAGE_SIZE = 30;

const toText = (value: any): string => String(value ?? '').trim();

const toNumber = (value: any): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toCount = (value: any): number => Math.max(Math.floor(toNumber(value)), 0);

/** Any type the portal does not draw an icon for is shown as `general`, as it does. */
const toType = (value: any): NotificationType => {
  const type = toText(value).toLowerCase();
  return (NOTIFICATION_TYPES as readonly string[]).includes(type)
    ? (type as NotificationType)
    : 'general';
};

const toNotification = (raw: any): AppNotification => ({
  id: toNumber(raw?.notificationId),
  type: toType(raw?.type),
  title: toText(raw?.title),
  message: toText(raw?.message),
  link: toText(raw?.link),
  isRead: raw?.isRead === true,
  createdAt: toNotificationTimestamp(raw?.createdAt),
});

export const NotificationRepository = {
  /** `GET /hms/notifications?page=&pageSize=` — newest first, with the unread total. */
  getNotifications: async (
    page = 1,
    pageSize = NOTIFICATION_PAGE_SIZE,
  ): Promise<NotificationPage> => {
    const api_params: ApiRequestOptions = {
      url: ENDPOINTS.notifications,
      method: 'GET',
      baseUrl: API_URL,
      params: { page, pageSize },
    };
    const response = await apiRequest<any>(api_params);

    // A body without the list is a failure, not an empty inbox.
    if (!Array.isArray(response?.notifications)) {
      throw new Error('Unexpected notifications response');
    }

    return {
      notifications: response.notifications
        .map(toNotification)
        .filter((item: AppNotification) => item.id > 0),
      unreadCount: toCount(response?.unreadCount),
    };
  },

  /** `GET /hms/notifications/unread-count` — the light read behind the badge. */
  getUnreadCount: async (): Promise<number> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.notifications}/unread-count`,
      method: 'GET',
      baseUrl: API_URL,
    };
    const response = await apiRequest<any>(api_params);
    return toCount(response?.unreadCount);
  },

  /** `PATCH /hms/notifications/{id}/read` — 204, or 404 when it is not the user's. */
  markRead: async (notificationId: number): Promise<void> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.notifications}/${toNumber(notificationId)}/read`,
      method: 'PATCH',
      baseUrl: API_URL,
    };
    await apiRequest<any>(api_params);
  },

  /** `PATCH /hms/notifications/read-all`. */
  markAllRead: async (): Promise<void> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.notifications}/read-all`,
      method: 'PATCH',
      baseUrl: API_URL,
    };
    await apiRequest<any>(api_params);
  },

  /** `DELETE /hms/notifications/{id}` — 204, or 404 when it is not the user's. */
  remove: async (notificationId: number): Promise<void> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.notifications}/${toNumber(notificationId)}`,
      method: 'DELETE',
      baseUrl: API_URL,
    };
    await apiRequest<any>(api_params);
  },

  /** `DELETE /hms/notifications/clear-read` — every notification already read. */
  clearRead: async (): Promise<void> => {
    const api_params: ApiRequestOptions = {
      url: `${ENDPOINTS.notifications}/clear-read`,
      method: 'DELETE',
      baseUrl: API_URL,
    };
    await apiRequest<any>(api_params);
  },
};

export default NotificationRepository;
