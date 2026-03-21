/**
 * saas-utils/cache
 * Redis cache wrapper with graceful fallback
 *
 * Usage:
 *   import { createCache } from 'saas-utils/cache'
 *
 *   const cache = createCache({
 *     url: process.env.UPSTASH_REDIS_REST_URL,
 *     token: process.env.UPSTASH_REDIS_REST_TOKEN,
 *     ttl: 86400, // 1 day
 *   })
 *
 *   await cache.set('key', data)
 *   const cached = await cache.get<MyType>('key')
 */

import { Redis } from '@upstash/redis';
import { logger } from '../logger';

export interface CacheConfig {
  url?: string;
  token?: string;
  ttl?: number; // Default TTL in seconds
  module?: string; // Module name for logging
}

export interface CacheMetadata {
  cachedAt: string;
  ttl: number;
}

export interface CacheClient {
  isAvailable(): boolean;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T, ttl?: number): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  ping(): Promise<boolean>;
}

class RedisCache implements CacheClient {
  private client: Redis | null = null;
  private isConfigured = false;
  private defaultTTL: number;
  private module: string;

  constructor(config?: CacheConfig) {
    const url = config?.url || process.env.UPSTASH_REDIS_REST_URL;
    const token = config?.token || process.env.UPSTASH_REDIS_REST_TOKEN;
    this.defaultTTL = config?.ttl || 7 * 24 * 60 * 60; // 7 days
    this.module = config?.module || 'Cache';

    if (url && token) {
      try {
        this.client = new Redis({ url, token });
        this.isConfigured = true;
      } catch (error) {
        logger.error('Failed to initialize Redis client', error, {
          module: this.module,
        });
      }
    } else {
      logger.warn('Redis not configured. Cache operations will be skipped.', {
        module: this.module,
      });
    }
  }

  isAvailable(): boolean {
    return this.isConfigured && this.client !== null;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      return await this.client!.get<T>(key);
    } catch (error) {
      logger.error('Failed to get from cache', error, { module: this.module });
      return null;
    }
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      await this.client!.set(key, data, { ex: ttl || this.defaultTTL });
      return true;
    } catch (error) {
      logger.error('Failed to set cache', error, { module: this.module });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      await this.client!.del(key);
      return true;
    } catch (error) {
      logger.error('Failed to delete from cache', error, {
        module: this.module,
      });
      return false;
    }
  }

  async ping(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const result = await this.client!.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Ping failed', error, { module: this.module });
      return false;
    }
  }
}

/**
 * Create a new cache instance
 */
export function createCache(config?: CacheConfig): CacheClient {
  return new RedisCache(config);
}

export { RedisCache };
