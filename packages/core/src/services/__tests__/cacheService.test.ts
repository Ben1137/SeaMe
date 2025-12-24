import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { cacheService } from '../cacheService';

// Mock IndexedDB
const createMockIndexedDB = () => {
  const store: Record<string, any> = {};

  const createRequest = (result?: any, error?: any) => {
    return {
      result,
      error,
      onsuccess: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
    };
  };

  const mockTransaction = {
    objectStore: () => ({
      get: (key: string) => {
        const request = createRequest(store[key]);
        setTimeout(() => request.onsuccess?.({ target: request }), 0);
        return request;
      },
      put: (value: any) => {
        store[value.key] = value;
        const request = createRequest(value);
        setTimeout(() => request.onsuccess?.({ target: request }), 0);
        return request;
      },
      delete: (key: string) => {
        delete store[key];
        const request = createRequest(undefined);
        setTimeout(() => request.onsuccess?.({ target: request }), 0);
        return request;
      },
      clear: () => {
        Object.keys(store).forEach(key => delete store[key]);
        const request = createRequest(undefined);
        setTimeout(() => request.onsuccess?.({ target: request }), 0);
        return request;
      },
      getAll: () => {
        const request = createRequest(Object.values(store));
        setTimeout(() => request.onsuccess?.({ target: request }), 0);
        return request;
      },
      openCursor: () => {
        const keys = Object.keys(store);
        let index = 0;
        const request = {
          result: null as any,
          onsuccess: null as ((event: any) => void) | null,
          onerror: null as ((event: any) => void) | null,
        };

        const nextCursor = () => {
          if (index < keys.length) {
            const key = keys[index];
            request.result = {
              value: store[key],
              delete: () => {
                delete store[key];
                return createRequest(undefined);
              },
              continue: () => {
                index++;
                setTimeout(() => nextCursor(), 0);
              },
            };
          } else {
            request.result = null;
          }
          setTimeout(() => request.onsuccess?.({ target: request }), 0);
        };

        setTimeout(() => nextCursor(), 0);
        return request;
      },
      createIndex: () => ({}),
      index: (name: string) => ({
        openCursor: (range?: any) => mockTransaction.objectStore().openCursor(),
      }),
    }),
  };

  const mockDB = {
    transaction: () => mockTransaction,
    createObjectStore: () => mockTransaction.objectStore(),
    objectStoreNames: {
      contains: () => false,
    },
  };

  return {
    open: (name: string, version: number) => {
      const request = {
        result: mockDB,
        error: null,
        onsuccess: null as ((event: any) => void) | null,
        onerror: null as ((event: any) => void) | null,
        onupgradeneeded: null as ((event: any) => void) | null,
      };

      setTimeout(() => {
        if (request.onupgradeneeded) {
          request.onupgradeneeded({ target: request });
        }
        request.onsuccess?.({ target: request });
      }, 0);

      return request;
    },
    deleteDatabase: () => createRequest(undefined),
    store,
  };
};

