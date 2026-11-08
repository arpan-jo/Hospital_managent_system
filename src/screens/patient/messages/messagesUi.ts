/** How messages read on screen — the thread list and the conversation. */
import { PortalMessage, stripHonorific, to12Hour, toISODate } from '@app/core';
import { formatRecordDate } from '../reports/reportsUi';

/** "2026-11-08T15:20:31.123" → its day and its clock time, read as written (Bangladesh wall-clock). */
export const parseWallClock = (value?: string | null): { day: string; time: string } | null => {
  const match = /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})/.exec(String(value ?? '').trim());
  if (!match) {
    const day = /^(\d{4}-\d{2}-\d{2})$/.exec(String(value ?? '').trim());
    return day ? { day: day[1], time: '' } : null;
  }
  return { day: match[1], time: `${match[2]}:${match[3]}` };
};

/** The day before `today`, as 'YYYY-MM-DD'. */
const dayBefore = (today: string): string => {
  const [y, m, d] = today.split('-').map(Number);
  return toISODate(new Date(y, (m || 1) - 1, (d || 1) - 1));
};

/** "Today", "Yesterday" or "8 Nov 2026" — what a day reads as over its messages. */
export const dayLabel = (
  day: string,
  months: string[],
  words: { today: string; yesterday: string },
  today = toISODate(new Date()),
): string => {
  if (day === today) return words.today;
  if (day === dayBefore(today)) return words.yesterday;
  return formatRecordDate(day, months);
};

/** When a thread last moved: the time today, "Yesterday", or the day. */
export const threadTime = (
  value: string | null | undefined,
  months: string[],
  words: { today: string; yesterday: string },
  today = toISODate(new Date()),
): string => {
  const at = parseWallClock(value);
  if (!at) return '';
  if (at.day === today) return at.time ? to12Hour(at.time) : words.today;
  return dayLabel(at.day, months, words, today);
};

/** A doctor's initial for an avatar without a photo — "Dr." does not count. */
export const doctorInitial = (name?: string | null): string =>
  stripHonorific(name ?? '').trim().charAt(0).toUpperCase() || 'D';

export type ConversationItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; message: PortalMessage; time: string };

/**
 * The conversation, oldest first, with a day heading before each day's first
 * message — the order the screen reads it in, top to bottom.
 */
export const conversationItems = (
  messages: PortalMessage[] | null | undefined,
  label: (day: string) => string,
): ConversationItem[] => {
  const items: ConversationItem[] = [];
  let lastDay = '';
  (messages ?? []).forEach((message, index) => {
    const at = parseWallClock(message?.createdAt);
    const day = at?.day ?? '';
    if (day && day !== lastDay) {
      items.push({ kind: 'day', key: `day-${day}`, label: label(day) });
      lastDay = day;
    }
    items.push({
      kind: 'message',
      key: `m-${message?.messageId || 'x'}-${index}`,
      message,
      time: at?.time ? to12Hour(at.time) : '',
    });
  });
  return items;
};
