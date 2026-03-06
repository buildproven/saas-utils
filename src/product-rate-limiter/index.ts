/**
 * saas-utils/product-rate-limiter
 * Product-specific rate limiting for SaaS projects products
 *
 * Enforces usage limits based on product purchases:
 * - Validation product: 3 validations per purchase, 5 deep research per month
 * - Starter Kit: 1 scaffold per purchase
 *
 * Usage:
 *   import { ProductRateLimiter, createProductRateLimiter } from 'saas-utils/product-rate-limiter'
 *   const limiter = createProductRateLimiter()
 *   await limiter.checkValidationLimit(userId)
 *   await limiter.checkDeepResearchLimit(userId)
 *   await limiter.checkStarterKitLimit(userId)
 */

import { AdvancedRateLimiter, createRateLimiter } from '../rate-limiter'

// Product limits (mirrored from @saas/agents/config/models)
// Keeping separate to avoid circular dependency
// B-119: Pricing update - competitive positioning
// Validator: $297 → $49 (market: $0-49, ValidatorAI $49)
// Starter Kit: $199/$349 (competitive with ShipFast $199, Supastarter $349)
export const PRODUCT_LIMITS = {
  validation: {
    runsPerPurchase: 3,
    deepResearchPerMonth: 5,
    price: 49, // Competitive with ValidatorAI ($49)
    maxCostPercent: 20, // Higher cost % allowed at lower price point for 80% margin
  },
  starterKit: {
    scaffoldsPerPurchase: 1,
    priceMin: 199,
    priceMax: 349,
    maxCostPercent: 10, // 90% margin floor
  },
} as const

// Calculate max allowed API cost based on price and margin floor
export function getMaxApiCost(
  price: number,
  maxCostPercent: number = 10
): number {
  return price * (maxCostPercent / 100)
}

export interface ProductUsage {
  userId: string
  productType: 'validation' | 'starter-kit'
  purchaseId?: string
  runsUsed: number
  runsRemaining: number
  resetAt?: string
  purchasedAt?: string
  costUsed?: number
  costRemaining?: number
}

export interface ProductLimitResult {
  allowed: boolean
  reason?: string
  usage: ProductUsage
}

export interface UserPurchase {
  purchaseId: string
  productType: 'validation' | 'starter-kit'
  purchasedAt: Date
  runsUsed: number
  maxRuns: number
  costUsed: number
  maxCost: number
  price: number
}

/**
 * In-memory store for user purchases and usage
 * In production, this would be backed by Redis or a database
 */
class UsageStore {
  private purchases = new Map<string, UserPurchase[]>()
  private monthlyUsage = new Map<string, Map<string, number>>()

  addPurchase(userId: string, purchase: UserPurchase): void {
    const userPurchases = this.purchases.get(userId) || []
    userPurchases.push(purchase)
    this.purchases.set(userId, userPurchases)
  }

  getPurchases(
    userId: string,
    productType: 'validation' | 'starter-kit'
  ): UserPurchase[] {
    const userPurchases = this.purchases.get(userId) || []
    return userPurchases.filter(p => p.productType === productType)
  }

  getActivePurchase(
    userId: string,
    productType: 'validation' | 'starter-kit'
  ): UserPurchase | undefined {
    const purchases = this.getPurchases(userId, productType)
    // Find purchase with remaining runs AND remaining cost budget
    return purchases.find(p => p.runsUsed < p.maxRuns && p.costUsed < p.maxCost)
  }

  incrementUsage(
    userId: string,
    purchaseId: string,
    cost: number = 0
  ): boolean {
    const userPurchases = this.purchases.get(userId)
    if (!userPurchases) return false

    const purchase = userPurchases.find(p => p.purchaseId === purchaseId)
    if (!purchase || purchase.runsUsed >= purchase.maxRuns) return false

    // Check if adding this cost would exceed limit
    if (purchase.costUsed + cost > purchase.maxCost) return false

    purchase.runsUsed++
    purchase.costUsed += cost
    return true
  }

