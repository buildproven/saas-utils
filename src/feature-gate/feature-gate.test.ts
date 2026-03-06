/**
 * saas-utils/feature-gate tests
 */

import { describe, it, expect } from 'vitest'
import { createFeatureGate, getNextResetDate, shouldResetQuota } from './index'

describe('Feature Gate', () => {
  const gate = createFeatureGate({
    tiers: {
      free: {
        features: ['basic', 'manual'] as const,
        limits: { requests: 10, storage: 100 },
      },
      pro: {
        features: ['basic', 'manual', 'advanced', 'api'] as const,
        limits: { requests: 1000, storage: 10000 },
      },
      enterprise: {
        features: [
          'basic',
          'manual',
          'advanced',
          'api',
          'sso',
          'audit',
        ] as const,
        limits: { requests: Infinity, storage: Infinity },
      },
    },
    upgradePath: {
      free: 'pro',
      pro: 'enterprise',
      enterprise: null,
    },
    upgradeMessages: {
      advanced: 'Upgrade to Pro for advanced features',
      sso: 'Contact sales for SSO integration',
    },
  })

  describe('checkFeature', () => {
    it('should allow features included in tier', () => {
      const result = gate.checkFeature('free', 'basic')
      expect(result.allowed).toBe(true)
      expect(result.currentTier).toBe('free')
    })

    it('should deny features not in tier', () => {
      const result = gate.checkFeature('free', 'advanced')
      expect(result.allowed).toBe(false)
      expect(result.requiredTier).toBe('pro')
    })

    it('should use custom upgrade message', () => {
      const result = gate.checkFeature('free', 'advanced')
      expect(result.message).toBe('Upgrade to Pro for advanced features')
    })

    it('should handle enterprise features', () => {
      const result = gate.checkFeature('pro', 'sso')
      expect(result.allowed).toBe(false)
      expect(result.requiredTier).toBe('enterprise')
    })
  })

  describe('canAccess', () => {
    it('should return true for allowed features', () => {
      expect(gate.canAccess('pro', 'advanced')).toBe(true)
    })

    it('should return false for denied features', () => {
      expect(gate.canAccess('free', 'advanced')).toBe(false)
    })
  })

  describe('checkQuota', () => {
    it('should allow usage under limit', () => {
      const result = gate.checkQuota('free', 'requests', 5)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(5)
      expect(result.limit).toBe(10)
    })

    it('should deny usage at limit', () => {
      const result = gate.checkQuota('free', 'requests', 10)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should handle unlimited tiers', () => {
      const result = gate.checkQuota('enterprise', 'requests', 1000000)
      expect(result.allowed).toBe(true)
      expect(result.unlimited).toBe(true)
      expect(result.remaining).toBe(Infinity)
    })

    it('should include reset date when provided', () => {
      const resetDate = new Date('2025-01-01')
      const result = gate.checkQuota('free', 'requests', 5, resetDate)
      expect(result.resetsAt).toEqual(resetDate)
    })
  })

  describe('getTierFeatures', () => {
    it('should return included and not included features', () => {
      const { included, notIncluded } = gate.getTierFeatures('pro')
      expect(included).toContain('advanced')
      expect(included).toContain('api')
      expect(notIncluded).toContain('sso')
      expect(notIncluded).toContain('audit')
    })
  })

  describe('getTierLimits', () => {
    it('should return tier limits', () => {
      const limits = gate.getTierLimits('free')
      expect(limits.requests).toBe(10)
      expect(limits.storage).toBe(100)
    })
  })

  describe('getUpgradePath', () => {
    it('should return next tier', () => {
      expect(gate.getUpgradePath('free')).toBe('pro')
      expect(gate.getUpgradePath('pro')).toBe('enterprise')
    })

    it('should return null for top tier', () => {
      expect(gate.getUpgradePath('enterprise')).toBe(null)
    })
  })

  describe('findMinimumTier', () => {
    it('should find minimum tier for feature', () => {
      expect(gate.findMinimumTier('basic')).toBe('free')
      expect(gate.findMinimumTier('advanced')).toBe('pro')
      expect(gate.findMinimumTier('sso')).toBe('enterprise')
    })
  })
})

