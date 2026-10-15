jest.mock('@app/core', () => ({
  NotificationRepository: { getUnreadCount: jest.fn() },
  useStores: jest.fn(),
}));

import { NotificationRepository } from '@app/core';
import { endUnreadSession, readUnreadCount } from './useUnreadNotifications';

const getUnreadCount = NotificationRepository.getUnreadCount as jest.Mock;

/** The root store's notification store: one instance, whichever account is signed in. */
const makeStore = () => ({ unreadCount: 0, setUnreadCount: jest.fn(), reset: jest.fn() }) as any;

/** A request still on its way, settled by the test. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => (resolve = r));
  return { promise, resolve };
};

describe('readUnreadCount', () => {
  beforeEach(() => getUnreadCount.mockReset());

  it('shares one read between calls made while it is on its way', async () => {
    const store = makeStore();
    const slow = deferred<number>();
    getUnreadCount.mockReturnValueOnce(slow.promise);

    const first = readUnreadCount(store);
    const second = readUnreadCount(store);
    slow.resolve(2);
    await Promise.all([first, second]);

    expect(getUnreadCount).toHaveBeenCalledTimes(1);
    expect(store.setUnreadCount).toHaveBeenCalledWith(2);
  });

  it('reads again after a read that failed', async () => {
    const store = makeStore();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    getUnreadCount.mockRejectedValueOnce(new Error('offline'));
    await readUnreadCount(store);

    getUnreadCount.mockResolvedValueOnce(4);
    await readUnreadCount(store);
    log.mockRestore();

    expect(getUnreadCount).toHaveBeenCalledTimes(2);
    expect(store.setUnreadCount).toHaveBeenCalledWith(4);
  });

  it("gives the next account its own count while the last account's read is still on its way", async () => {
    const store = makeStore();
    const accountA = deferred<number>();
    getUnreadCount.mockReturnValueOnce(accountA.promise);
    const readA = readUnreadCount(store); // A's read leaves...

    endUnreadSession(store); // ...A signs out before it answers...

    getUnreadCount.mockResolvedValueOnce(5);
    const readB = readUnreadCount(store); // ...and B signs in.

    accountA.resolve(3); // A's answer lands late.
    await Promise.all([readA, readB]);

    expect(store.setUnreadCount).not.toHaveBeenCalledWith(3);
    expect(store.setUnreadCount).toHaveBeenCalledWith(5);
  });
});
