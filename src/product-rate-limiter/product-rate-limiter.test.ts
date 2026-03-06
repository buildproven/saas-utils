import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  ProductRateLimiter,
  createProductRateLimiter,
  getProductRateLimiter,
  PRODUCT_LIMITS,
  getMaxApiCost,
} from './index'

describe('ProductRateLimiter', () => {
  let limiter: ProductRateLimiter

  beforeEach(() => {
    limiter = createProductRateLimiter()
  })

  afterEach(() => {
    limiter.destroy()
  })

  describe('PRODUCT_LIMITS', () => {
    it('should have correct validation limits', () => {
      expect(PRODUCT_LIMITS.validation.runsPerPurchase).toBe(3)
      expect(PRODUCT_LIMITS.validation.deepResearchPerMonth).toBe(5)
      // B-119: Updated pricing - $49 @ 20% margin for competitive positioning
      expect(PRODUCT_LIMITS.validation.price).toBe(49)
      expect(PRODUCT_LIMITS.validation.maxCostPercent).toBe(20)
    })

    it('should have correct starter kit limits', () => {
      expect(PRODUCT_LIMITS.starterKit.scaffoldsPerPurchase).toBe(1)
      expect(PRODUCT_LIMITS.starterKit.priceMin).toBe(199)
      expect(PRODUCT_LIMITS.starterKit.priceMax).toBe(349)
      expect(PRODUCT_LIMITS.starterKit.maxCostPercent).toBe(10)
    })
  })

  describe('getMaxApiCost', () => {
    it('should calculate 10% of price by default', () => {
      expect(getMaxApiCost(297)).toBeCloseTo(29.7, 2)
      expect(getMaxApiCost(199)).toBeCloseTo(19.9, 2)
    })

    it('should use custom percentage', () => {
      expect(getMaxApiCost(100, 15)).toBeCloseTo(15, 2)
      expect(getMaxApiCost(200, 5)).toBeCloseTo(10, 2)
    })
  })

  describe('registerPurchase', () => {
    it('should register a validation purchase with cost limits', () => {
      const purchase = limiter.registerPurchase(
        'user-1',
        'validation',
        'purchase-1'
      )

      expect(purchase.purchaseId).toBe('purchase-1')
      expect(purchase.productType).toBe('validation')
      expect(purchase.runsUsed).toBe(0)
      expect(purchase.maxRuns).toBe(PRODUCT_LIMITS.validation.runsPerPurchase)
      expect(purchase.costUsed).toBe(0)
      // B-119: $49 @ 20% = $9.80 max cost (competitive with ValidatorAI)
      expect(purchase.maxCost).toBeCloseTo(9.8, 2) // 20% of $49
      expect(purchase.price).toBe(49)
    })

    it('should register a starter kit purchase with cost limits', () => {
      const purchase = limiter.registerPurchase(
        'user-1',
        'starter-kit',
        'purchase-2'
      )

      expect(purchase.purchaseId).toBe('purchase-2')
      expect(purchase.productType).toBe('starter-kit')
      expect(purchase.runsUsed).toBe(0)
      expect(purchase.maxRuns).toBe(
        PRODUCT_LIMITS.starterKit.scaffoldsPerPurchase
      )
      expect(purchase.costUsed).toBe(0)
      expect(purchase.maxCost).toBeCloseTo(19.9, 2) // 10% of $199
      expect(purchase.price).toBe(199)
    })

    it('should use custom price for cost limit calculation', () => {
      const purchase = limiter.registerPurchase(
        'user-1',
        'starter-kit',
        'purchase-3',
        349
      )

      expect(purchase.price).toBe(349)
      expect(purchase.maxCost).toBe(34.9) // 10% of $349
    })
  })

  describe('checkValidationLimit', () => {
    it('should reject if no purchase exists', async () => {
      const result = await limiter.checkValidationLimit('user-no-purchase')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('No active validation purchase')
    })

    it('should allow if purchase has remaining runs', async () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')

      const result = await limiter.checkValidationLimit('user-1')

      expect(result.allowed).toBe(true)
      expect(result.usage.runsRemaining).toBe(2) // 3 - 1 = 2
    })

    it('should track usage correctly', async () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')

      // Use all 3 runs
      await limiter.checkValidationLimit('user-1')
      await limiter.checkValidationLimit('user-1')
      await limiter.checkValidationLimit('user-1')

      const result = await limiter.checkValidationLimit('user-1')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('No active validation purchase')
      expect(result.usage.runsRemaining).toBe(0)
    })

    it('should allow new runs after new purchase', async () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')

      // Exhaust first purchase
      await limiter.checkValidationLimit('user-1')
      await limiter.checkValidationLimit('user-1')
      await limiter.checkValidationLimit('user-1')

      // Register new purchase
      limiter.registerPurchase('user-1', 'validation', 'purchase-2')

      const result = await limiter.checkValidationLimit('user-1')

      expect(result.allowed).toBe(true)
      expect(result.usage.runsRemaining).toBe(2)
    })
  })

  describe('checkDeepResearchLimit', () => {
    it('should allow deep research within monthly limit', async () => {
      const result = await limiter.checkDeepResearchLimit('user-1')

      expect(result.allowed).toBe(true)
      expect(result.usage.runsRemaining).toBe(4) // 5 - 1 = 4
    })

    it('should track monthly usage correctly', async () => {
      // Use all 5 monthly allowance
      for (let i = 0; i < 5; i++) {
        await limiter.checkDeepResearchLimit('user-1')
      }

      const result = await limiter.checkDeepResearchLimit('user-1')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Monthly deep research limit reached')
      expect(result.usage.runsRemaining).toBe(0)
    })

    it('should track per-user usage separately', async () => {
      // User 1 uses 3
      for (let i = 0; i < 3; i++) {
        await limiter.checkDeepResearchLimit('user-1')
      }

      // User 2 should still have full quota
      const result = await limiter.checkDeepResearchLimit('user-2')

      expect(result.allowed).toBe(true)
      expect(result.usage.runsRemaining).toBe(4)
    })
  })

  describe('checkStarterKitLimit', () => {
    it('should reject if no purchase exists', async () => {
      const result = await limiter.checkStarterKitLimit('user-no-purchase')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('No active starter kit purchase')
    })

    it('should allow if purchase has remaining runs', async () => {
      limiter.registerPurchase('user-1', 'starter-kit', 'purchase-1')

      const result = await limiter.checkStarterKitLimit('user-1')

      expect(result.allowed).toBe(true)
      expect(result.usage.runsUsed).toBe(1)
    })

    it('should only allow one run per purchase', async () => {
      limiter.registerPurchase('user-1', 'starter-kit', 'purchase-1')

      // First run should succeed
      const first = await limiter.checkStarterKitLimit('user-1')
      expect(first.allowed).toBe(true)

      // Second run should fail
      const second = await limiter.checkStarterKitLimit('user-1')
      expect(second.allowed).toBe(false)
      expect(second.reason).toContain('No active starter kit purchase')
    })
  })

  describe('getValidationUsage', () => {
    it('should return correct usage for user with no purchases', () => {
      const usage = limiter.getValidationUsage('user-none')

      expect(usage.userId).toBe('user-none')
      expect(usage.productType).toBe('validation')
      expect(usage.runsUsed).toBe(0)
      expect(usage.runsRemaining).toBe(0)
      expect(usage.purchaseId).toBeUndefined()
    })

    it('should return correct usage for user with active purchase', () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')

      const usage = limiter.getValidationUsage('user-1')

      expect(usage.userId).toBe('user-1')
      expect(usage.runsUsed).toBe(0)
      expect(usage.runsRemaining).toBe(3)
      expect(usage.purchaseId).toBe('purchase-1')
    })

    it('should return correct usage after some runs used', async () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')
      await limiter.checkValidationLimit('user-1')
      await limiter.checkValidationLimit('user-1')

      const usage = limiter.getValidationUsage('user-1')

      expect(usage.runsUsed).toBe(2)
      expect(usage.runsRemaining).toBe(1)
    })
  })

  describe('getDeepResearchUsage', () => {
    it('should return correct usage for user with no usage', () => {
      const usage = limiter.getDeepResearchUsage('user-none')

      expect(usage.userId).toBe('user-none')
      expect(usage.productType).toBe('validation')
      expect(usage.runsUsed).toBe(0)
      expect(usage.runsRemaining).toBe(5)
      expect(usage.resetAt).toBeDefined()
    })

    it('should return correct usage after some runs used', async () => {
      await limiter.checkDeepResearchLimit('user-1')
      await limiter.checkDeepResearchLimit('user-1')

      const usage = limiter.getDeepResearchUsage('user-1')

      expect(usage.runsUsed).toBe(2)
      expect(usage.runsRemaining).toBe(3)
    })
  })

  describe('getStarterKitUsage', () => {
    it('should return correct usage for user with no purchases', () => {
      const usage = limiter.getStarterKitUsage('user-none')

      expect(usage.userId).toBe('user-none')
      expect(usage.productType).toBe('starter-kit')
      expect(usage.runsUsed).toBe(0)
      expect(usage.runsRemaining).toBe(0)
    })

    it('should return correct usage for user with active purchase', () => {
      limiter.registerPurchase('user-1', 'starter-kit', 'purchase-1')

      const usage = limiter.getStarterKitUsage('user-1')

      expect(usage.runsUsed).toBe(0)
      expect(usage.runsRemaining).toBe(1)
      expect(usage.purchaseId).toBe('purchase-1')
    })
  })

  describe('clearForTesting', () => {
    it('should clear all usage data', async () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')
      await limiter.checkValidationLimit('user-1')
      await limiter.checkDeepResearchLimit('user-1')

      limiter.clearForTesting()

      const validationUsage = limiter.getValidationUsage('user-1')
      const deepResearchUsage = limiter.getDeepResearchUsage('user-1')

      expect(validationUsage.runsUsed).toBe(0)
      expect(validationUsage.runsRemaining).toBe(0)
      expect(deepResearchUsage.runsUsed).toBe(0)
    })
  })

  describe('multiple purchases', () => {
    it('should handle multiple validation purchases correctly', async () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')
      limiter.registerPurchase('user-1', 'validation', 'purchase-2')

      // Should have 6 total runs (3 + 3)
      const usage = limiter.getValidationUsage('user-1')
      expect(usage.runsRemaining).toBe(6)

      // Use 4 runs (exhausts first purchase, uses 1 from second)
      for (let i = 0; i < 4; i++) {
        const result = await limiter.checkValidationLimit('user-1')
        expect(result.allowed).toBe(true)
      }

      const usageAfter = limiter.getValidationUsage('user-1')
      expect(usageAfter.runsUsed).toBe(4)
      expect(usageAfter.runsRemaining).toBe(2)
    })
  })

  describe('cost-based limiting (80% margin protection)', () => {
    // B-119: Validation pricing updated to $49 @ 20% = $9.80 max cost
    it('should reject if estimated cost exceeds remaining budget', async () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')
      // Max cost is $9.80 (20% of $49)

      // Try to run with estimated cost of $15 - should fail
      const result = await limiter.checkValidationLimit('user-1', 15)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('API cost limit reached')
      expect(result.reason).toContain('90% margin protection')
    })

    it('should allow if estimated cost is within budget', async () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')

      // Try to run with estimated cost of $5 - should pass
      const result = await limiter.checkValidationLimit('user-1', 5)

      expect(result.allowed).toBe(true)
    })

    it('should track cost usage correctly via recordCost', async () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')
      await limiter.checkValidationLimit('user-1')

      // Record $4 cost (within $9.80 limit)
      const recorded = limiter.recordCost('user-1', 'validation', 4)
      expect(recorded).toBe(true)

      const usage = limiter.getValidationUsage('user-1')
      expect(usage.costUsed).toBe(4)
      expect(usage.costRemaining).toBeCloseTo(5.8, 1) // 9.8 - 4
    })

    it('should reject recordCost if it would exceed limit', async () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')
      await limiter.checkValidationLimit('user-1')

      // Record cost that exceeds limit ($15 > $9.80)
      const recorded = limiter.recordCost('user-1', 'validation', 15)
      expect(recorded).toBe(false)

      const usage = limiter.getValidationUsage('user-1')
      expect(usage.costUsed).toBe(0)
    })

    it('should block validation when cost budget exhausted even with runs remaining', async () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')

      // First run succeeds
      const first = await limiter.checkValidationLimit('user-1')
      expect(first.allowed).toBe(true)

      // Record cost that nearly exhausts budget (leaving only $0.80)
      limiter.recordCost('user-1', 'validation', 9)

      // Second run with estimated cost of $3 should fail (only $0.80 remaining)
      const second = await limiter.checkValidationLimit('user-1', 3)
      expect(second.allowed).toBe(false)
      expect(second.reason).toContain('API cost limit reached')
    })

    it('should work with checkCostLimit for pre-flight checks', () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')

      // Check if $5 cost is allowed
      const check1 = limiter.checkCostLimit('user-1', 'validation', 5)
      expect(check1.allowed).toBe(true)
      expect(check1.costRemaining).toBeCloseTo(9.8, 2)
      expect(check1.maxCost).toBeCloseTo(9.8, 2)

      // Check if $15 cost is allowed
      const check2 = limiter.checkCostLimit('user-1', 'validation', 15)
      expect(check2.allowed).toBe(false)
      expect(check2.reason).toContain('exceeds remaining budget')
    })

    it('should include cost info in usage response', async () => {
      limiter.registerPurchase('user-1', 'validation', 'purchase-1')
      await limiter.checkValidationLimit('user-1')
      limiter.recordCost('user-1', 'validation', 3)

      const usage = limiter.getValidationUsage('user-1')
      expect(usage.costUsed).toBe(3)
      expect(usage.costRemaining).toBeCloseTo(6.8, 1) // 9.8 - 3
    })

    it('should apply cost limits to starter kit as well', async () => {
      limiter.registerPurchase('user-1', 'starter-kit', 'purchase-1')
      // Max cost is $19.90 (10% of $199)

      // Try with high estimated cost
      const result = await limiter.checkStarterKitLimit('user-1', 25)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('API cost limit reached')
    })
  })
})

describe('createProductRateLimiter', () => {
  it('should create a new instance', () => {
    const limiter = createProductRateLimiter()
    expect(limiter).toBeInstanceOf(ProductRateLimiter)
    limiter.destroy()
  })
})

describe('getProductRateLimiter', () => {
  it('should return singleton instance', () => {
    const limiter1 = getProductRateLimiter()
    const limiter2 = getProductRateLimiter()

    expect(limiter1).toBe(limiter2)
  })
})