  addCost(userId: string, purchaseId: string, cost: number): boolean {
    const userPurchases = this.purchases.get(userId)
    if (!userPurchases) return false

    const purchase = userPurchases.find(p => p.purchaseId === purchaseId)
    if (!purchase) return false

    // Check if adding this cost would exceed limit
    if (purchase.costUsed + cost > purchase.maxCost) return false

    purchase.costUsed += cost
    return true
  }

  getCostRemaining(userId: string, purchaseId: string): number {
    const userPurchases = this.purchases.get(userId)
    if (!userPurchases) return 0

    const purchase = userPurchases.find(p => p.purchaseId === purchaseId)
    if (!purchase) return 0

    return Math.max(0, purchase.maxCost - purchase.costUsed)
  }

  getMonthlyUsage(userId: string, usageType: string): number {
    const monthKey = this.getCurrentMonthKey()
    const userMonthly = this.monthlyUsage.get(userId)
    if (!userMonthly) return 0
    return userMonthly.get(`${monthKey}:${usageType}`) || 0
  }

  incrementMonthlyUsage(userId: string, usageType: string): void {
    const monthKey = this.getCurrentMonthKey()
    let userMonthly = this.monthlyUsage.get(userId)
    if (!userMonthly) {
      userMonthly = new Map()
      this.monthlyUsage.set(userId, userMonthly)
    }
    const key = `${monthKey}:${usageType}`
    const current = userMonthly.get(key) || 0
    userMonthly.set(key, current + 1)
  }

  private getCurrentMonthKey(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  // For testing
  clear(): void {
    this.purchases.clear()
    this.monthlyUsage.clear()
  }
}

export class ProductRateLimiter {
  private usageStore: UsageStore
  private rateLimiter: AdvancedRateLimiter

  constructor() {
    this.usageStore = new UsageStore()
    this.rateLimiter = createRateLimiter({
      requestsPerMinute: 10,
      requestsPerHour: 100,
      namespace: 'product-limiter',
    })
  }

  /**
   * Register a new purchase for a user
   */
  registerPurchase(
    userId: string,
    productType: 'validation' | 'starter-kit',
    purchaseId: string,
    price?: number
  ): UserPurchase {
    const maxRuns =
      productType === 'validation'
        ? PRODUCT_LIMITS.validation.runsPerPurchase
        : PRODUCT_LIMITS.starterKit.scaffoldsPerPurchase

    const productPrice =
      price ??
      (productType === 'validation'
        ? PRODUCT_LIMITS.validation.price
        : PRODUCT_LIMITS.starterKit.priceMin)

    const maxCostPercent =
      productType === 'validation'
        ? PRODUCT_LIMITS.validation.maxCostPercent
        : PRODUCT_LIMITS.starterKit.maxCostPercent

    const purchase: UserPurchase = {
      purchaseId,
      productType,
      purchasedAt: new Date(),
      runsUsed: 0,
      maxRuns,
      costUsed: 0,
      maxCost: getMaxApiCost(productPrice, maxCostPercent),
      price: productPrice,
    }

    this.usageStore.addPurchase(userId, purchase)
    return purchase
  }

  /**
   * Check if user can run a validation (with optional estimated cost)
   */
  async checkValidationLimit(
    userId: string,
    estimatedCost: number = 0
  ): Promise<ProductLimitResult> {
    // First check rate limit (prevent rapid-fire requests)
    const rateResult = await this.rateLimiter.checkRateLimit(userId)
    if (!rateResult.allowed) {
      return {
        allowed: false,
        reason: rateResult.reason || 'Rate limit exceeded',
        usage: this.getValidationUsage(userId),
      }
    }

    // Check if user has an active purchase with remaining runs AND cost budget
    const activePurchase = this.usageStore.getActivePurchase(
      userId,
      'validation'
    )

    if (!activePurchase) {
      return {
        allowed: false,
        reason:
          'No active validation purchase or cost limit reached. Please purchase a validation package.',
        usage: this.getValidationUsage(userId),
      }
    }

    // Check if estimated cost would exceed remaining budget
    const costRemaining = activePurchase.maxCost - activePurchase.costUsed
    if (estimatedCost > 0 && estimatedCost > costRemaining) {
      return {
        allowed: false,
        reason: `API cost limit reached. Remaining budget: $${costRemaining.toFixed(2)}. Estimated cost: $${estimatedCost.toFixed(2)}. (90% margin protection)`,
        usage: this.getValidationUsage(userId),
      }
    }

    // Increment usage (cost will be added later via recordCost)
    this.usageStore.incrementUsage(userId, activePurchase.purchaseId, 0)

    return {
      allowed: true,
      usage: this.getValidationUsage(userId),
    }
  }

