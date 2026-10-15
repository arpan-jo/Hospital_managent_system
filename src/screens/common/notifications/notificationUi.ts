import type { TFunction } from 'i18next';
import { NotificationTarget, NotificationType, to12Hour } from '@app/core';

type Tone = { color: string; tint: string };

/** One icon per kind, in the tone of the screen it is about. */
export const TYPE_ICON: Record<NotificationType, string> = {
  appointment_new: 'calendar-clock',
  appointment_confirmed: 'calendar-check',
  appointment_cancelled: 'calendar-remove',
  follow_up_scheduled: 'calendar-refresh',
  prescription_ready: 'clipboard-text',
  consultation_note: 'note-text-outline',
  general: 'bell-outline',
};

// The appointment screens' status tones, so a confirmed visit is the same green everywhere.
const TONE_LIGHT: Record<NotificationType, Tone> = {
  appointment_new: { color: '#2F55D4', tint: '#EAF0FF' },
  appointment_confirmed: { color: '#1B8A4B', tint: '#E6F6EC' },
  appointment_cancelled: { color: '#C62828', tint: '#FDECEC' },
  follow_up_scheduled: { color: '#B27400', tint: '#FEF3E0' },
  prescription_ready: { color: '#7B3FD1', tint: '#F2EBFD' },
  consultation_note: { color: '#0B7FB3', tint: '#E4F4FB' },
  general: { color: '#5F6478', tint: '#EEEFF4' },
};

const TONE_DARK: Record<NotificationType, Tone> = {
  appointment_new: { color: '#9FB4FF', tint: '#1F2A4F' },
  appointment_confirmed: { color: '#6FD3A0', tint: '#173126' },
  appointment_cancelled: { color: '#F2B8B5', tint: '#3A1F1E' },
  follow_up_scheduled: { color: '#F5C26B', tint: '#3A2E14' },
  prescription_ready: { color: '#C9A8FF', tint: '#2C2145' },
  consultation_note: { color: '#7FD0F5', tint: '#14303D' },
  general: { color: '#B9BFD4', tint: '#272B3A' },
};

export const toneOf = (type: NotificationType, dark: boolean): Tone =>
  (dark ? TONE_DARK : TONE_LIGHT)[type] ?? (dark ? TONE_DARK : TONE_LIGHT).general;

/** An unread row sits on a faint brand tint, as unread mail does. */
export const unreadBackground = (dark: boolean): string => (dark ? '#1C2240' : '#F4F6FF');

/** What tapping the row opens, said on the row itself. */
export const targetLabelKey = (target: NotificationTarget | null): string =>
  target ? `notifications.open.${target.screen}` : '';

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * "Just now", "12 min ago", "3h ago" inside a day; after that the date and
 * clock time — "12 Oct, 4:30 PM", with the year when it is not this year's.
 */
export const notificationTimeLabel = (
  createdAt: string,
  now: Date,
  t: TFunction,
  monthNames: string[],
): string => {
  const date = new Date(createdAt);
  const time = date.getTime();
  if (!Number.isFinite(time)) return '';

  // A clock a little ahead of the server's still reads as "just now".
  const minutes = Math.floor((now.getTime() - time) / 60_000);
  if (minutes < 1) return t('notifications.justNow');
  if (minutes < 60) return t('notifications.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.hoursAgo', { count: hours });

  const day = `${date.getDate()} ${monthNames[date.getMonth()] ?? ''}`;
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${day}${year}, ${to12Hour(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`)}`;
};
