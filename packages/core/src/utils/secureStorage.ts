import { createMMKV } from 'react-native-mmkv';
import { MMKV_ENCRYPTION_KEY } from '@env';

export const storage = createMMKV({
  id: 'app-storage',
  encryptionKey: MMKV_ENCRYPTION_KEY,
});

export const secureStorage = {
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  getItem: (key: string): string | undefined => {
    return storage.getString(key);
  },
  removeItem: (key: string) => {
    storage.remove(key);
  },
  clear: () => {
    storage.clearAll();
  },
};