  /**
   * Record actual API cost after a run completes
   */
  recordCost(
    userId: string,
    productType: 'validation' | 'starter-kit',
    cost: number
  ): boolean {
    const activePurchase = this.usageStore
      .getPurchases(userId, productType)
      .find(p => p.runsUsed > 0 && p.costUsed < p.maxCost)

    if (!activePurchase) return false

    return this.usageStore.addCost(userId, activePurchase.purchaseId, cost)
  }

  /**
   * Check if cost would exceed limit (pre-flight check)
   */
  checkCostLimit(
    userId: string,
    productType: 'validation' | 'starter-kit',
    estimatedCost: number
  ): {
    allowed: boolean
    costRemaining: number
    maxCost: number
    reason?: string
  } {
    const activePurchase = this.usageStore.getActivePurchase(
      userId,
      productType
    )

    if (!activePurchase) {
      return {
        allowed: false,
        costRemaining: 0,
        maxCost: 0,
        reason: 'No active purchase found',
      }
    }

    const costRemaining = activePurchase.maxCost - activePurchase.costUsed

    if (estimatedCost > costRemaining) {
      return {
        allowed: false,
        costRemaining,
        maxCost: activePurchase.maxCost,
        reason: `Cost $${estimatedCost.toFixed(2)} exceeds remaining budget $${costRemaining.toFixed(2)} (90% margin protection)`,
      }
    }

    return {
      allowed: true,
      costRemaining,
      maxCost: activePurchase.maxCost,
    }
  }

  /**
   * Check if user can run deep research
   */
  async checkDeepResearchLimit(userId: string): Promise<ProductLimitResult> {
    // Check rate limit
    const rateResult = await this.rateLimiter.checkRateLimit(userId)
    if (!rateResult.allowed) {
      return {
        allowed: false,
        reason: rateResult.reason || 'Rate limit exceeded',
        usage: this.getDeepResearchUsage(userId),
      }
    }

    // Check monthly limit
    const monthlyUsage = this.usageStore.getMonthlyUsage(
      userId,
      'deep-research'
    )
    const limit = PRODUCT_LIMITS.validation.deepResearchPerMonth

    if (monthlyUsage >= limit) {
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      nextMonth.setDate(1)
      nextMonth.setHours(0, 0, 0, 0)

      return {
        allowed: false,
        reason: `Monthly deep research limit reached (${limit}/month). Resets on ${nextMonth.toDateString()}.`,
        usage: this.getDeepResearchUsage(userId),
      }
    }

    // Increment monthly usage
    this.usageStore.incrementMonthlyUsage(userId, 'deep-research')

    return {
      allowed: true,
      usage: this.getDeepResearchUsage(userId),
    }
  }

  /**
   * Check if user can run starter kit scaffold (with optional estimated cost)
   */
  async checkStarterKitLimit(
    userId: string,
    estimatedCost: number = 0
  ): Promise<ProductLimitResult> {
    // Check rate limit
    const rateResult = await this.rateLimiter.checkRateLimit(userId)
    if (!rateResult.allowed) {
      return {
        allowed: false,
        reason: rateResult.reason || 'Rate limit exceeded',
        usage: this.getStarterKitUsage(userId),
      }
    }

    // Check if user has an active purchase with remaining runs AND cost budget
    const activePurchase = this.usageStore.getActivePurchase(
      userId,
      'starter-kit'
    )

    if (!activePurchase) {
      return {
        allowed: false,
        reason:
          'No active starter kit purchase or cost limit reached. Please purchase a starter kit.',
        usage: this.getStarterKitUsage(userId),
      }
    }

    // Check if estimated cost would exceed remaining budget
    const costRemaining = activePurchase.maxCost - activePurchase.costUsed
    if (estimatedCost > 0 && estimatedCost > costRemaining) {
      return {
        allowed: false,
        reason: `API cost limit reached. Remaining budget: $${costRemaining.toFixed(2)}. Estimated cost: $${estimatedCost.toFixed(2)}. (90% margin protection)`,
        usage: this.getStarterKitUsage(userId),
      }
    }

    // Increment usage
    this.usageStore.incrementUsage(userId, activePurchase.purchaseId, 0)

    return {
      allowed: true,
      usage: this.getStarterKitUsage(userId),
    }
  }

