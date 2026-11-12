import { getSnapshot } from 'mobx-state-tree';
import { AuthStore } from './AuthStore';

const signedIn = () => {
  const store = AuthStore.create({});
  store.login({ token: 'jwt', userId: 18, role: 'Patient' } as any);
  return store;
};

describe('AuthStore — a session ended elsewhere', () => {
  it('asks only while signed in, and never saves the question', () => {
    const store = signedIn();
    store.markSessionRevoked();

    expect(store.isSessionRevoked).toBe(true);
    expect(getSnapshot(store)).not.toHaveProperty('isSessionRevoked');

    const signedOut = AuthStore.create({});
    signedOut.markSessionRevoked();
    expect(signedOut.isSessionRevoked).toBe(false);
  });

  it('lets the question go only on logout or a new login', () => {
    const store = signedIn();

    store.markSessionRevoked();
    store.logout();
    expect(store.isSessionRevoked).toBe(false);

    store.login({ token: 'jwt-2', userId: 18, role: 'Patient' } as any);
    store.markSessionRevoked();
    store.login({ token: 'jwt-3', userId: 18, role: 'Patient' } as any);
    expect(store.isSessionRevoked).toBe(false);
  });
});
