/**
 * saas-utils/user-service
 * Redis-based user service with tier management
 *
 * Usage:
 *   import { createUserService } from 'saas-utils/user-service'
 *
 *   const userService = createUserService({
 *     url: process.env.UPSTASH_REDIS_REST_URL,
 *     token: process.env.UPSTASH_REDIS_REST_TOKEN,
 *     trialDays: 7,
 *   })
 *
 *   const user = await userService.createUser('clerk_123', 'user@example.com')
 */

import { Redis } from '@upstash/redis'
import { logger } from '../logger'

export type UserTier = 'trial' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid'

export interface UserData {
  userId: string
  email: string
  tier: UserTier
  trialStartedAt: string
  trialExpiresAt: string
  stripeCustomerId?: string
  subscriptionId?: string
  subscriptionStatus?: SubscriptionStatus
  usageThisMonth: number
  monthlyResetAt: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

export interface UserServiceConfig {
  url?: string
  token?: string
  trialDays?: number
  keyPrefix?: string
  module?: string
}

export interface UsageCheck {
  allowed: boolean
  used: number
  limit: number
  tier: UserTier
  trialExpired?: boolean
}

export interface UserServiceClient {
  isAvailable(): boolean
  createUser(userId: string, email: string): Promise<UserData | null>
  getUser(userId: string): Promise<UserData | null>
  getUserByEmail(email: string): Promise<UserData | null>
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<UserData | null>
  updateUser(
    userId: string,
    updates: Partial<UserData>
  ): Promise<UserData | null>
  upgradeToTier(
    userId: string,
    tier: UserTier,
    stripeCustomerId: string,
    subscriptionId: string
  ): Promise<UserData | null>
  downgradeToTrial(userId: string): Promise<UserData | null>
  incrementUsage(userId: string, count?: number): Promise<number | null>
  checkUsageLimit(
    userId: string,
    limits: Record<UserTier, number>
  ): Promise<UsageCheck | null>
  getOrCreateUser(userId: string, email: string): Promise<UserData | null>
}

class UserService implements UserServiceClient {
  private client: Redis | null = null
  private isConfigured = false
  private trialDays: number
  private keyPrefix: string
  private module: string

  constructor(config?: UserServiceConfig) {
    const url = config?.url || process.env.UPSTASH_REDIS_REST_URL
    const token = config?.token || process.env.UPSTASH_REDIS_REST_TOKEN
    this.trialDays = config?.trialDays || 7
    this.keyPrefix = config?.keyPrefix || 'user:'
    this.module = config?.module || 'UserService'

    if (url && token) {
      try {
        this.client = new Redis({ url, token })
        this.isConfigured = true
      } catch (error) {
        logger.error('Failed to initialize UserService Redis client', error, {
          module: this.module,
        })
      }
    }
  }

  isAvailable(): boolean {
    return this.isConfigured && this.client !== null
  }

