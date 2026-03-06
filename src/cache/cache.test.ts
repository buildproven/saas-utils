/**
 * saas-utils/cache tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCache, RedisCache } from './index'
import type { CacheClient } from './index'

// Mock @upstash/redis
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
  })),
}))

describe('Cache', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  describe('createCache', () => {
    it('should create a cache instance', () => {
      const cache = createCache()
      expect(cache).toBeDefined()
      expect(typeof cache.get).toBe('function')
      expect(typeof cache.set).toBe('function')
      expect(typeof cache.delete).toBe('function')
      expect(typeof cache.ping).toBe('function')
    })

    it('should create cache with custom config', () => {
      const cache = createCache({
        url: 'https://custom.upstash.io',
        token: 'custom-token',
        ttl: 3600,
        module: 'CustomCache',
      })
      expect(cache).toBeDefined()
    })
  })

  describe('isAvailable', () => {
    it('should return true when Redis is configured', () => {
      const cache = createCache()
      expect(cache.isAvailable()).toBe(true)
    })

    it('should return false when Redis is not configured', () => {
      vi.unstubAllEnvs()
      const cache = createCache({ url: undefined, token: undefined })
      expect(cache.isAvailable()).toBe(false)
    })
  })

  describe('cache operations when not available', () => {
    let cache: CacheClient

    beforeEach(() => {
      vi.unstubAllEnvs()
      cache = createCache({ url: undefined, token: undefined })
    })

    it('get should return null when not available', async () => {
      const result = await cache.get('key')
      expect(result).toBeNull()
    })

    it('set should return false when not available', async () => {
      const result = await cache.set('key', 'value')
      expect(result).toBe(false)
    })

    it('delete should return false when not available', async () => {
      const result = await cache.delete('key')
      expect(result).toBe(false)
    })

    it('ping should return false when not available', async () => {
      const result = await cache.ping()
      expect(result).toBe(false)
    })
  })

  describe('CacheClient interface', () => {
    it('should implement all required methods', () => {
      const cache = createCache()

      // Type checking - these should all exist
      expect(cache.isAvailable).toBeDefined()
      expect(cache.get).toBeDefined()
      expect(cache.set).toBeDefined()
      expect(cache.delete).toBeDefined()
      expect(cache.ping).toBeDefined()
    })
  })

  describe('RedisCache export', () => {
    it('should export RedisCache class', () => {
      expect(RedisCache).toBeDefined()
    })
  })
})
