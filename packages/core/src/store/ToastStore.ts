import { types } from 'mobx-state-tree';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export const ToastStore = types
  .model('ToastStore', {
    visible: types.optional(types.boolean, false),
    message: types.optional(types.string, ''),
    type: types.optional(
      types.enumeration('ToastType', ['info', 'success', 'warning', 'error']),
      'info'
    ),
    duration: types.optional(types.number, 3000),
  })
  .actions((self) => ({
    show(message: string, type: ToastType = 'info', duration = 3000) {
      self.message = message;
      self.type = type;
      self.duration = duration;
      self.visible = true;
    },
    hide() {
      self.visible = false;
    },
  }));

export type IToastStore = typeof ToastStore.Type;
