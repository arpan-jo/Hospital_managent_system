import { PortalMessage } from '@app/core';
import { conversationItems, dayLabel, doctorInitial, parseWallClock, threadTime } from './messagesUi';

// The real date helpers, without loading the whole core (its stores need native storage).
jest.mock('@app/core', () => jest.requireActual('../../../../packages/core/src/utils/format'));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WORDS = { today: 'Today', yesterday: 'Yesterday' };
const TODAY = '2026-11-08';

describe('parseWallClock', () => {
  it('reads the day and the clock time as written', () => {
    expect(parseWallClock('2026-11-08T15:20:31.123')).toEqual({ day: '2026-11-08', time: '15:20' });
    expect(parseWallClock('2026-11-08 09:05:00')).toEqual({ day: '2026-11-08', time: '09:05' });
    expect(parseWallClock('2026-11-08')).toEqual({ day: '2026-11-08', time: '' });
  });

  it('is null for anything else', () => {
    expect(parseWallClock('')).toBeNull();
    expect(parseWallClock(null)).toBeNull();
    expect(parseWallClock('yesterday')).toBeNull();
  });
});

describe('dayLabel and threadTime', () => {
  it('says Today and Yesterday, and the date before that', () => {
    expect(dayLabel('2026-11-08', MONTHS, WORDS, TODAY)).toBe('Today');
    expect(dayLabel('2026-11-07', MONTHS, WORDS, TODAY)).toBe('Yesterday');
    expect(dayLabel('2026-11-01', MONTHS, WORDS, TODAY)).toContain('Nov');
  });

  it('crosses a month for yesterday', () => {
    expect(dayLabel('2026-10-31', MONTHS, WORDS, '2026-11-01')).toBe('Yesterday');
  });

  it("shows the time for today's thread", () => {
    expect(threadTime('2026-11-08T15:20:00', MONTHS, WORDS, TODAY)).toBe('3:20 PM');
    expect(threadTime('2026-11-07T15:20:00', MONTHS, WORDS, TODAY)).toBe('Yesterday');
    expect(threadTime('', MONTHS, WORDS, TODAY)).toBe('');
  });
});

describe('doctorInitial', () => {
  it('skips the title', () => {
    expect(doctorInitial('Dr. Ahsan Habib')).toBe('A');
    expect(doctorInitial('')).toBe('D');
    expect(doctorInitial(null)).toBe('D');
  });
});

describe('conversationItems', () => {
  const message = (id: number, createdAt: string): PortalMessage => ({
    messageId: id,
    senderType: 'patient',
    message: `m${id}`,
    isRead: true,
    createdAt,
  });

  it("puts a day heading before each day's first message", () => {
    const items = conversationItems(
      [
        message(1, '2026-11-07T10:00:00'),
        message(2, '2026-11-07T11:30:00'),
        message(3, '2026-11-08T09:00:00'),
      ],
      day => `D:${day}`,
    );
    expect(items.map(item => (item.kind === 'day' ? item.label : item.message.messageId))).toEqual([
      'D:2026-11-07',
      1,
      2,
      'D:2026-11-08',
      3,
    ]);
    expect(items[1]).toMatchObject({ kind: 'message', time: '10:00 AM' });
  });

  it('is empty for nothing', () => {
    expect(conversationItems(null, day => day)).toEqual([]);
  });
});
