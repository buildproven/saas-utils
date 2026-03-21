/**
 * SaaS Pricing Types
 * Standard interfaces for pricing analysis across SaaS projects
 */

export interface VariableCost {
  /** Cost identifier */
  name: string;
  /** External service (e.g., "DataForSEO", "OpenAI", "AWS S3") */
  source: string;
  /** Cost per single unit */
  costPerUnit: number;
  /** Unit type (e.g., "keyword", "api_call", "gb_storage", "token") */
  unit: string;
}

export interface Tier {
  /** Tier name (e.g., "Free", "Pro", "Enterprise") */
  name: string;
  /** Monthly price in USD */
  price: number;
  /** Target margin (0.80 - 0.95). Null for free tier. */
  targetMargin?: number | null;
  /** Limits for this tier */
  limits?: Record<string, number>;
}

export interface PricingConfig {
  /** Project identifier */
  project: string;
  /** Available tiers */
  tiers: Tier[];
  /** Variable costs that scale with usage */
  costs: VariableCost[];
  /** Fixed costs per user per month (hosting, support allocation, etc.) */
  fixedCostPerUser?: number;
}

export interface TierAnalysis {
  /** Tier name */
  name: string;
  /** Monthly price */
  price: number;
  /** Target margin */
  targetMargin: number | null;
  /** Maximum allowable variable cost to hit target margin */
  maxVariableCost: number;
  /** Breakdown of max units per cost type */
  maxUnitsPerCost: Record<string, number>;
  /** Is this tier viable at target margin? */
  isViable: boolean;
  /** Calculated margin if limits are respected */
  projectedMargin: number | null;
  /** Warnings and recommendations */
  warnings: string[];
  /** Suggested limits to achieve target margin */
  recommendedLimits: Record<string, number>;
}

export interface PricingAnalysis {
  /** Project name */
  project: string;
  /** Analysis timestamp */
  analyzedAt: string;
  /** Default target margin used */
  defaultTargetMargin: number;
  /** Per-tier analysis */
  tiers: TierAnalysis[];
  /** Overall viability */
  allTiersViable: boolean;
  /** Summary warnings */
  warnings: string[];
}
