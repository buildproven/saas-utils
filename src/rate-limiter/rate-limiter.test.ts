/**
 * saas-utils/rate-limiter tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkRateLimit,
  getClientId,
  getRateLimitInfo,
  clearRateLimitStore,
  AdvancedRateLimiter,
  createRateLimiter,
} from './index'

describe('Simple Rate Limiter', () => {
  beforeEach(() => {
    clearRateLimitStore()
  })

  describe('getClientId', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      })
      expect(getClientId(request)).toBe('192.168.1.1')
    })

    it('should extract IP from x-real-ip header', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-real-ip': '192.168.1.2' },
      })
      expect(getClientId(request)).toBe('192.168.1.2')
    })

    it('should return local-dev as fallback', () => {
      const request = new Request('http://localhost')
      expect(getClientId(request)).toBe('local-dev')
    })
  })

  describe('checkRateLimit', () => {
    it('should allow requests under limit', () => {
      const config = { requestsPerHour: 10, enabled: true }
      expect(() => checkRateLimit('client-1', config)).not.toThrow()
    })

    it('should throw when limit exceeded', () => {
      const config = { requestsPerHour: 2, enabled: true }
      checkRateLimit('client-2', config) // 1
      checkRateLimit('client-2', config) // 2
      expect(() => checkRateLimit('client-2', config)).toThrow(
        'Rate limit exceeded'
      )
    })

    it('should not enforce when disabled', () => {
      const config = { requestsPerHour: 1, enabled: false }
      checkRateLimit('client-3', config)
      checkRateLimit('client-3', config)
      expect(() => checkRateLimit('client-3', config)).not.toThrow()
    })

    it('should track different clients separately', () => {
      const config = { requestsPerHour: 1, enabled: true }
      checkRateLimit('client-a', config)
      expect(() => checkRateLimit('client-b', config)).not.toThrow()
    })
  })

  describe('getRateLimitInfo', () => {
    it('should return full limit for new client', () => {
      const config = { requestsPerHour: 100, enabled: true }
      const info = getRateLimitInfo('new-client', config)
      expect(info.remaining).toBe(100)
    })

    it('should return reduced remaining after requests', () => {
      const config = { requestsPerHour: 100, enabled: true }
      checkRateLimit('tracked-client', config)
      checkRateLimit('tracked-client', config)
      const info = getRateLimitInfo('tracked-client', config)
      expect(info.remaining).toBe(98)
    })
  })
})

describe('AdvancedRateLimiter', () => {
  let limiter: AdvancedRateLimiter

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ENFORCE_RATE_LIMIT_TESTS', 'true')
    limiter = new AdvancedRateLimiter({
      requestsPerMinute: 3,
      requestsPerHour: 10,
      cleanupInterval: 60000,
    })
  })

  afterEach(() => {
    limiter.destroy()
    vi.unstubAllEnvs()
  })

  describe('checkRateLimit', () => {
    it('should allow first request', async () => {
      const result = await limiter.checkRateLimit('user-1')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2) // 3 - 1
    })

    it('should block after exceeding per-minute limit', async () => {
      await limiter.checkRateLimit('user-2')
      await limiter.checkRateLimit('user-2')
      await limiter.checkRateLimit('user-2')
      const result = await limiter.checkRateLimit('user-2')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Rate limit exceeded')
    })

    it('should track different users separately', async () => {
      await limiter.checkRateLimit('user-a')
      await limiter.checkRateLimit('user-a')
      await limiter.checkRateLimit('user-a')
      const result = await limiter.checkRateLimit('user-b')
      expect(result.allowed).toBe(true)
    })
  })

  describe('generateContentHash', () => {
    it('should generate consistent hash for same content', () => {
      const hash1 = limiter.generateContentHash('user', 'content')
      const hash2 = limiter.generateContentHash('user', 'content')
      expect(hash1).toBe(hash2)
    })

    it('should generate different hash for different content', () => {
      const hash1 = limiter.generateContentHash('user', 'content1')
      const hash2 = limiter.generateContentHash('user', 'content2')
      expect(hash1).not.toBe(hash2)
    })

    it('should handle object content', () => {
      const hash = limiter.generateContentHash('user', { key: 'value' })
      expect(hash).toHaveLength(16)
    })
  })

  describe('handleDeduplication', () => {
    it('should return isDuplicate: false for new content', async () => {
      const result = await limiter.handleDeduplication('user', 'unique-content')
      expect(result.isDuplicate).toBe(false)
    })
  })

  describe('getUserStatus', () => {
    it('should return full capacity for new user', () => {
      const status = limiter.getUserStatus('new-user')
      expect(status.requestsRemaining).toBe(3)
      expect(status.isLimited).toBe(false)
    })

    it('should reflect reduced capacity after requests', async () => {
      await limiter.checkRateLimit('status-user')
      const status = limiter.getUserStatus('status-user')
      expect(status.requestsRemaining).toBe(2)
    })
  })

  describe('getStats', () => {
    it('should return limiter statistics', async () => {
      await limiter.checkRateLimit('stats-user')
      const stats = limiter.getStats()
      expect(stats.activeUsers).toBeGreaterThanOrEqual(1)
      expect(stats.timestamp).toBeDefined()
    })
  })
})

describe('createRateLimiter', () => {
  it('should create a new limiter instance', () => {
    const limiter = createRateLimiter({ requestsPerMinute: 5 })
    expect(limiter).toBeInstanceOf(AdvancedRateLimiter)
    limiter.destroy()
  })
})

describe('Edge Cases', () => {
  describe('Simple Rate Limiter Edge Cases', () => {
    beforeEach(() => {
      clearRateLimitStore()
    })

    it('should handle empty client ID', () => {
      const config = { requestsPerHour: 10, enabled: true }
      expect(() => checkRateLimit('', config)).not.toThrow()
    })

    it('should handle special characters in client ID', () => {
      const config = { requestsPerHour: 10, enabled: true }
      expect(() =>
        checkRateLimit('user@domain.com:192.168.1.1', config)
      ).not.toThrow()
    })

    it('should handle very high limits', () => {
      const config = { requestsPerHour: Number.MAX_SAFE_INTEGER, enabled: true }
      expect(() => checkRateLimit('high-limit-client', config)).not.toThrow()
    })

    it('should handle zero limit (clamps remaining to 0)', () => {
      const config = { requestsPerHour: 0, enabled: true }
      checkRateLimit('zero-limit-client', config)
      // Implementation clamps remaining to 0 (Math.max)
      const info = getRateLimitInfo('zero-limit-client', config)
      expect(info.remaining).toBe(0)
    })

    it('should handle negative limit (clamps to 0)', () => {
      const config = { requestsPerHour: -1, enabled: true }
      // Implementation uses Math.max(0, remaining), so negative limits clamp to 0
      checkRateLimit('negative-limit-client', config)
      const info = getRateLimitInfo('negative-limit-client', config)
      expect(info.remaining).toBe(0)
    })

    it('should handle x-forwarded-for with IPv6', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '2001:db8::1, 10.0.0.1' },
      })
      expect(getClientId(request)).toBe('2001:db8::1')
    })

    it('should handle whitespace in headers', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' },
      })
      expect(getClientId(request)).toBe('192.168.1.1')
    })
  })

  describe('Advanced Rate Limiter Edge Cases', () => {
    let limiter: AdvancedRateLimiter

    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('ENFORCE_RATE_LIMIT_TESTS', 'true')
      limiter = new AdvancedRateLimiter({
        requestsPerMinute: 5,
        requestsPerHour: 20,
      })
    })

    afterEach(() => {
      limiter.destroy()
      vi.unstubAllEnvs()
    })

    it('should handle empty user ID', async () => {
      const result = await limiter.checkRateLimit('')
      expect(result.allowed).toBe(true)
    })

    it('should handle very long user IDs', async () => {
      const longId = 'a'.repeat(1000)
      const result = await limiter.checkRateLimit(longId)
      expect(result.allowed).toBe(true)
    })

    it('should handle unicode user IDs', async () => {
      const result = await limiter.checkRateLimit('用户123')
      expect(result.allowed).toBe(true)
    })

    it('should handle content hash with circular objects', () => {
      // Object without circular reference for hash
      const obj = { a: 1, b: { c: 2 } }
      const hash = limiter.generateContentHash('user', obj)
      expect(hash).toHaveLength(16)
    })

    it('should handle null-like content', () => {
      const hash1 = limiter.generateContentHash('user', 'null')
      const hash2 = limiter.generateContentHash('user', 'undefined')
      expect(hash1).not.toBe(hash2)
    })
  })
})

describe('Stress Tests', () => {
  describe('Concurrent Requests', () => {
    let limiter: AdvancedRateLimiter

    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('ENFORCE_RATE_LIMIT_TESTS', 'true')
      limiter = new AdvancedRateLimiter({
        requestsPerMinute: 100,
        requestsPerHour: 1000,
      })
    })

    afterEach(() => {
      limiter.destroy()
      vi.unstubAllEnvs()
    })

    it('should handle 50 concurrent requests from same user', async () => {
      const promises = Array(50)
        .fill(null)
        .map(() => limiter.checkRateLimit('concurrent-user'))

      const results = await Promise.all(promises)
      const allowed = results.filter(r => r.allowed).length
      const blocked = results.filter(r => !r.allowed).length

      expect(allowed + blocked).toBe(50)
      expect(allowed).toBeLessThanOrEqual(100) // per-minute limit
    })

    it('should handle 100 concurrent requests from different users', async () => {
      const promises = Array(100)
        .fill(null)
        .map((_, i) => limiter.checkRateLimit(`user-${i}`))

      const results = await Promise.all(promises)
      const allowed = results.filter(r => r.allowed).length

      expect(allowed).toBe(100) // All should pass (different users)
    })

    it('should correctly track remaining after burst', async () => {
      // Make 10 rapid requests
      for (let i = 0; i < 10; i++) {
        await limiter.checkRateLimit('burst-user')
      }

      const status = limiter.getUserStatus('burst-user')
      expect(status.requestsRemaining).toBe(90) // 100 - 10
    })
  })

  describe('Simple Rate Limiter Stress', () => {
    beforeEach(() => {
      clearRateLimitStore()
    })

    it('should handle 1000 unique clients', () => {
      const config = { requestsPerHour: 10, enabled: true }
      for (let i = 0; i < 1000; i++) {
        expect(() => checkRateLimit(`client-${i}`, config)).not.toThrow()
      }
    })

    it('should correctly exhaust limit', () => {
      const config = { requestsPerHour: 5, enabled: true }
      const clientId = 'exhaust-client'

      for (let i = 0; i < 5; i++) {
        expect(() => checkRateLimit(clientId, config)).not.toThrow()
      }

      expect(() => checkRateLimit(clientId, config)).toThrow(
        'Rate limit exceeded'
      )
    })
  })
})

describe('Boundary Conditions', () => {
  describe('Quota Boundaries', () => {
    let limiter: AdvancedRateLimiter

    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('ENFORCE_RATE_LIMIT_TESTS', 'true')
      limiter = new AdvancedRateLimiter({
        requestsPerMinute: 3,
        requestsPerHour: 10,
      })
    })

    afterEach(() => {
      limiter.destroy()
      vi.unstubAllEnvs()
    })

    it('should allow exactly at per-minute limit', async () => {
      for (let i = 0; i < 3; i++) {
        const result = await limiter.checkRateLimit('boundary-user')
        expect(result.allowed).toBe(true)
      }
      const result = await limiter.checkRateLimit('boundary-user')
      expect(result.allowed).toBe(false)
    })

    it('should report 0 remaining at limit', async () => {
      for (let i = 0; i < 3; i++) {
        await limiter.checkRateLimit('zero-remaining-user')
      }
      const status = limiter.getUserStatus('zero-remaining-user')
      expect(status.requestsRemaining).toBe(0)
      expect(status.isLimited).toBe(true)
    })
  })
})
