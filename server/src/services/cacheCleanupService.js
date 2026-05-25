/**
 * Cache Cleanup Service
 * Prevents memory leaks by implementing cache size limits and TTL cleanup
 */

const logger = require('../utils/logger');

class CacheCleanupService {
  constructor() {
    this.cleanupIntervals = new Map();
    this.maxCacheSizes = {
      requestCache: 1000,
      proxyStats: 100,
      userAgents: 50,
      itemPrices: 5000
    };
  }

  /**
   * Initialize cache cleanup for a given cache object
   * @param {string} cacheName - Name identifier for the cache
   * @param {Map|Object} cacheObject - The cache to monitor
   * @param {Object} options - Cleanup options
   */
  initializeCacheCleanup(cacheName, cacheObject, options = {}) {
    const {
      maxSize = this.maxCacheSizes[cacheName] || 1000,
      ttl = 30 * 60 * 1000, // 30 minutes default
      cleanupInterval = 5 * 60 * 1000 // 5 minutes default
    } = options;

    // Clear any existing interval
    if (this.cleanupIntervals.has(cacheName)) {
      clearInterval(this.cleanupIntervals.get(cacheName));
    }

    const interval = setInterval(() => {
      this.cleanupCache(cacheObject, maxSize, ttl);
    }, cleanupInterval);

    this.cleanupIntervals.set(cacheName, interval);
    
    logger.info('CACHE', `Cache cleanup initialized for ${cacheName}: maxSize=${maxSize}, ttl=${ttl}ms`);
  }

  /**
   * Clean up a cache based on size and TTL
   * @param {Map|Object} cache - The cache to clean
   * @param {number} maxSize - Maximum number of entries
   * @param {number} ttl - Time to live in milliseconds
   */
  cleanupCache(cache, maxSize, ttl) {
    const now = Date.now();
    let entriesRemoved = 0;

    if (cache instanceof Map) {
      // Handle Map-based caches
      const entries = Array.from(cache.entries());
      
      // Remove expired entries
      for (const [key, value] of entries) {
        if (this.isExpired(value, now, ttl)) {
          cache.delete(key);
          entriesRemoved++;
        }
      }

      // Remove oldest entries if still over size limit
      if (cache.size > maxSize) {
        const sortedEntries = Array.from(cache.entries())
          .sort((a, b) => this.getTimestamp(a[1]) - this.getTimestamp(b[1]));
        
        const entriesToRemove = cache.size - maxSize;
        for (let i = 0; i < entriesToRemove; i++) {
          cache.delete(sortedEntries[i][0]);
          entriesRemoved++;
        }
      }
    } else {
      // Handle Object-based caches
      const keys = Object.keys(cache);
      
      // Remove expired entries
      for (const key of keys) {
        if (this.isExpired(cache[key], now, ttl)) {
          delete cache[key];
          entriesRemoved++;
        }
      }

      // Remove oldest entries if still over size limit
      const remainingKeys = Object.keys(cache);
      if (remainingKeys.length > maxSize) {
        const sortedKeys = remainingKeys
          .sort((a, b) => this.getTimestamp(cache[a]) - this.getTimestamp(cache[b]));
        
        const keysToRemove = remainingKeys.length - maxSize;
        for (let i = 0; i < keysToRemove; i++) {
          delete cache[sortedKeys[i]];
          entriesRemoved++;
        }
      }
    }

    if (entriesRemoved > 0) {
      logger.debug('CACHE', `Cache cleanup: removed ${entriesRemoved} entries`);
    }
  }

  /**
   * Check if a cache entry is expired
   * @param {*} entry - Cache entry
   * @param {number} now - Current timestamp
   * @param {number} ttl - Time to live
   * @returns {boolean}
   */
  isExpired(entry, now, ttl) {
    const timestamp = this.getTimestamp(entry);
    return timestamp && (now - timestamp > ttl);
  }

  /**
   * Extract timestamp from cache entry
   * @param {*} entry - Cache entry
   * @returns {number|null}
   */
  getTimestamp(entry) {
    if (!entry) return null;
    
    // Handle different cache entry formats
    if (typeof entry === 'object') {
      return entry.timestamp || entry.lastUsed || entry.createdAt || entry.updatedAt;
    }
    
    return null;
  }

  /**
   * Create a cache entry with timestamp
   * @param {*} data - Data to cache
   * @param {Object} metadata - Additional metadata
   * @returns {Object}
   */
  createCacheEntry(data, metadata = {}) {
    return {
      data,
      timestamp: Date.now(),
      ...metadata
    };
  }

  /**
   * Get data from cache entry
   * @param {*} entry - Cache entry
   * @returns {*}
   */
  getCacheData(entry) {
    if (typeof entry === 'object' && entry.data !== undefined) {
      return entry.data;
    }
    return entry;
  }

  /**
   * Clean up all cache intervals
   */
  shutdown() {
    for (const [cacheName, interval] of this.cleanupIntervals) {
      clearInterval(interval);
      logger.info('CACHE', `Cache cleanup stopped for ${cacheName}`);
    }
    this.cleanupIntervals.clear();
  }

  /**
   * Get cache statistics
   * @param {Map|Object} cache - Cache to analyze
   * @returns {Object}
   */
  getCacheStats(cache) {
    const size = cache instanceof Map ? cache.size : Object.keys(cache).length;
    const now = Date.now();
    let expiredCount = 0;
    
    if (cache instanceof Map) {
      for (const [, value] of cache) {
        if (this.isExpired(value, now, 30 * 60 * 1000)) {
          expiredCount++;
        }
      }
    } else {
      for (const key of Object.keys(cache)) {
        if (this.isExpired(cache[key], now, 30 * 60 * 1000)) {
          expiredCount++;
        }
      }
    }

    return {
      totalEntries: size,
      expiredEntries: expiredCount,
      activeEntries: size - expiredCount
    };
  }
}

module.exports = new CacheCleanupService();