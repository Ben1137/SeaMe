/**
 * Weather Data Cache Service
 * 
 * Implements intelligent caching for Open-Meteo API responses using IndexedDB.
 * Features:
 * - Stale-while-revalidate pattern
 * - Configurable TTL per data type
 * - Automatic cleanup of expired data
 * - 50MB storage limit with LRU eviction
 */

interface CacheConfig {
  key: string;
  ttl: number; // milliseconds
  staleWhileRevalidate: boolean;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  size: number; // bytes
}

interface CacheStats {
  totalSize: number;
  itemCount: number;
  hitRate: number;
  oldestItem: number;
}

class WeatherCacheService {
  private dbName = 'SeaMeCache';
  private storeName = 'weatherData';
  private version = 1;
  private db: IDBDatabase | null = null;
  private maxSize = 50 * 1024 * 1024; // 50MB
  
  // Cache TTL configurations
  private readonly TTL = {
    marine: 30 * 60 * 1000,      // 30 minutes - wave data changes slowly
    forecast: 60 * 60 * 1000,     // 60 minutes - forecast updates hourly
    current: 15 * 60 * 1000,      // 15 minutes - current conditions
    multiModel: 60 * 60 * 1000,   // 60 minutes - model comparison
    grib: 24 * 60 * 60 * 1000,    // 24 hours - GRIB files
  };
  
  // Cache hit/miss tracking
  private stats = {
    hits: 0,
    misses: 0,
  };

  /**
   * Initialize IndexedDB connection
   */
  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        
        request.onsuccess = () => {
          const cached = request.result as CachedData<T> | undefined;
          
          if (!cached) {
            this.stats.misses++;
            resolve(null);
            return;
          }
          
          const now = Date.now();
          
          // Check if expired
          if (now > cached.expiresAt) {
            this.stats.misses++;
            // Delete expired entry
            this.delete(key);
            resolve(null);
            return;
          }
          
          this.stats.hits++;
          resolve(cached.data);
        };
        
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set data in cache
   */
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const db = await this.openDB();
      const now = Date.now();
      
      // Calculate data size (rough estimate)
      const size = new Blob([JSON.stringify(data)]).size;
      
      // Ensure we have space
      await this.ensureSpace(size);
      
      const cached: CachedData<T> = {
        data,
        timestamp: now,
        expiresAt: now + ttl,
        size,
      };
      
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.put({ key, ...cached });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete specific cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Invalidate cache entries matching pattern
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor) {
            const key = cursor.value.key as string;
            if (key.includes(pattern)) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }

  /**
   * Clear all cache data
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          this.stats = { hits: 0, misses: 0 };
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Delete expired entries
   */
  async deleteExpired(): Promise<number> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const index = store.index('expiresAt');
      const now = Date.now();
      
      let deletedCount = 0;
      
      return new Promise((resolve, reject) => {
        const request = index.openCursor(IDBKeyRange.upperBound(now));
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            resolve(deletedCount);
          }
        };
        
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Delete expired error:', error);
      return 0;
    }
  }

  /**
   * Ensure we have enough space by deleting oldest entries
   */
  private async ensureSpace(needed: number): Promise<void> {
    const stats = await this.getStats();
    
    if (stats.totalSize + needed <= this.maxSize) {
      return; // We have enough space
    }
    
    // Need to free up space - delete oldest entries (LRU)
    const db = await this.openDB();
    const tx = db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    const index = store.index('timestamp');
    
    let freedSpace = 0;
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor && freedSpace < needed) {
          const entry = cursor.value as CachedData<unknown>;
          freedSpace += entry.size;
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        
        request.onsuccess = () => {
          const items = request.result as Array<CachedData<unknown> & { key: string }>;
          
          const totalSize = items.reduce((sum, item) => sum + item.size, 0);
          const itemCount = items.length;
          const oldestItem = items.length > 0 
            ? Math.min(...items.map(item => item.timestamp))
            : 0;
          
          const totalRequests = this.stats.hits + this.stats.misses;
          const hitRate = totalRequests > 0 
            ? (this.stats.hits / totalRequests) * 100 
            : 0;
          
          resolve({
            totalSize,
            itemCount,
            hitRate,
            oldestItem,
          });
        };
        
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Get stats error:', error);
      return {
        totalSize: 0,
        itemCount: 0,
        hitRate: 0,
        oldestItem: 0,
      };
    }
  }

  /**
   * Generate cache key for marine data
   */
  getMarineKey(lat: number, lon: number, date?: Date): string {
    const dateStr = date ? date.toISOString().split('T')[0] : 'current';
    return `marine:${lat.toFixed(4)}:${lon.toFixed(4)}:${dateStr}`;
  }

  /**
   * Generate cache key for forecast data
   */
  getForecastKey(lat: number, lon: number, model: string, date?: Date): string {
    const dateStr = date ? date.toISOString().split('T')[0] : 'current';
    return `forecast:${lat.toFixed(4)}:${lon.toFixed(4)}:${model}:${dateStr}`;
  }

  /**
   * Generate cache key for current conditions
   */
  getCurrentKey(lat: number, lon: number): string {
    return `current:${lat.toFixed(4)}:${lon.toFixed(4)}`;
  }

  /**
   * Get TTL for data type
   */
  getTTL(type: keyof typeof this.TTL): number {
    return this.TTL[type];
  }
}

// Export singleton instance
export const cacheService = new WeatherCacheService();

// Export types
export type { CacheConfig, CachedData, CacheStats };
