/**
 * Branded types for domain concepts
 *
 * Provides type-safe wrappers around primitive types to prevent mixing
 * different domain concepts (e.g., can't pass a CommitHash where SemanticVersion expected)
 *
 * @module saas-utils/branded-types
 */

/**
 * Branded type helper - creates a nominal type from a base type
 */
type Brand<K, T> = K & { __brand: T }

/**
 * Git commit hash (40 character hex string)
 *
 * @example
 * const hash = createCommitHash('abc1234567890def1234567890abcdef12345678')
 */
export type CommitHash = Brand<string, 'CommitHash'>

/**
 * Semantic version string (v1.2.3 format)
 *
 * @example
 * const version = createSemanticVersion('v1.2.3')
 */
export type SemanticVersion = Brand<string, 'SemanticVersion'>

/**
 * Percentage value (0-100)
 *
 * @example
 * const coverage = createPercentage(85)
 */
export type Percentage = Brand<number, 'Percentage'>

/**
 * Create a validated CommitHash
 *
 * @param hash - Git commit hash (40 character hex string or short 7+ char format)
 * @returns Branded CommitHash
 * @throws Error if hash format is invalid
 */
export function createCommitHash(hash: string): CommitHash {
  if (!hash || typeof hash !== 'string') {
    throw new Error('CommitHash must be a non-empty string')
  }

  const trimmed = hash.trim()

  // Allow full 40-char SHA-1 or short 7+ char format
  if (!/^[0-9a-f]{7,40}$/i.test(trimmed)) {
    throw new Error(
      'CommitHash must be a 7-40 character hexadecimal string (git commit hash)'
    )
  }

  return trimmed.toLowerCase() as CommitHash
}

/**
 * Create a validated SemanticVersion
 *
 * @param version - Semantic version string (v1.2.3 or 1.2.3 format)
 * @returns Branded SemanticVersion
 * @throws Error if version format is invalid
 */
export function createSemanticVersion(version: string): SemanticVersion {
  if (!version || typeof version !== 'string') {
    throw new Error('SemanticVersion must be a non-empty string')
  }

  const trimmed = version.trim()

  // Validate semantic version format: v1.2.3 or 1.2.3
  // Using a two-step approach to avoid regex complexity
  const versionWithoutPrefix = trimmed.startsWith('v')
    ? trimmed.slice(1)
    : trimmed
  const parts = versionWithoutPrefix.split(/[-+]/)
  const coreParts = parts[0].split('.')

  const isValidCore =
    coreParts.length === 3 && coreParts.every(p => /^\d{1,10}$/.test(p))

  if (!isValidCore) {
    throw new Error(
      'SemanticVersion must match format: v1.2.3 or 1.2.3 (with optional pre-release and build metadata)'
    )
  }

  // Normalize to always have 'v' prefix
  return (trimmed.startsWith('v') ? trimmed : `v${trimmed}`) as SemanticVersion
}

/**
 * Create a validated Percentage
 *
 * @param value - Numeric percentage (0-100)
 * @returns Branded Percentage
 * @throws Error if value is out of range
 */
export function createPercentage(value: number): Percentage {
  if (typeof value !== 'number') {
    throw new Error('Percentage must be a number')
  }

  if (!Number.isFinite(value)) {
    throw new Error('Percentage must be a finite number')
  }

  if (value < 0 || value > 100) {
    throw new Error('Percentage must be between 0 and 100')
  }

  return value as Percentage
}

/**
 * Type guard to check if a value is a valid CommitHash
 */
export function isCommitHash(value: unknown): value is CommitHash {
  try {
    if (typeof value !== 'string') return false
    createCommitHash(value)
    return true
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[isCommitHash] Validation failed:', {
        value,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return false
  }
}

/**
 * Type guard to check if a value is a valid SemanticVersion
 */
export function isSemanticVersion(value: unknown): value is SemanticVersion {
  try {
    if (typeof value !== 'string') return false
    createSemanticVersion(value)
    return true
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[isSemanticVersion] Validation failed:', {
        value,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return false
  }
}

/**
 * Type guard to check if a value is a valid Percentage
 */
export function isPercentage(value: unknown): value is Percentage {
  try {
    if (typeof value !== 'number') return false
    createPercentage(value)
    return true
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[isPercentage] Validation failed:', {
        value,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return false
  }
}
