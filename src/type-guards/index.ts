/**
 * Type Guards and Utilities
 * Strong type safety helpers for narrowing unknown types
 */

/**
 * Type guard for NodeJS.ErrnoException
 */
export interface NodeError {
  code?: string
  message: string
  name: string
  stack?: string
}

/**
 * Checks if an unknown error is a NodeJS error with a code
 */
export function isNodeError(error: unknown): error is NodeError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string' &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  )
}

/**
 * Checks if an unknown error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

/**
 * Checks if an error is a specific code (e.g., ENOENT)
 */
export function isErrorCode(error: unknown, code: string): boolean {
  return isNodeError(error) && error.code === code
}

/**
 * Type guard for objects with string keys
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Type guard for non-null, non-undefined values
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Type guard for arrays
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value)
}

/**
 * Type guard for strings
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Type guard for numbers
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
}

/**
 * Type guard for non-empty strings
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * Type guard for non-empty arrays
 */
export function isNonEmptyArray<T = unknown>(
  value: unknown
): value is [T, ...T[]] {
  return Array.isArray(value) && value.length > 0
}
