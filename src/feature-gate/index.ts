/**
 * saas-utils/feature-gate
 * Subscription-based feature access control
 *
 * Generic feature gating for SaaS applications.
 * Works with any tier/plan system and feature set.
 *
 * Usage:
 *   import { createFeatureGate } from 'saas-utils/feature-gate'
 *
 *   const gate = createFeatureGate({
 *     tiers: {
 *       free: { features: ['basic'], limits: { requests: 10 } },
 *       pro: { features: ['basic', 'advanced'], limits: { requests: 100 } },
 *     },
 *     upgradePath: { free: 'pro', pro: null },
 *   })
 *
 *   const check = gate.checkFeature('pro', 'advanced')
 *   const quota = gate.checkQuota('free', 'requests', 5)
 */

export interface TierConfig<F extends string = string> {
  features: readonly F[];
  limits?: Record<string, number>;
}

export interface FeatureGateConfig<T extends string = string, F extends string = string> {
  tiers: Record<T, TierConfig<F>>;
  upgradePath?: Record<T, T | null>;
  upgradeMessages?: Record<F, string>;
}

export interface FeatureCheckResult<T extends string = string> {
  allowed: boolean;
  currentTier: T;
  requiredTier?: T;
  message?: string;
}

export interface QuotaCheckResult<T extends string = string> {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  tier: T;
  unlimited: boolean;
  resetsAt?: Date;
}

export interface FeatureGate<T extends string = string, F extends string = string> {
  /**
   * Check if a tier has access to a feature
   */
  checkFeature(tier: T, feature: F): FeatureCheckResult<T>;

  /**
   * Check if a tier can access a feature (boolean shorthand)
   */
  canAccess(tier: T, feature: F): boolean;

  /**
   * Check quota/limit usage
   */
  checkQuota(tier: T, limitKey: string, used: number, resetsAt?: Date): QuotaCheckResult<T>;

  /**
   * Get all features for a tier
   */
  getTierFeatures(tier: T): { included: F[]; notIncluded: F[] };

  /**
   * Get limits for a tier
   */
  getTierLimits(tier: T): Record<string, number>;

  /**
   * Get upgrade path for a tier
   */
  getUpgradePath(tier: T): T | null;

  /**
   * Get upgrade message for a feature
   */
  getUpgradeMessage(feature: F, currentTier: T): string;

  /**
   * Find minimum tier that has a feature
   */
  findMinimumTier(feature: F): T | undefined;
}

/**
 * Create a feature gate instance
 */
export function createFeatureGate<T extends string, F extends string>(
  config: FeatureGateConfig<T, F>,
): FeatureGate<T, F> {
  const {
    tiers,
    upgradePath = {} as Record<T, T | null>,
    upgradeMessages = {} as Record<F, string>,
  } = config;

  // Get all features across all tiers
  const allFeatures = Array.from(
    new Set(Object.values(tiers).flatMap((t) => (t as TierConfig<F>).features)),
  ) as F[];

  // Build reverse map: feature -> minimum tier
  const featureToMinTier = new Map<F, T>();
  const tierOrder = Object.keys(tiers) as T[];

  for (const feature of allFeatures) {
    for (const tier of tierOrder) {
      if (tiers[tier].features.includes(feature)) {
        featureToMinTier.set(feature, tier);
        break;
      }
    }
  }

  return {
    checkFeature(tier: T, feature: F): FeatureCheckResult<T> {
      const tierConfig = tiers[tier];
      if (!tierConfig) {
        return {
          allowed: false,
          currentTier: tier,
          message: `Invalid tier: ${tier}`,
        };
      }

      const allowed = tierConfig.features.includes(feature);
      if (allowed) {
        return { allowed: true, currentTier: tier };
      }

      const requiredTier = featureToMinTier.get(feature);
      const message =
        upgradeMessages[feature] || `Upgrade to ${requiredTier || 'a paid plan'} for this feature`;

      return {
        allowed: false,
        currentTier: tier,
        requiredTier,
        message,
      };
    },

    canAccess(tier: T, feature: F): boolean {
      const tierConfig = tiers[tier];
      return tierConfig?.features.includes(feature) ?? false;
    },

    checkQuota(tier: T, limitKey: string, used: number, resetsAt?: Date): QuotaCheckResult<T> {
      const tierConfig = tiers[tier];
      const limit = tierConfig?.limits?.[limitKey];

      // No limit defined = unlimited
      if (limit === undefined || limit === Infinity) {
        return {
          allowed: true,
          used,
          limit: Infinity,
          remaining: Infinity,
          tier,
          unlimited: true,
          resetsAt,
        };
      }

      const remaining = Math.max(0, limit - used);

      return {
        allowed: remaining > 0,
        used,
        limit,
        remaining,
        tier,
        unlimited: false,
        resetsAt,
      };
    },

    getTierFeatures(tier: T): { included: F[]; notIncluded: F[] } {
      const tierConfig = tiers[tier];
      if (!tierConfig) {
        return { included: [], notIncluded: [...allFeatures] };
      }

      const included = [...tierConfig.features] as F[];
      const notIncluded = allFeatures.filter((f) => !included.includes(f));

      return { included, notIncluded };
    },

    getTierLimits(tier: T): Record<string, number> {
      return { ...tiers[tier]?.limits };
    },

    getUpgradePath(tier: T): T | null {
      return upgradePath[tier] ?? null;
    },

    getUpgradeMessage(feature: F, currentTier: T): string {
      // currentTier available for custom upgrade messages
      void currentTier;
      if (upgradeMessages[feature]) {
        return upgradeMessages[feature];
      }
      const requiredTier = featureToMinTier.get(feature);
      return `Upgrade to ${requiredTier || 'a paid plan'} to access this feature`;
    },

    findMinimumTier(feature: F): T | undefined {
      return featureToMinTier.get(feature);
    },
  };
}

/**
 * Helper to calculate next reset date
 */
export function getNextResetDate(
  period: 'daily' | 'weekly' | 'monthly',
  fromDate: Date = new Date(),
): Date {
  const next = new Date(fromDate);

  switch (period) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      break;
    case 'weekly': {
      const daysUntilSunday = (7 - next.getDay()) % 7 || 7;
      next.setDate(next.getDate() + daysUntilSunday);
      next.setHours(0, 0, 0, 0);
      break;
    }
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(0, 0, 0, 0);
      break;
  }

  return next;
}

/**
 * Check if a reset period has elapsed
 */
export function shouldResetQuota(
  lastResetAt: Date,
  period: 'daily' | 'weekly' | 'monthly',
): boolean {
  const now = new Date();
  const last = new Date(lastResetAt);

  switch (period) {
    case 'daily':
      return now.toDateString() !== last.toDateString();
    case 'weekly': {
      const daysSince = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince >= 7;
    }
    case 'monthly':
      return now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear();
  }
}