describe('cacheService', () => {
  let mockDB: ReturnType<typeof createMockIndexedDB>;

  beforeEach(() => {
    mockDB = createMockIndexedDB();
    global.indexedDB = mockDB as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('cache key generation', () => {
    it('should generate marine cache key with lat, lon, and date', () => {
      const key = cacheService.getMarineKey(32.0853, 34.7818, new Date('2024-01-15'));
      expect(key).toMatch(/^marine:32\.0853:34\.7818:2024-01-15$/);
    });

    it('should generate marine cache key with "current" when no date provided', () => {
      const key = cacheService.getMarineKey(32.0853, 34.7818);
      expect(key).toMatch(/^marine:32\.0853:34\.7818:current$/);
    });

    it('should format coordinates to 4 decimal places', () => {
      const key = cacheService.getMarineKey(32.08531234, 34.78181234);
      expect(key).toContain('32.0853');
      expect(key).toContain('34.7818');
    });

    it('should generate forecast cache key', () => {
      const key = cacheService.getForecastKey(32.0853, 34.7818, 'best_match', new Date('2024-01-15'));
      expect(key).toMatch(/^forecast:32\.0853:34\.7818:best_match:2024-01-15$/);
    });

    it('should generate current conditions cache key', () => {
      const key = cacheService.getCurrentKey(32.0853, 34.7818);
      expect(key).toBe('current:32.0853:34.7818');
    });
  });

  describe('TTL configuration', () => {
    it('should return correct TTL for marine data', () => {
      const ttl = cacheService.getTTL('marine');
      expect(ttl).toBe(30 * 60 * 1000); // 30 minutes
    });

    it('should return correct TTL for forecast data', () => {
      const ttl = cacheService.getTTL('forecast');
      expect(ttl).toBe(60 * 60 * 1000); // 1 hour
    });

    it('should return correct TTL for current data', () => {
      const ttl = cacheService.getTTL('current');
      expect(ttl).toBe(15 * 60 * 1000); // 15 minutes
    });
  });

  describe('get and set operations', () => {
    it('should store and retrieve data from cache', async () => {
      const testData = { temperature: 25, windSpeed: 10 };
      const key = 'test-key';
      const ttl = 60000; // 1 minute

      await cacheService.set(key, testData, ttl);
      const retrieved = await cacheService.get(key);

      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheService.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should return null for expired data', async () => {
      const testData = { value: 'test' };
      const key = 'expired-key';
      const ttl = -1000; // Already expired

      await cacheService.set(key, testData, ttl);
      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });

    it('should handle complex data structures', async () => {
      const complexData = {
        hourly: {
          time: ['2024-01-15T00:00:00Z', '2024-01-15T01:00:00Z'],
          wave_height: [1.5, 1.6],
          wind_speed: [10, 12],
        },
        current: {
          temperature: 25,
          pressure: 1013,
        },
      };

      const key = 'complex-data-key';
      await cacheService.set(key, complexData, 60000);
      const retrieved = await cacheService.get(key);

      expect(retrieved).toEqual(complexData);
    });
  });

  describe('delete operations', () => {
    it('should delete specific cache entry', async () => {
      const testData = { value: 'test' };
      const key = 'delete-test';

      await cacheService.set(key, testData, 60000);
      let result = await cacheService.get(key);
      expect(result).toEqual(testData);

      await cacheService.delete(key);
      result = await cacheService.get(key);
      expect(result).toBeNull();
    });

    it('should handle deleting non-existent key gracefully', async () => {
      await expect(cacheService.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clear all', () => {
    it('should clear all cached data', async () => {
      await cacheService.set('key1', { value: 1 }, 60000);
      await cacheService.set('key2', { value: 2 }, 60000);
      await cacheService.set('key3', { value: 3 }, 60000);

      await cacheService.clearAll();

      expect(await cacheService.get('key1')).toBeNull();
      expect(await cacheService.get('key2')).toBeNull();
      expect(await cacheService.get('key3')).toBeNull();
    });
  });

  describe('cache statistics', () => {
    it('should return cache statistics', async () => {
      await cacheService.set('key1', { data: 'test1' }, 60000);
      await cacheService.set('key2', { data: 'test2' }, 60000);

      const stats = await cacheService.getStats();

      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('itemCount');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('oldestItem');

      expect(stats.itemCount).toBeGreaterThan(0);
    });

    it('should track hit rate correctly', async () => {
      const key = 'hit-rate-test';
      await cacheService.set(key, { value: 'test' }, 60000);

      // Generate some hits
      await cacheService.get(key);
      await cacheService.get(key);

      // Generate some misses
      await cacheService.get('non-existent-1');
      await cacheService.get('non-existent-2');

      const stats = await cacheService.getStats();
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.hitRate).toBeLessThanOrEqual(100);
    });
  });

  describe('invalidate pattern', () => {
    it('should invalidate entries matching pattern', async () => {
      await cacheService.set('marine:32.0853:34.7818:2024-01-15', { data: 1 }, 60000);
      await cacheService.set('marine:32.0853:34.7818:2024-01-16', { data: 2 }, 60000);
      await cacheService.set('forecast:32.0853:34.7818:2024-01-15', { data: 3 }, 60000);

      await cacheService.invalidate('marine:');

      expect(await cacheService.get('marine:32.0853:34.7818:2024-01-15')).toBeNull();
      expect(await cacheService.get('marine:32.0853:34.7818:2024-01-16')).toBeNull();
      expect(await cacheService.get('forecast:32.0853:34.7818:2024-01-15')).not.toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully and return null', async () => {
      // Temporarily break IndexedDB
      const originalIndexedDB = global.indexedDB;
      global.indexedDB = undefined as any;

      const result = await cacheService.get('any-key');
      expect(result).toBeNull();

      // Restore
      global.indexedDB = originalIndexedDB;
    });

    it('should handle set errors gracefully', async () => {
      const originalIndexedDB = global.indexedDB;
      global.indexedDB = undefined as any;

      await expect(cacheService.set('key', { value: 'test' }, 60000)).resolves.not.toThrow();

      global.indexedDB = originalIndexedDB;
    });
  });

  describe('data expiration', () => {
    it('should auto-delete expired entries when retrieved', async () => {
      const key = 'expire-test';
      const ttl = -1000; // Negative TTL = already expired

      await cacheService.set(key, { value: 'test' }, ttl);
      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });
  });
});