  async createUser(userId: string, email: string): Promise<UserData | null> {
    if (!this.isAvailable()) {
      logger.warn('UserService not available - Redis not configured', {
        module: this.module,
      })
      return null
    }

    const now = new Date()
    const trialExpires = new Date(now)
    trialExpires.setDate(trialExpires.getDate() + this.trialDays)

    const monthlyReset = new Date(now)
    monthlyReset.setMonth(monthlyReset.getMonth() + 1)
    monthlyReset.setDate(1)
    monthlyReset.setHours(0, 0, 0, 0)

    const userData: UserData = {
      userId,
      email,
      tier: 'trial',
      trialStartedAt: now.toISOString(),
      trialExpiresAt: trialExpires.toISOString(),
      usageThisMonth: 0,
      monthlyResetAt: monthlyReset.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    try {
      await this.client!.set(`${this.keyPrefix}${userId}`, userData)
      await this.client!.set(
        `${this.keyPrefix}email:${email.toLowerCase()}`,
        userId
      )

      logger.info('User created', {
        module: this.module,
        userId,
        tier: 'trial',
      })

      return userData
    } catch (error) {
      logger.error('Failed to create user', error, {
        module: this.module,
        userId,
      })
      return null
    }
  }

  async getUser(userId: string): Promise<UserData | null> {
    if (!this.isAvailable()) return null

    try {
      return await this.client!.get<UserData>(`${this.keyPrefix}${userId}`)
    } catch (error) {
      logger.error('Failed to get user', error, { module: this.module, userId })
      return null
    }
  }

  async getUserByEmail(email: string): Promise<UserData | null> {
    if (!this.isAvailable()) return null

    try {
      const userId = await this.client!.get<string>(
        `${this.keyPrefix}email:${email.toLowerCase()}`
      )
      if (!userId) return null
      return this.getUser(userId)
    } catch (error) {
      logger.error('Failed to get user by email', error, {
        module: this.module,
      })
      return null
    }
  }

  async getUserByStripeCustomerId(
    stripeCustomerId: string
  ): Promise<UserData | null> {
    if (!this.isAvailable()) return null

    try {
      const userId = await this.client!.get<string>(
        `${this.keyPrefix}stripe:${stripeCustomerId}`
      )
      if (!userId) return null
      return this.getUser(userId)
    } catch (error) {
      logger.error('Failed to get user by Stripe customer ID', error, {
        module: this.module,
      })
      return null
    }
  }

  async updateUser(
    userId: string,
    updates: Partial<UserData>
  ): Promise<UserData | null> {
    if (!this.isAvailable()) return null

    try {
      const existing = await this.getUser(userId)
      if (!existing) {
        logger.warn('User not found for update', {
          module: this.module,
          userId,
        })
        return null
      }

      const updated: UserData = {
        ...existing,
        ...updates,
        userId, // Never overwrite ID
        updatedAt: new Date().toISOString(),
      }

      await this.client!.set(`${this.keyPrefix}${userId}`, updated)

      if (
        updates.stripeCustomerId &&
        updates.stripeCustomerId !== existing.stripeCustomerId
      ) {
        await this.client!.set(
          `${this.keyPrefix}stripe:${updates.stripeCustomerId}`,
          userId
        )
      }

      return updated
    } catch (error) {
      logger.error('Failed to update user', error, {
        module: this.module,
        userId,
      })
      return null
    }
  }

  async upgradeToTier(
    userId: string,
    tier: UserTier,
    stripeCustomerId: string,
    subscriptionId: string
  ): Promise<UserData | null> {
    return this.updateUser(userId, {
      tier,
      stripeCustomerId,
      subscriptionId,
      subscriptionStatus: 'active',
    })
  }

  async downgradeToTrial(userId: string): Promise<UserData | null> {
    return this.updateUser(userId, {
      tier: 'trial',
      subscriptionStatus: 'canceled',
    })
  }

  async incrementUsage(
    userId: string,
    count: number = 1
  ): Promise<number | null> {
    if (!this.isAvailable()) return null

    try {
      const user = await this.getUser(userId)
      if (!user) return null

      const now = new Date()
      const resetDate = new Date(user.monthlyResetAt)

      let newCount = user.usageThisMonth + count
      let monthlyResetAt = user.monthlyResetAt

      if (now >= resetDate) {
        newCount = count
        const nextReset = new Date(now)
        nextReset.setMonth(nextReset.getMonth() + 1)
        nextReset.setDate(1)
        nextReset.setHours(0, 0, 0, 0)
        monthlyResetAt = nextReset.toISOString()
      }

      await this.updateUser(userId, {
        usageThisMonth: newCount,
        monthlyResetAt,
      })

      return newCount
    } catch (error) {
      logger.error('Failed to increment usage', error, {
        module: this.module,
        userId,
      })
      return null
    }
  }

  async checkUsageLimit(
    userId: string,
    limits: Record<UserTier, number>
  ): Promise<UsageCheck | null> {
    const user = await this.getUser(userId)
    if (!user) return null

    const limit = limits[user.tier]
    const now = new Date()
    const trialExpired =
      user.tier === 'trial' && now > new Date(user.trialExpiresAt)

    return {
      allowed: !trialExpired && user.usageThisMonth < limit,
      used: user.usageThisMonth,
      limit,
      tier: user.tier,
      trialExpired,
    }
  }

  async getOrCreateUser(
    userId: string,
    email: string
  ): Promise<UserData | null> {
    const existing = await this.getUser(userId)
    if (existing) return existing
    return this.createUser(userId, email)
  }
}

export function createUserService(
  config?: UserServiceConfig
): UserServiceClient {
  return new UserService(config)
}

export { UserService }
