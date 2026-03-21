/**
 * SaaS Pricing Module
 *
 * Analyze pricing tiers to ensure 80-90% margins across SaaS projects.
 *
 * @example
 * ```typescript
 * import { analyzePricing, formatAnalysis } from 'saas-utils/pricing'
 *
 * const analysis = analyzePricing({
 *   project: 'example-project',
 *   tiers: [
 *     { name: 'Free', price: 0 },
 *     { name: 'Pro', price: 29, targetMargin: 0.90 }
 *   ],
 *   costs: [
 *     { name: 'keyword_lookup', source: 'DataForSEO', costPerUnit: 0.002, unit: 'keyword' }
 *   ]
 * })
 *
 * console.log(formatAnalysis(analysis))
 * ```
 */

export * from './types';
export * from './analyzer';
