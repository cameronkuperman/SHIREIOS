import { MMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

const isWeb = process.env.EXPO_OS === 'web' || typeof window !== 'undefined';

export const storage = new MMKV({
  id: 'shire-app-storage',
  ...(isWeb ? {} : { encryptionKey: 'shire-enc-key' }),
});

/**
 * Zustand StateStorage adapter for MMKV.
 * Use with zustand's persist middleware to get 30x faster storage than AsyncStorage.
 */
export const zustandStorage: StateStorage = {
  getItem: (name: string): string | null => {
    return storage.getString(name) ?? null;
  },
  setItem: (name: string, value: string): void => {
    storage.set(name, value);
  },
  removeItem: (name: string): void => {
    storage.delete(name);
  },
};
