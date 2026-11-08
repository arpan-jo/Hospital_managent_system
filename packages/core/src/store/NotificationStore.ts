import { types } from 'mobx-state-tree';

/**
 * The unread notification count behind the bell's badge, the drawer row and
 * the menu button's dot — and the unread messages behind the Messages row and
 * the home screen's tile. Not saved with the rest of the store: both are read
 * from the server while the app is signed in.
 */
export const NotificationStore = types
  .model('NotificationStore', {
    unreadCount: types.optional(types.number, 0),
    unreadMessages: types.optional(types.number, 0),
  })
  .actions(self => ({
    setUnreadCount(count: number) {
      self.unreadCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
    },
    setUnreadMessages(count: number) {
      self.unreadMessages = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
    },
    reset() {
      self.unreadCount = 0;
    },
    resetMessages() {
      self.unreadMessages = 0;
    },
  }));

export type INotificationStore = typeof NotificationStore.Type;
