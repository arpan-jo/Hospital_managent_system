import { storage } from './secureStorage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number; // In milliseconds, 0 for no expiry
}

export const offlineCache = {
  /**
   * Sets data in the cache with a specified expiration time.
   * @param key Unique cache key.
   * @param data Data to cache.
   * @param expireInMinutes Expiration limit in minutes (default is 60, use 0 for infinite).
   */
  set: <T>(key: string, data: T, expireInMinutes: number = 60) => {
    try {
      const expiry = expireInMinutes > 0 ? expireInMinutes * 60 * 1000 : 0;
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiry,
      };
      storage.set(`cache_${key}`, JSON.stringify(entry));
    } catch (e) {
      console.warn(`[Offline Cache] Failed to save key "${key}":`, e);
    }
  },

  /**
   * Retrieves data from the cache. Returns null if expired or missing.
   * @param key Unique cache key.
   */
  get: <T>(key: string): T | null => {
    try {
      const saved = storage.getString(`cache_${key}`);
      if (!saved) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(saved);
      const isExpired = entry.expiry > 0 && Date.now() - entry.timestamp > entry.expiry;

      if (isExpired) {
        // Clear expired entry
        storage.remove(`cache_${key}`);
        return null;
      }

      return entry.data;
    } catch (e) {
      return null;
    }
  },

  /**
   * Retrieves expired cache data as a fallback during network errors.
   * @param key Unique cache key.
   */
  getExpiredFallback: <T>(key: string): T | null => {
    try {
      const saved = storage.getString(`cache_${key}`);
      if (!saved) {
        return null;
      }
      const entry: CacheEntry<T> = JSON.parse(saved);
      return entry.data;
    } catch (e) {
      return null;
    }
  },

  /**
   * Deletes a cache entry.
   * @param key Unique cache key.
   */
  remove: (key: string) => {
    storage.remove(`cache_${key}`);
  },

  /**
   * Clears all cache entries from MMKV.
   */
  clearAll: () => {
    const keys = storage.getAllKeys();
    keys.forEach((key) => {
      if (key.startsWith('cache_')) {
        storage.remove(key);
      }
    });
  },

  /**
   * Checks the cache first. If valid cache is found, returns it immediately.
   * Otherwise, executes the fetch function, stores the fresh data, and returns it.
   * If the fetch fails and network is lost, returns the expired cache fallback if available.
   */
  getOrFetch: async <T>(
    key: string,
    fetchFn: () => Promise<T>,
    expireInMinutes: number = 60
  ): Promise<T> => {
    // 1. Try valid cache first
    const cachedData = offlineCache.get<T>(key);
    if (cachedData !== null) {
      if (__DEV__) {
        console.log(`[Offline Cache] Serving key "${key}" from cache`);
      }
      return cachedData;
    }

    try {
      // 2. Try fetching fresh data
      const freshData = await fetchFn();
      offlineCache.set(key, freshData, expireInMinutes);
      return freshData;
    } catch (error) {
      // 3. Fallback: If offline/failed, return expired cache if present
      const expiredCache = offlineCache.getExpiredFallback<T>(key);
      if (expiredCache !== null) {
        if (__DEV__) {
          console.log(`[Offline Cache] Fetch failed. Serving expired fallback for key "${key}"`);
        }
        return expiredCache;
      }
      throw error;
    }
  },
};
export default offlineCache;
