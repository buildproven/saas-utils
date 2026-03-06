/**
 * Quality Standards for SaaS Pipeline
 *
 * Single source of truth for quality levels, exit criteria, and agent configurations.
 * Used by both BS commands (interactive) and CLI (automated).
 *
 * @module saas-utils/quality-standards
 */

/**
 * Exit criteria for quality checks
 */
export interface ExitCriteria {
  /** Test requirements */
  tests: {
    /** Percentage of tests that must pass */
    passing: number
    /** Minimum code coverage percentage */
    coverage?: number
  }

  /** ESLint requirements */
  eslint: {
    /** Maximum allowed errors */
    errors: number
    /** Maximum allowed warnings */
    warnings: number
  }

  /** TypeScript requirements */
  typescript: {
    /** Must use strict mode */
    strict: boolean
    /** Maximum allowed 'any' types */
    anyCount: number
  }

  /** Build requirements */
  build: {
    /** Build must succeed */
    success: boolean
  }

  /** Security requirements (optional for 95%) */
  security?: {
    /** Maximum high/critical vulnerabilities */
    highCritical: number
    /** Secrets must not be exposed */
    secretsExposed?: boolean
  }

  /** Accessibility requirements (optional for 95%) */
  accessibility?: {
    /** WCAG AA compliance required */
    wcagAA: boolean
    /** axe-core must pass all routes */
    axeCoreClean?: boolean
  }

  /** Performance requirements (optional for 95%) */
  performance?: {
    /** Minimum Lighthouse score */
    lighthouse: number
    /** N+1 queries allowed */
    n1Queries?: number
    /** Memory leaks allowed */
    memoryLeaks?: number
  }

  /** Architecture requirements (optional for 95%) */
  architecture?: {
    /** Architecture review must pass */
    reviewed: boolean
  }
}

/**
 * Agent configuration for quality checks
 */
export interface AgentConfig {
  /** Agent identifier from pr-review-toolkit or other sources */
  id: string
  /** Display name for the agent */
  name: string
  /** Description of what the agent does */
  description: string
  /** Whether this agent is required for the quality level */
  required: boolean
  /** Estimated time in minutes */
  estimatedTime?: number
}

/**
 * Quality standard definition
 */
export interface QualityStandard {
  /** Quality level percentage (95, 98, etc.) */
  level: number
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Exit criteria that must be met */
  exitCriteria: ExitCriteria
  /** Agents to spawn for this quality level */
  agents: readonly AgentConfig[]
  /** Estimated total time */
  estimatedTime: string
  /** Use cases for this quality level */
  useCases: readonly string[]
}

/**
 * Factory function to create ExitCriteria with validation
 */
export function createExitCriteria(
  criteria: ExitCriteria
): Readonly<ExitCriteria> {
  // Validate required fields
  if (criteria.tests.passing < 0 || criteria.tests.passing > 100) {
    throw new Error('tests.passing must be between 0 and 100')
  }
  if (
    criteria.tests.coverage !== undefined &&
    (criteria.tests.coverage < 0 || criteria.tests.coverage > 100)
  ) {
    throw new Error('tests.coverage must be between 0 and 100')
  }
  if (criteria.eslint.errors < 0) {
    throw new Error('eslint.errors must be >= 0')
  }
  if (criteria.eslint.warnings < 0) {
    throw new Error('eslint.warnings must be >= 0')
  }
  if (criteria.typescript.anyCount < 0) {
    throw new Error('typescript.anyCount must be >= 0')
  }

  return Object.freeze({
    tests: Object.freeze({ ...criteria.tests }),
    eslint: Object.freeze({ ...criteria.eslint }),
    typescript: Object.freeze({ ...criteria.typescript }),
    build: Object.freeze({ ...criteria.build }),
    ...(criteria.security && {
      security: Object.freeze({ ...criteria.security }),
    }),
    ...(criteria.accessibility && {
      accessibility: Object.freeze({ ...criteria.accessibility }),
    }),
    ...(criteria.performance && {
      performance: Object.freeze({ ...criteria.performance }),
    }),
    ...(criteria.architecture && {
      architecture: Object.freeze({ ...criteria.architecture }),
    }),
  })
}

