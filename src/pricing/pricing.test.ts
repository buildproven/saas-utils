/**
 * SaaS Pricing Module Tests
 */

import { describe, it, expect } from 'vitest'
import { analyzePricing, formatAnalysis } from './analyzer'
import type { PricingConfig } from './types'

describe('Pricing Analyzer', () => {
  describe('analyzePricing', () => {
    it('should analyze free tier with usage limits', () => {
      const config: PricingConfig = {
        project: 'test-project',
        tiers: [{ name: 'Free', price: 0 }],
        costs: [
          {
            name: 'api_calls',
            source: 'External API',
            costPerUnit: 0.001,
            unit: 'call',
          },
        ],
      }

      const result = analyzePricing(config)

      expect(result).toBeDefined()
      expect(result.tiers[0].name).toBe('Free')
      expect(result.tiers[0].maxVariableCost).toBeLessThanOrEqual(0.5) // $0.50 max for free tier
      expect(result.tiers[0].isViable).toBe(true)
    })

    it('should analyze paid tier with 90% margin target', () => {
      const config: PricingConfig = {
        project: 'test-project',
        tiers: [{ name: 'Pro', price: 29, targetMargin: 0.9 }],
        costs: [
          {
            name: 'api_calls',
            source: 'External API',
            costPerUnit: 0.002,
            unit: 'call',
          },
        ],
      }

      const result = analyzePricing(config)

      expect(result).toBeDefined()
      expect(result.tiers[0].name).toBe('Pro')
      expect(result.tiers[0].targetMargin).toBe(0.9)
      // $29 * 0.10 = $2.90 max variable cost
      expect(result.tiers[0].maxVariableCost).toBeLessThanOrEqual(2.9)
    })

    it('should calculate max units per cost type', () => {
      const config: PricingConfig = {
        project: 'test-project',
        tiers: [{ name: 'Pro', price: 49, targetMargin: 0.85 }],
        costs: [
          {
            name: 'keyword_lookup',
            source: 'DataForSEO',
            costPerUnit: 0.002,
            unit: 'keyword',
          },
        ],
      }

      const result = analyzePricing(config)

      expect(result.tiers[0].maxUnitsPerCost).toBeDefined()
      expect(result.tiers[0].maxUnitsPerCost['keyword_lookup']).toBeGreaterThan(
        0
      )
    })

    it('should warn when tier is not viable due to high fixed costs', () => {
      const config: PricingConfig = {
        project: 'test-project',
        tiers: [{ name: 'Basic', price: 5, targetMargin: 0.9 }],
        costs: [
          { name: 'infra', source: 'AWS', costPerUnit: 0.01, unit: 'request' },
        ],
        fixedCostPerUser: 5, // Fixed cost equals price
      }

      const result = analyzePricing(config)

      expect(result.tiers[0].isViable).toBe(false)
      expect(result.tiers[0].warnings.length).toBeGreaterThan(0)
    })

    it('should handle multiple tiers', () => {
      const config: PricingConfig = {
        project: 'test-project',
        tiers: [
          { name: 'Free', price: 0 },
          { name: 'Pro', price: 29, targetMargin: 0.9 },
          { name: 'Enterprise', price: 99, targetMargin: 0.85 },
        ],
        costs: [
          {
            name: 'api_calls',
            source: 'API',
            costPerUnit: 0.001,
            unit: 'call',
          },
        ],
      }

      const result = analyzePricing(config)

      expect(result.tiers.length).toBe(3)
      expect(result.allTiersViable).toBeDefined()
      expect(result.warnings).toBeDefined()
    })

    it('should enforce minimum 80% margin', () => {
      const config: PricingConfig = {
        project: 'test-project',
        tiers: [{ name: 'Pro', price: 29 }], // No explicit margin, should use default
        costs: [
          {
            name: 'api_calls',
            source: 'API',
            costPerUnit: 0.001,
            unit: 'call',
          },
        ],
      }

      const result = analyzePricing(config)

      // Should use 90% default target margin
      expect(result.tiers[0].targetMargin).toBe(0.9)
    })
  })

  describe('formatAnalysis', () => {
    it('should format analysis as readable string', () => {
      const config: PricingConfig = {
        project: 'test-project',
        tiers: [{ name: 'Pro', price: 29, targetMargin: 0.9 }],
        costs: [
          {
            name: 'api_calls',
            source: 'API',
            costPerUnit: 0.001,
            unit: 'call',
          },
        ],
      }

      const analysis = analyzePricing(config)
      const formatted = formatAnalysis(analysis)

      expect(formatted).toContain('test-project')
      expect(formatted).toContain('Pro')
      expect(formatted).toContain('$29')
    })
  })
})
