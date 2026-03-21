/**
 * saas-utils
 * Shared utilities, types, and constants for SaaS projects
 */

// Stripe utilities
export * from './stripe';

// Pricing analysis (80-90% margin enforcement)
export * from './pricing';

// Logger (structured logging with module context)
export * from './logger';

// Error handler (standard API error responses)
export * from './error-handler';

// Cache (Redis with graceful fallback)
export * from './cache';

// User service (Redis-based user/tier management)
export * from './user-service';

// Rate limiter (simple and advanced with deduplication)
export * from './rate-limiter';

// Product rate limiter (per-product usage limits)
export * from './product-rate-limiter';

// Encryption (AES-256-GCM token encryption)
export * from './encryption';

// Feature gate (subscription-based feature access control)
export * from './feature-gate';

// Environment resolver (1Password + multi-source API key resolution)
export * from './env-resolver';

// Quality standards (95% ship-ready, 98% production-perfect)
export * from './quality-standards';

// Branded types (CommitHash, SemanticVersion, Percentage)
export * from './branded-types';

// Agent configurations (reusable agent spawn configs)
export * from './agent-configs';

// Workflow patterns (git-sync, dev workflow, deployment logic)
export * from './workflow-patterns';

// Type guards (type-safe narrowing utilities)
export * from './type-guards';

// Project stage types (5-stage pipeline: validate → build → ship → launch → grow)
export type ProjectStage = 'validate' | 'build' | 'ship' | 'launch' | 'grow';
export type ProjectStatus = 'active' | 'blocked' | 'complete' | 'killed';
export type GateStatus = 'pass' | 'fail' | 'pending';

// Project model
export interface Project {
  slug: string;
  name: string;
  stage: ProjectStage;
  status: ProjectStatus;
  client: {
    name: string;
    email: string;
  };
  dates: {
    started: Date;
    validated?: Date;
    built?: Date;
    deployed?: Date;
    launched?: Date;
  };
  metrics: {
    mrr?: number;
    users?: number;
    validationScore?: number;
  };
  gates: {
    validation: GateStatus;
    build: GateStatus;
    deploy: GateStatus;
  };
}

// Validation report types
export interface ValidationReport {
  id: string;
  idea: string;
  demandScore: number;
  competitionScore: number;
  pricingScore: number;
  viabilityScore: number;
  recommendation: 'GO' | 'PIVOT' | 'NO-GO';
  createdAt: Date;
  details: {
    demand: string;
    competition: string;
    pricing: string;
    risks: string[];
  };
}

// Constants
export const COVERAGE_THRESHOLD_PAID = 80;
export const COVERAGE_THRESHOLD_FREE = 50;
export const VIABILITY_THRESHOLD_GO = 60;
export const VIABILITY_THRESHOLD_PIVOT = 40;

// Utility functions
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function calculateViabilityScore(
  demand: number,
  competition: number,
  pricing: number,
): number {
  return demand * 0.4 + competition * 0.3 + pricing * 0.3;
}

export function getRecommendation(score: number): 'GO' | 'PIVOT' | 'NO-GO' {
  if (score >= VIABILITY_THRESHOLD_GO) return 'GO';
  if (score >= VIABILITY_THRESHOLD_PIVOT) return 'PIVOT';
  return 'NO-GO';
}
