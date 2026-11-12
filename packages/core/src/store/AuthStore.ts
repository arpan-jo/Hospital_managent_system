import { types } from 'mobx-state-tree';
import type { LoginResponse } from '../repositories/AuthRepository';

/**
 * `fullName`, `email` and `role` are nullable on the login response, so they
 * are nullable here too — MST throws on a null for a `types.string` field, and
 * that error surfaces inside `login()` as an unrelated-looking sign-in failure.
 * `userId` stays required: the API declares it non-nullable, and `login()`
 * falls back to 0 for it, as the web does.
 */
export const User = types.model('User', {
  userId: types.number,
  fullName: types.maybeNull(types.string),
  email: types.maybeNull(types.string),
  role: types.maybeNull(types.string),
});

export const AuthStore = types
  .model('AuthStore', {
    isAuthenticated: types.optional(types.boolean, false),
    user: types.maybeNull(User),
    authToken: types.maybeNull(types.string),
    expiresAt: types.maybeNull(types.string),
  })
  /**
   * The server refused this login with a bare 403 — it was ended elsewhere (a
   * sign-out or password reset on another device). Volatile: never saved, so a
   * relaunch does not bring the question back by itself.
   */
  .volatile(() => ({
    isSessionRevoked: false,
  }))
  .actions(self => ({
    login(response: LoginResponse) {
      self.user = User.create({
        userId: response?.userId ?? 0,
        fullName: response?.fullName ?? null,
        email: response?.email ?? null,
        role: response?.role ?? null,
      });
      self.authToken = response?.token ?? null;
      self.expiresAt = response?.expiresAt ?? null;
      self.isAuthenticated = true;
      self.isSessionRevoked = false;
    },
    logout() {
      self.isAuthenticated = false;
      self.user = null;
      self.authToken = null;
      self.expiresAt = null;
      self.isSessionRevoked = false;
    },
    /**
     * Asks the patient to log out and sign in again — the session ended
     * elsewhere. Only Log out answers it: `logout` (and a new `login`) clear it.
     */
    markSessionRevoked() {
      if (self.isAuthenticated) self.isSessionRevoked = true;
    },
  }));