/**
 * Factory function to create AgentConfig with validation
 */
export function createAgentConfig(config: AgentConfig): Readonly<AgentConfig> {
  if (!config.id || config.id.trim().length === 0) {
    throw new Error('id is required')
  }
  if (!config.name || config.name.trim().length === 0) {
    throw new Error('name is required')
  }
  if (!config.description || config.description.trim().length === 0) {
    throw new Error('description is required')
  }
  if (config.estimatedTime !== undefined && config.estimatedTime < 0) {
    throw new Error('estimatedTime must be >= 0')
  }

  return Object.freeze({ ...config })
}

/**
 * Factory function to create QualityStandard with validation
 */
export function createQualityStandard(
  standard: QualityStandard
): Readonly<QualityStandard> {
  if (standard.level < 0 || standard.level > 100) {
    throw new Error('level must be between 0 and 100')
  }
  if (!standard.name || standard.name.trim().length === 0) {
    throw new Error('name is required')
  }
  if (!standard.description || standard.description.trim().length === 0) {
    throw new Error('description is required')
  }
  if (!standard.agents || standard.agents.length === 0) {
    throw new Error('at least one agent is required')
  }

  // Validate exit criteria
  createExitCriteria(standard.exitCriteria)

  // Validate all agents
  standard.agents.forEach(createAgentConfig)

  return Object.freeze({
    ...standard,
    exitCriteria: createExitCriteria(standard.exitCriteria),
    agents: Object.freeze(standard.agents.map(createAgentConfig)),
    useCases: Object.freeze([...standard.useCases]),
  })
}

/**
 * 95% Ship-Ready Standard
 *
 * Fast autonomous loop for internal tools, staging, and MVP testing.
 * Focus: Core quality (tests, lint, types, build)
 * Time: 30-60 minutes
 */
export const SHIP_READY: QualityStandard = Object.freeze({
  level: 95,
  name: '95% Ship-Ready',
  description: 'Fast autonomous loop for staging and internal tools',
  exitCriteria: Object.freeze({
    tests: Object.freeze({
      passing: 100,
      coverage: 80,
    }),
    eslint: Object.freeze({
      errors: 0,
      warnings: 0,
    }),
    typescript: Object.freeze({
      strict: true,
      anyCount: 0,
    }),
    build: Object.freeze({
      success: true,
    }),
  }),
  agents: Object.freeze([
    Object.freeze({
      id: 'pr-review-toolkit:code-reviewer',
      name: 'Code Reviewer',
      description: 'Review code quality, patterns, best practices',
      required: true,
      estimatedTime: 10,
    }),
    Object.freeze({
      id: 'pr-review-toolkit:silent-failure-hunter',
      name: 'Silent Failure Hunter',
      description: 'Find empty catches, swallowed errors, unhandled promises',
      required: true,
      estimatedTime: 8,
    }),
    Object.freeze({
      id: 'pr-review-toolkit:type-design-analyzer',
      name: 'Type Design Analyzer',
      description: 'Analyze type safety, no any abuse, proper types',
      required: true,
      estimatedTime: 12,
    }),
  ]),
  estimatedTime: '30-60 min',
  useCases: Object.freeze([
    'Internal tools',
    'Staging deployments',
    'MVP testing',
    'Quick iterations',
    'Time-sensitive shipping',
  ]),
})

/**
 * 98% Production-Perfect Standard
 *
 * Comprehensive autonomous loop for customer-facing production launches.
 * Focus: Core quality + security + a11y + performance + architecture
 * Time: 1-3 hours
 */