  /**
   * Get validation usage for a user
   */
  getValidationUsage(userId: string): ProductUsage {
    const purchases = this.usageStore.getPurchases(userId, 'validation')
    const totalRuns =
      PRODUCT_LIMITS.validation.runsPerPurchase * purchases.length
    const usedRuns = purchases.reduce((sum, p) => sum + p.runsUsed, 0)
    const totalCost = purchases.reduce((sum, p) => sum + p.costUsed, 0)
    const totalMaxCost = purchases.reduce((sum, p) => sum + p.maxCost, 0)
    const activePurchase = purchases.find(
      p => p.runsUsed < p.maxRuns && p.costUsed < p.maxCost
    )

    return {
      userId,
      productType: 'validation',
      purchaseId: activePurchase?.purchaseId,
      runsUsed: usedRuns,
      runsRemaining: Math.max(0, totalRuns - usedRuns),
      purchasedAt: activePurchase?.purchasedAt.toISOString(),
      costUsed: totalCost,
      costRemaining: Math.max(0, totalMaxCost - totalCost),
    }
  }

  /**
   * Get deep research usage for a user
   */
  getDeepResearchUsage(userId: string): ProductUsage {
    const monthlyUsage = this.usageStore.getMonthlyUsage(
      userId,
      'deep-research'
    )
    const limit = PRODUCT_LIMITS.validation.deepResearchPerMonth

    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    nextMonth.setDate(1)
    nextMonth.setHours(0, 0, 0, 0)

    return {
      userId,
      productType: 'validation',
      runsUsed: monthlyUsage,
      runsRemaining: Math.max(0, limit - monthlyUsage),
      resetAt: nextMonth.toISOString(),
    }
  }

  /**
   * Get starter kit usage for a user
   */
  getStarterKitUsage(userId: string): ProductUsage {
    const purchases = this.usageStore.getPurchases(userId, 'starter-kit')
    const totalRuns =
      PRODUCT_LIMITS.starterKit.scaffoldsPerPurchase * purchases.length
    const usedRuns = purchases.reduce((sum, p) => sum + p.runsUsed, 0)
    const totalCost = purchases.reduce((sum, p) => sum + p.costUsed, 0)
    const totalMaxCost = purchases.reduce((sum, p) => sum + p.maxCost, 0)
    const activePurchase = purchases.find(
      p => p.runsUsed < p.maxRuns && p.costUsed < p.maxCost
    )

    return {
      userId,
      productType: 'starter-kit',
      purchaseId: activePurchase?.purchaseId,
      runsUsed: usedRuns,
      runsRemaining: Math.max(0, totalRuns - usedRuns),
      purchasedAt: activePurchase?.purchasedAt.toISOString(),
      costUsed: totalCost,
      costRemaining: Math.max(0, totalMaxCost - totalCost),
    }
  }

  /**
   * Clear all usage data (for testing)
   */
  clearForTesting(): void {
    this.usageStore.clear()
  }

  /**
   * Destroy the limiter (cleanup)
   */
  destroy(): void {
    this.rateLimiter.destroy()
  }
}

/**
 * Create a new product rate limiter instance
 */
export function createProductRateLimiter(): ProductRateLimiter {
  return new ProductRateLimiter()
}

// Singleton instance for convenience
let defaultLimiter: ProductRateLimiter | null = null

export function getProductRateLimiter(): ProductRateLimiter {
  if (!defaultLimiter) {
    defaultLimiter = createProductRateLimiter()
  }
  return defaultLimiter
}
