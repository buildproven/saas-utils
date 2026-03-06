/**
 * saas-utils/user-service tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create mock functions that persist across imports
const mockGet = vi.fn()
const mockSet = vi.fn()

// Mock must be defined before imports
vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    get = mockGet
    set = mockSet
  },
}))

import { createUserService, UserService } from './index'
import type { UserTier } from './index'

describe('UserService', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
    mockGet.mockReset()
    mockSet.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('createUserService', () => {
    it('should create a user service instance', () => {
      const service = createUserService()
      expect(service).toBeDefined()
      expect(typeof service.createUser).toBe('function')
      expect(typeof service.getUser).toBe('function')
    })

    it('should create service with custom config', () => {
      const service = createUserService({
        url: 'https://custom.upstash.io',
        token: 'custom-token',
        trialDays: 14,
        keyPrefix: 'custom:',
        module: 'CustomService',
      })
      expect(service).toBeDefined()
    })
  })

  describe('isAvailable', () => {
    it('should return true when Redis is configured', () => {
      const service = createUserService()
      expect(service.isAvailable()).toBe(true)
    })

    it('should return false when Redis is not configured', () => {
      vi.unstubAllEnvs()
      const service = createUserService({ url: undefined, token: undefined })
      expect(service.isAvailable()).toBe(false)
    })
  })

  describe('createUser', () => {
    it('should create a new user with trial tier', async () => {
      mockSet.mockResolvedValue('OK')
      const service = createUserService()

      const user = await service.createUser('user_123', 'test@example.com')

      expect(user).not.toBeNull()
      expect(user?.userId).toBe('user_123')
      expect(user?.email).toBe('test@example.com')
      expect(user?.tier).toBe('trial')
      expect(user?.usageThisMonth).toBe(0)
      expect(mockSet).toHaveBeenCalled()
    })

    it('should return null when service not available', async () => {
      vi.unstubAllEnvs()
      const service = createUserService({ url: undefined, token: undefined })

      const user = await service.createUser('user_123', 'test@example.com')

      expect(user).toBeNull()
    })

    it('should set trial expiration based on trialDays config', async () => {
      mockSet.mockResolvedValue('OK')
      const service = createUserService({ trialDays: 14 })

      const user = await service.createUser('user_123', 'test@example.com')

      expect(user).not.toBeNull()
      const trialExpires = new Date(user!.trialExpiresAt)
      const now = new Date()
      const daysDiff = Math.round(
        (trialExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      expect(daysDiff).toBe(14)
    })
  })

  describe('getUser', () => {
    it('should retrieve user by ID', async () => {
      const mockUser = {
        userId: 'user_123',
        email: 'test@example.com',
        tier: 'trial' as UserTier,
      }
      mockGet.mockResolvedValue(mockUser)
      const service = createUserService()

      const user = await service.getUser('user_123')

      expect(user).toEqual(mockUser)
    })

    it('should return null for non-existent user', async () => {
      mockGet.mockResolvedValue(null)
      const service = createUserService()

      const user = await service.getUser('nonexistent')

      expect(user).toBeNull()
    })
  })

  describe('getUserByEmail', () => {
    it('should retrieve user by email', async () => {
      const mockUser = {
        userId: 'user_123',
        email: 'test@example.com',
        tier: 'trial' as UserTier,
      }
      mockGet
        .mockResolvedValueOnce('user_123') // email lookup
        .mockResolvedValueOnce(mockUser) // user lookup

      const service = createUserService()
      const user = await service.getUserByEmail('test@example.com')

      expect(user?.userId).toBe('user_123')
    })
  })

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const existingUser = {
        userId: 'user_123',
        email: 'test@example.com',
        tier: 'trial' as UserTier,
        usageThisMonth: 5,
        updatedAt: new Date().toISOString(),
      }
      mockGet.mockResolvedValue(existingUser)
      mockSet.mockResolvedValue('OK')

      const service = createUserService()
      const updated = await service.updateUser('user_123', {
        usageThisMonth: 10,
      })

      expect(updated?.usageThisMonth).toBe(10)
      expect(updated?.userId).toBe('user_123')
    })

    it('should return null for non-existent user', async () => {
      mockGet.mockResolvedValue(null)
      const service = createUserService()

      const updated = await service.updateUser('nonexistent', {
        usageThisMonth: 10,
      })

      expect(updated).toBeNull()
    })
  })

  describe('upgradeToTier', () => {
    it('should upgrade user tier and set subscription info', async () => {
      const existingUser = {
        userId: 'user_123',
        email: 'test@example.com',
        tier: 'trial' as UserTier,
        updatedAt: new Date().toISOString(),
      }
      mockGet.mockResolvedValue(existingUser)
      mockSet.mockResolvedValue('OK')

      const service = createUserService()
      const upgraded = await service.upgradeToTier(
        'user_123',
        'pro',
        'cus_123',
        'sub_123'
      )

      expect(upgraded?.tier).toBe('pro')
      expect(upgraded?.stripeCustomerId).toBe('cus_123')
      expect(upgraded?.subscriptionId).toBe('sub_123')
      expect(upgraded?.subscriptionStatus).toBe('active')
    })
  })

  describe('downgradeToTrial', () => {
    it('should downgrade user to trial tier', async () => {
      const existingUser = {
        userId: 'user_123',
        tier: 'pro' as UserTier,
        updatedAt: new Date().toISOString(),
      }
      mockGet.mockResolvedValue(existingUser)
      mockSet.mockResolvedValue('OK')

      const service = createUserService()
      const downgraded = await service.downgradeToTrial('user_123')

      expect(downgraded?.tier).toBe('trial')
      expect(downgraded?.subscriptionStatus).toBe('canceled')
    })
  })

  describe('incrementUsage', () => {
    it('should increment usage count', async () => {
      const existingUser = {
        userId: 'user_123',
        usageThisMonth: 5,
        monthlyResetAt: new Date(Date.now() + 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mockGet.mockResolvedValue(existingUser)
      mockSet.mockResolvedValue('OK')

      const service = createUserService()
      const newCount = await service.incrementUsage('user_123')

      expect(newCount).toBe(6)
    })

    it('should reset count when past reset date', async () => {
      const existingUser = {
        userId: 'user_123',
        usageThisMonth: 100,
        monthlyResetAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mockGet.mockResolvedValue(existingUser)
      mockSet.mockResolvedValue('OK')

      const service = createUserService()
      const newCount = await service.incrementUsage('user_123')

      expect(newCount).toBe(1)
    })
  })

  describe('checkUsageLimit', () => {
    const limits: Record<UserTier, number> = {
      trial: 10,
      pro: 100,
      enterprise: 1000,
    }

    it('should return allowed: true when under limit', async () => {
      const existingUser = {
        userId: 'user_123',
        tier: 'trial' as UserTier,
        usageThisMonth: 5,
        trialExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      }
      mockGet.mockResolvedValue(existingUser)

      const service = createUserService()
      const check = await service.checkUsageLimit('user_123', limits)

      expect(check?.allowed).toBe(true)
      expect(check?.used).toBe(5)
      expect(check?.limit).toBe(10)
    })

    it('should return allowed: false when over limit', async () => {
      const existingUser = {
        userId: 'user_123',
        tier: 'trial' as UserTier,
        usageThisMonth: 15,
        trialExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      }
      mockGet.mockResolvedValue(existingUser)

      const service = createUserService()
      const check = await service.checkUsageLimit('user_123', limits)

      expect(check?.allowed).toBe(false)
    })

    it('should return allowed: false when trial expired', async () => {
      const existingUser = {
        userId: 'user_123',
        tier: 'trial' as UserTier,
        usageThisMonth: 0,
        trialExpiresAt: new Date(Date.now() - 86400000).toISOString(),
      }
      mockGet.mockResolvedValue(existingUser)

      const service = createUserService()
      const check = await service.checkUsageLimit('user_123', limits)

      expect(check?.allowed).toBe(false)
      expect(check?.trialExpired).toBe(true)
    })
  })

  describe('getOrCreateUser', () => {
    it('should return existing user', async () => {
      const existingUser = {
        userId: 'user_123',
        email: 'test@example.com',
        tier: 'pro' as UserTier,
      }
      mockGet.mockResolvedValue(existingUser)

      const service = createUserService()
      const user = await service.getOrCreateUser('user_123', 'test@example.com')

      expect(user?.tier).toBe('pro')
    })

    it('should create user when not exists', async () => {
      mockGet.mockResolvedValue(null)
      mockSet.mockResolvedValue('OK')

      const service = createUserService()
      const user = await service.getOrCreateUser('new_user', 'new@example.com')

      expect(user?.tier).toBe('trial')
      expect(user?.userId).toBe('new_user')
    })
  })

  describe('UserService export', () => {
    it('should export UserService class', () => {
      expect(UserService).toBeDefined()
    })
  })
})