export const PRODUCTION_PERFECT: QualityStandard = Object.freeze({
  level: 98,
  name: '98% Production-Perfect',
  description: 'Comprehensive autonomous loop for production launches',
  exitCriteria: Object.freeze({
    ...SHIP_READY.exitCriteria,
    security: Object.freeze({
      highCritical: 0,
      secretsExposed: false,
    }),
    accessibility: Object.freeze({
      wcagAA: true,
      axeCoreClean: true,
    }),
    performance: Object.freeze({
      lighthouse: 90,
      n1Queries: 0,
      memoryLeaks: 0,
    }),
    architecture: Object.freeze({
      reviewed: true,
    }),
  }),
  agents: Object.freeze([
    ...SHIP_READY.agents,
    Object.freeze({
      id: 'pr-review-toolkit:code-simplifier',
      name: 'Code Simplifier',
      description: 'Reduce code complexity and improve maintainability',
      required: true,
      estimatedTime: 15,
    }),
    Object.freeze({
      id: 'security-auditor',
      name: 'Security Auditor',
      description: 'OWASP top 10, secrets scanning, dependency audit',
      required: true,
      estimatedTime: 20,
    }),
    Object.freeze({
      id: 'accessibility-tester',
      name: 'Accessibility Tester',
      description: 'WCAG AA compliance, axe-core, keyboard navigation',
      required: true,
      estimatedTime: 25,
    }),
    Object.freeze({
      id: 'performance-engineer',
      name: 'Performance Engineer',
      description: 'Lighthouse optimization, bundle size, Core Web Vitals',
      required: true,
      estimatedTime: 30,
    }),
    Object.freeze({
      id: 'architect-reviewer',
      name: 'Architect Reviewer',
      description: 'Architecture patterns, scalability, tech debt',
      required: true,
      estimatedTime: 15,
    }),
    Object.freeze({
      id: 'refactoring-specialist',
      name: 'Performance Reviewer',
      description: 'N+1 queries, memory leaks, algorithm complexity',
      required: false,
      estimatedTime: 20,
    }),
    Object.freeze({
      id: 'general-purpose',
      name: 'Adversarial Reviewer',
      description: 'SQL injection, XSS, command injection, race conditions',
      required: false,
      estimatedTime: 25,
    }),
  ]),
  estimatedTime: '1-3 hours',
  useCases: Object.freeze([
    'First production launch',
    'Customer-facing releases',
    'Compliance requirements',
    'Critical business features',
    'Zero-risk deployments',
  ]),
})

/**
 * All quality standards
 */
export const QUALITY_STANDARDS = {
  SHIP_READY,
  PRODUCTION_PERFECT,
} as const

/**
 * Get quality standard by level
 */
export function getQualityStandard(level: 95 | 98): QualityStandard {
  switch (level) {
    case 95:
      return SHIP_READY
    case 98:
      return PRODUCTION_PERFECT
    default:
      throw new Error(`Unknown quality level: ${level}`)
  }
}

/**
 * Results from quality checks
 */
export interface QualityResults {
  tests?: { passing: number; total: number; coverage?: number }
  eslint?: { errors: number; warnings: number }
  typescript?: { strict: boolean; anyCount: number; errors: number }
  build?: { success: boolean }
  security?: { highCritical: number; secretsExposed?: boolean }
  accessibility?: { wcagAA: boolean; axeCoreClean?: boolean }
  performance?: { lighthouse: number; n1Queries?: number; memoryLeaks?: number }
  architecture?: { reviewed: boolean }
}

/**
 * Check if exit criteria are met
 */
export function checkExitCriteria(
  criteria: ExitCriteria,
  results: QualityResults
): { passed: boolean; failures: string[] } {
  const failures: string[] = []

  checkTests(criteria, results, failures)
  checkEslint(criteria, results, failures)
  checkTypescript(criteria, results, failures)
  checkBuild(results, failures)
  checkSecurity(criteria, results, failures)
  checkAccessibility(criteria, results, failures)
  checkPerformance(criteria, results, failures)
  checkArchitecture(criteria, results, failures)

  return { passed: failures.length === 0, failures }
}

