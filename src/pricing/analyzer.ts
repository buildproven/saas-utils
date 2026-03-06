/**
 * SaaS Pricing Analyzer
 * Analyzes pricing configs to ensure target margins are achievable
 */

import type {
  PricingConfig,
  PricingAnalysis,
  TierAnalysis,
  VariableCost,
  Tier,
} from './types'

/** Default: 80% minimum, 90% target */
const DEFAULT_TARGET_MARGIN = 0.9
const MINIMUM_VIABLE_MARGIN = 0.8

/**
 * Analyze a single tier's pricing viability
 */
function analyzeTier(
  tier: Tier,
  costs: VariableCost[],
  fixedCostPerUser: number = 0
): TierAnalysis {
  const warnings: string[] = []
  const targetMargin =
    tier.targetMargin ?? (tier.price > 0 ? DEFAULT_TARGET_MARGIN : null)

  // Free tier special case
  if (tier.price === 0) {
    const maxCostForFree = 0.5 // Max $0.50/month for free users
    const maxUnitsPerCost: Record<string, number> = {}
    const recommendedLimits: Record<string, number> = {}

    // Distribute budget across costs
    const budgetPerCost = maxCostForFree / costs.length
    for (const cost of costs) {
      const maxUnits = Math.floor(budgetPerCost / cost.costPerUnit)
      maxUnitsPerCost[cost.name] = maxUnits
      recommendedLimits[cost.name] = maxUnits
    }

    if (costs.length > 0) {
      warnings.push(`Free tier should cost <$0.50/mo. Limit usage heavily.`)
    }

    return {
      name: tier.name,
      price: tier.price,
      targetMargin: null,
      maxVariableCost: maxCostForFree,
      maxUnitsPerCost,
      isViable: true,
      projectedMargin: null,
      warnings,
      recommendedLimits,
    }
  }

  // Paid tier analysis
  const maxVariableCost =
    tier.price * (1 - (targetMargin ?? DEFAULT_TARGET_MARGIN)) -
    fixedCostPerUser
  const maxUnitsPerCost: Record<string, number> = {}
  const recommendedLimits: Record<string, number> = {}

  if (maxVariableCost <= 0) {
    warnings.push(
      `Fixed costs ($${fixedCostPerUser}) exceed margin budget. Tier not viable.`
    )
    return {
      name: tier.name,
      price: tier.price,
      targetMargin,
      maxVariableCost: 0,
      maxUnitsPerCost: {},
      isViable: false,
      projectedMargin: null,
      warnings,
      recommendedLimits: {},
    }
  }

  // Calculate max units for each cost type
  // Assumes budget split equally across cost types (can be customized)
  const budgetPerCost = maxVariableCost / costs.length

  for (const cost of costs) {
    const maxUnits = Math.floor(budgetPerCost / cost.costPerUnit)
    maxUnitsPerCost[cost.name] = maxUnits
    recommendedLimits[cost.name] = maxUnits

    if (maxUnits < 100) {
      warnings.push(
        `Low limit for ${cost.name}: only ${maxUnits} ${cost.unit}s/month at ${targetMargin! * 100}% margin`
      )
    }
  }

  // Check against existing limits if defined
  let projectedCost = fixedCostPerUser
  if (tier.limits) {
    for (const cost of costs) {
      const limit = tier.limits[cost.name]
      if (limit !== undefined) {
        projectedCost += limit * cost.costPerUnit
        if (limit > maxUnitsPerCost[cost.name]) {
          warnings.push(
            `Limit for ${cost.name} (${limit}) exceeds max (${maxUnitsPerCost[cost.name]}) for target margin`
          )
        }
      }
    }
  }

  const projectedMargin =
    tier.price > 0 ? (tier.price - projectedCost) / tier.price : null
  const isViable =
    projectedMargin === null || projectedMargin >= MINIMUM_VIABLE_MARGIN

  if (projectedMargin !== null && projectedMargin < MINIMUM_VIABLE_MARGIN) {
    warnings.push(
      `Projected margin ${(projectedMargin * 100).toFixed(1)}% below minimum ${MINIMUM_VIABLE_MARGIN * 100}%`
    )
  }

  return {
    name: tier.name,
    price: tier.price,
    targetMargin,
    maxVariableCost,
    maxUnitsPerCost,
    isViable,
    projectedMargin,
    warnings,
    recommendedLimits,
  }
}

/**
 * Analyze full pricing config
 */
export function analyzePricing(config: PricingConfig): PricingAnalysis {
  const tierAnalyses = config.tiers.map(tier =>
    analyzeTier(tier, config.costs, config.fixedCostPerUser)
  )

  const warnings: string[] = []
  const allTiersViable = tierAnalyses.every(t => t.isViable)

  if (!allTiersViable) {
    warnings.push('One or more tiers are not viable at target margins')
  }

  // Check for free tier abuse potential
  const freeTier = tierAnalyses.find(t => t.price === 0)
  if (freeTier && Object.values(freeTier.maxUnitsPerCost).some(v => v > 1000)) {
    warnings.push('Free tier limits may be too generous - risk of abuse')
  }

  return {
    project: config.project,
    analyzedAt: new Date().toISOString(),
    defaultTargetMargin: DEFAULT_TARGET_MARGIN,
    tiers: tierAnalyses,
    allTiersViable,
    warnings,
  }
}

/**
 * Quick margin calculator
 */
export function calculateMargin(
  price: number,
  variableCost: number,
  fixedCost: number = 0
): number {
  if (price === 0) return 0
  return (price - variableCost - fixedCost) / price
}

/**
 * Calculate max units for a target margin
 */
export function maxUnitsForMargin(
  price: number,
  targetMargin: number,
  costPerUnit: number,
  fixedCost: number = 0
): number {
  const maxVariableCost = price * (1 - targetMargin) - fixedCost
  if (maxVariableCost <= 0) return 0
  return Math.floor(maxVariableCost / costPerUnit)
}

/**
 * Format analysis as readable table
 */
export function formatAnalysis(analysis: PricingAnalysis): string {
  const lines: string[] = [
    `\n📊 Pricing Analysis: ${analysis.project}`,
    `   Target Margin: ${analysis.defaultTargetMargin * 100}%`,
    `   Analyzed: ${analysis.analyzedAt}`,
    '',
  ]

  for (const tier of analysis.tiers) {
    const status = tier.isViable ? '✓' : '✗'
    lines.push(`${status} ${tier.name} - $${tier.price}/mo`)

    if (tier.price > 0) {
      lines.push(`   Max variable cost: $${tier.maxVariableCost.toFixed(2)}`)
      lines.push(
        `   Projected margin: ${tier.projectedMargin ? (tier.projectedMargin * 100).toFixed(1) : 'N/A'}%`
      )
    }

    lines.push(`   Recommended limits:`)
    for (const [name, limit] of Object.entries(tier.recommendedLimits)) {
      lines.push(`     - ${name}: ${limit.toLocaleString()}/month`)
    }

    if (tier.warnings.length > 0) {
      lines.push(`   ⚠️  Warnings:`)
      for (const warning of tier.warnings) {
        lines.push(`     - ${warning}`)
      }
    }
    lines.push('')
  }

  if (analysis.warnings.length > 0) {
    lines.push('⚠️  Overall Warnings:')
    for (const warning of analysis.warnings) {
      lines.push(`   - ${warning}`)
    }
  }

  lines.push(
    analysis.allTiersViable ? '✅ All tiers viable' : '❌ Issues detected'
  )

  return lines.join('\n')
}