describe('getNextResetDate', () => {
  it('should calculate next daily reset', () => {
    const now = new Date('2025-01-15T14:30:00Z')
    const next = getNextResetDate('daily', now)
    // Result is local midnight, check date is next day
    expect(next.getDate()).toBe(16)
    expect(next.getHours()).toBe(0)
    expect(next.getMinutes()).toBe(0)
  })

  it('should calculate next weekly reset (Sunday)', () => {
    const wednesday = new Date('2025-01-15T14:30:00Z') // Wednesday
    const next = getNextResetDate('weekly', wednesday)
    expect(next.getDay()).toBe(0) // Sunday
  })

  it('should calculate next monthly reset', () => {
    const now = new Date('2025-01-15T14:30:00Z')
    const next = getNextResetDate('monthly', now)
    expect(next.getMonth()).toBe(1) // February
    expect(next.getDate()).toBe(1)
  })
})

describe('shouldResetQuota', () => {
  it('should return true for daily reset after day change', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(shouldResetQuota(yesterday, 'daily')).toBe(true)
  })

  it('should return false for daily reset on same day', () => {
    const now = new Date()
    expect(shouldResetQuota(now, 'daily')).toBe(false)
  })

  it('should return true for weekly reset after 7 days', () => {
    const eightDaysAgo = new Date()
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)
    expect(shouldResetQuota(eightDaysAgo, 'weekly')).toBe(true)
  })

  it('should return false for weekly reset within 7 days', () => {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    expect(shouldResetQuota(threeDaysAgo, 'weekly')).toBe(false)
  })

  it('should return true for monthly reset after month change', () => {
    const lastMonth = new Date()
    // Set to 1st to avoid month rollover issues (e.g., Dec 31 - 1 month = Nov 31 → Dec 1)
    lastMonth.setDate(1)
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    expect(shouldResetQuota(lastMonth, 'monthly')).toBe(true)
  })
})