function checkTests(
  criteria: ExitCriteria,
  results: QualityResults,
  failures: string[]
): void {
  if (!results.tests) return

  if (results.tests.total === 0) {
    failures.push('Tests: no tests found (need 100%)')
    return
  }

  const passingPercent = (results.tests.passing / results.tests.total) * 100
  if (passingPercent < criteria.tests.passing) {
    failures.push(
      `Tests: ${passingPercent.toFixed(0)}% passing (need ${criteria.tests.passing}%)`
    )
  }

  if (
    criteria.tests.coverage !== undefined &&
    results.tests.coverage !== undefined &&
    results.tests.coverage < criteria.tests.coverage
  ) {
    failures.push(
      `Coverage: ${results.tests.coverage}% (need ${criteria.tests.coverage}%)`
    )
  }
}

function checkEslint(
  criteria: ExitCriteria,
  results: QualityResults,
  failures: string[]
): void {
  if (!results.eslint) return

  if (results.eslint.errors > criteria.eslint.errors) {
    failures.push(`ESLint: ${results.eslint.errors} errors (need 0)`)
  }
  if (results.eslint.warnings > criteria.eslint.warnings) {
    failures.push(`ESLint: ${results.eslint.warnings} warnings (need 0)`)
  }
}

function checkTypescript(
  criteria: ExitCriteria,
  results: QualityResults,
  failures: string[]
): void {
  if (!results.typescript) return

  if (criteria.typescript.strict && !results.typescript.strict) {
    failures.push('TypeScript: strict mode not enabled')
  }
  if (results.typescript.anyCount > criteria.typescript.anyCount) {
    failures.push(
      `TypeScript: ${results.typescript.anyCount} 'any' types (need 0)`
    )
  }
  if (results.typescript.errors > 0) {
    failures.push(`TypeScript: ${results.typescript.errors} errors`)
  }
}

function checkBuild(results: QualityResults, failures: string[]): void {
  if (results.build && !results.build.success) {
    failures.push('Build: failed')
  }
}

function checkSecurity(
  criteria: ExitCriteria,
  results: QualityResults,
  failures: string[]
): void {
  if (!criteria.security || !results.security) return

  if (results.security.highCritical > criteria.security.highCritical) {
    failures.push(
      `Security: ${results.security.highCritical} high/critical vulnerabilities`
    )
  }
  if (
    criteria.security.secretsExposed === false &&
    results.security.secretsExposed
  ) {
    failures.push('Security: secrets exposed')
  }
}

function checkAccessibility(
  criteria: ExitCriteria,
  results: QualityResults,
  failures: string[]
): void {
  if (!criteria.accessibility || !results.accessibility) return

  if (!results.accessibility.wcagAA) {
    failures.push('Accessibility: WCAG AA not met')
  }
  if (
    criteria.accessibility.axeCoreClean &&
    !results.accessibility.axeCoreClean
  ) {
    failures.push('Accessibility: axe-core violations found')
  }
}

function checkPerformance(
  criteria: ExitCriteria,
  results: QualityResults,
  failures: string[]
): void {
  if (!criteria.performance || !results.performance) return

  if (results.performance.lighthouse < criteria.performance.lighthouse) {
    failures.push(
      `Performance: Lighthouse ${results.performance.lighthouse} (need ${criteria.performance.lighthouse})`
    )
  }

  const perfCriteria = criteria.performance
  const perfResults = results.performance

  if (
    perfCriteria.n1Queries !== undefined &&
    perfResults.n1Queries !== undefined &&
    perfResults.n1Queries > perfCriteria.n1Queries
  ) {
    failures.push(`Performance: ${perfResults.n1Queries} N+1 queries found`)
  }

  if (
    perfCriteria.memoryLeaks !== undefined &&
    perfResults.memoryLeaks !== undefined &&
    perfResults.memoryLeaks > perfCriteria.memoryLeaks
  ) {
    failures.push(`Performance: ${perfResults.memoryLeaks} memory leaks found`)
  }
}

function checkArchitecture(
  criteria: ExitCriteria,
  results: QualityResults,
  failures: string[]
): void {
  if (
    criteria.architecture &&
    results.architecture &&
    !results.architecture.reviewed
  ) {
    failures.push('Architecture: not reviewed')
  }
}