describe('Edge Cases', () => {
  describe('Invalid Tier Handling', () => {
    const gate = createFeatureGate({
      tiers: {
        basic: { features: ['read'] as const, limits: { requests: 10 } },
        pro: {
          features: ['read', 'write'] as const,
          limits: { requests: 100 },
        },
      },
    })

    it('should handle non-existent tier in checkFeature', () => {
      const result = gate.checkFeature('invalid' as 'basic', 'read')
      expect(result.allowed).toBe(false)
      expect(result.message).toContain('Invalid tier')
    })

    it('should handle non-existent tier in getTierFeatures', () => {
      const { included, notIncluded } = gate.getTierFeatures(
        'invalid' as 'basic'
      )
      expect(included).toHaveLength(0)
      expect(notIncluded).toContain('read')
    })

    it('should handle non-existent tier in getTierLimits', () => {
      const limits = gate.getTierLimits('invalid' as 'basic')
      expect(limits).toEqual({})
    })

    it('should handle non-existent tier in getUpgradePath', () => {
      const path = gate.getUpgradePath('invalid' as 'basic')
      expect(path).toBe(null)
    })

    it('should handle non-existent feature in findMinimumTier', () => {
      const tier = gate.findMinimumTier('nonexistent' as 'read')
      expect(tier).toBeUndefined()
    })
  })

  describe('Empty Configuration', () => {
    it('should handle gate with no tiers', () => {
      const emptyGate = createFeatureGate({
        tiers: {} as Record<string, { features: readonly string[] }>,
      })
      expect(emptyGate.canAccess('any' as never, 'any' as never)).toBe(false)
    })

    it('should handle tier with no features', () => {
      const noFeaturesGate = createFeatureGate({
        tiers: {
          empty: { features: [] as const },
        },
      })
      expect(noFeaturesGate.canAccess('empty', 'any' as never)).toBe(false)
    })

    it('should handle tier with no limits', () => {
      const noLimitsGate = createFeatureGate({
        tiers: {
          basic: { features: ['read'] as const },
        },
      })
      const result = noLimitsGate.checkQuota('basic', 'requests', 1000000)
      expect(result.allowed).toBe(true)
      expect(result.unlimited).toBe(true)
    })
  })

  describe('Quota Edge Cases', () => {
    const gate = createFeatureGate({
      tiers: {
        limited: {
          features: ['basic'] as const,
          limits: { requests: 10, zero: 0 },
        },
        unlimited: {
          features: ['basic', 'advanced'] as const,
          limits: { requests: Infinity },
        },
      },
    })

    it('should handle zero limit', () => {
      const result = gate.checkQuota('limited', 'zero', 0)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should handle usage exceeding limit', () => {
      const result = gate.checkQuota('limited', 'requests', 100)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.used).toBe(100)
    })

    it('should handle negative usage (edge case)', () => {
      const result = gate.checkQuota('limited', 'requests', -5)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(15) // 10 - (-5) = 15
    })

    it('should handle Infinity limit correctly', () => {
      const result = gate.checkQuota(
        'unlimited',
        'requests',
        Number.MAX_SAFE_INTEGER
      )
      expect(result.allowed).toBe(true)
      expect(result.unlimited).toBe(true)
    })

    it('should handle undefined limit key', () => {
      const result = gate.checkQuota('limited', 'nonexistent', 100)
      expect(result.allowed).toBe(true)
      expect(result.unlimited).toBe(true)
    })
  })

  describe('Date Edge Cases', () => {
    it('should handle year boundary for monthly reset', () => {
      const dec31 = new Date('2025-12-31T23:59:59Z')
      const next = getNextResetDate('monthly', dec31)
      expect(next.getFullYear()).toBe(2026)
      expect(next.getMonth()).toBe(0) // January
    })

    it('should handle leap year for daily reset', () => {
      const feb28 = new Date('2024-02-28T12:00:00Z') // 2024 is leap year
      const next = getNextResetDate('daily', feb28)
      expect(next.getDate()).toBe(29)
    })

    it('should handle Sunday for weekly reset', () => {
      const sunday = new Date('2025-01-19T12:00:00Z') // This is a Sunday
      const next = getNextResetDate('weekly', sunday)
      expect(next.getDay()).toBe(0) // Should be next Sunday
    })

    it('should handle year change for shouldResetQuota monthly', () => {
      const lastYear = new Date('2024-12-15T12:00:00Z')
      expect(shouldResetQuota(lastYear, 'monthly')).toBe(true)
    })
  })

  describe('Feature Inheritance Patterns', () => {
    const hierarchicalGate = createFeatureGate({
      tiers: {
        free: { features: ['basic'] as const },
        starter: { features: ['basic', 'export'] as const },
        pro: { features: ['basic', 'export', 'api', 'analytics'] as const },
        enterprise: {
          features: [
            'basic',
            'export',
            'api',
            'analytics',
            'sso',
            'audit',
          ] as const,
        },
      },
      upgradePath: {
        free: 'starter',
        starter: 'pro',
        pro: 'enterprise',
        enterprise: null,
      },
    })

    it('should correctly identify minimum tier for each feature', () => {
      expect(hierarchicalGate.findMinimumTier('basic')).toBe('free')
      expect(hierarchicalGate.findMinimumTier('export')).toBe('starter')
      expect(hierarchicalGate.findMinimumTier('api')).toBe('pro')
      expect(hierarchicalGate.findMinimumTier('sso')).toBe('enterprise')
    })

    it('should show complete upgrade path', () => {
      expect(hierarchicalGate.getUpgradePath('free')).toBe('starter')
      expect(hierarchicalGate.getUpgradePath('starter')).toBe('pro')
      expect(hierarchicalGate.getUpgradePath('pro')).toBe('enterprise')
      expect(hierarchicalGate.getUpgradePath('enterprise')).toBe(null)
    })

    it('should include all features for enterprise', () => {
      const { included, notIncluded } =
        hierarchicalGate.getTierFeatures('enterprise')
      expect(included).toHaveLength(6)
      expect(notIncluded).toHaveLength(0)
    })
  })
})

describe('Stress Tests', () => {
  it('should handle gate with many tiers', () => {
    const manyTiers: Record<string, { features: readonly string[] }> = {}
    for (let i = 0; i < 100; i++) {
      manyTiers[`tier-${i}`] = {
        features: [`feature-${i}`] as const,
      }
    }

    const largeGate = createFeatureGate({ tiers: manyTiers })
    expect(largeGate.canAccess('tier-50', 'feature-50' as string)).toBe(true)
    expect(largeGate.canAccess('tier-50', 'feature-99' as string)).toBe(false)
  })

  it('should handle tier with many features', () => {
    const features = Array(100)
      .fill(null)
      .map((_, i) => `feature-${i}`)

    const manyFeaturesGate = createFeatureGate({
      tiers: {
        mega: { features: features as unknown as readonly string[] },
      },
    })

    expect(manyFeaturesGate.canAccess('mega', 'feature-0')).toBe(true)
    expect(manyFeaturesGate.canAccess('mega', 'feature-99')).toBe(true)
  })

  it('should handle rapid feature checks', () => {
    const gate = createFeatureGate({
      tiers: {
        pro: { features: ['a', 'b', 'c'] as const },
      },
    })

    const start = Date.now()
    for (let i = 0; i < 10000; i++) {
      gate.canAccess('pro', 'a')
    }
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(1000) // Should complete in under 1 second
  })
})
