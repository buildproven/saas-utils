import { describe, it, expect } from 'vitest'
import {
  createCommitHash,
  createSemanticVersion,
  createPercentage,
  isCommitHash,
  isSemanticVersion,
  isPercentage,
  type CommitHash,
  type SemanticVersion,
  type Percentage,
} from './branded-types'

describe('branded-types', () => {
  describe('createCommitHash', () => {
    it('should create valid full SHA-1 commit hash', () => {
      const hash = createCommitHash('abc1234567890def1234567890abcdef12345678')
      expect(hash).toBe('abc1234567890def1234567890abcdef12345678')
    })

    it('should create valid short commit hash (7 chars)', () => {
      const hash = createCommitHash('abc1234')
      expect(hash).toBe('abc1234')
    })

    it('should create valid short commit hash (8 chars)', () => {
      const hash = createCommitHash('abc12345')
      expect(hash).toBe('abc12345')
    })

    it('should normalize to lowercase', () => {
      const hash = createCommitHash('ABC1234')
      expect(hash).toBe('abc1234')
    })

    it('should trim whitespace', () => {
      const hash = createCommitHash('  abc1234  ')
      expect(hash).toBe('abc1234')
    })

    it('should accept uppercase hex characters', () => {
      const hash = createCommitHash('ABCDEF1234567890')
      expect(hash).toBe('abcdef1234567890')
    })

    it('should throw for empty string', () => {
      expect(() => createCommitHash('')).toThrow(
        'CommitHash must be a non-empty string'
      )
    })

    it('should throw for non-string input', () => {
      // @ts-expect-error - Testing invalid input
      expect(() => createCommitHash(123)).toThrow(
        'CommitHash must be a non-empty string'
      )
    })

    it('should throw for too short hash (< 7 chars)', () => {
      expect(() => createCommitHash('abc123')).toThrow(
        'CommitHash must be a 7-40 character hexadecimal string'
      )
    })

    it('should throw for too long hash (> 40 chars)', () => {
      expect(() =>
        createCommitHash('abc1234567890def1234567890abcdef123456789')
      ).toThrow('CommitHash must be a 7-40 character hexadecimal string')
    })

    it('should throw for non-hex characters', () => {
      expect(() => createCommitHash('xyz1234')).toThrow(
        'CommitHash must be a 7-40 character hexadecimal string'
      )
    })

    it('should throw for hash with spaces', () => {
      expect(() => createCommitHash('abc 1234')).toThrow(
        'CommitHash must be a 7-40 character hexadecimal string'
      )
    })
  })

  describe('createSemanticVersion', () => {
    it('should create valid semantic version with v prefix', () => {
      const version = createSemanticVersion('v1.2.3')
      expect(version).toBe('v1.2.3')
    })

    it('should create valid semantic version without v prefix', () => {
      const version = createSemanticVersion('1.2.3')
      expect(version).toBe('v1.2.3') // Normalized to include 'v'
    })

    it('should normalize version to include v prefix', () => {
      const version = createSemanticVersion('2.5.10')
      expect(version).toBe('v2.5.10')
    })

    it('should accept pre-release version', () => {
      const version = createSemanticVersion('v1.2.3-alpha.1')
      expect(version).toBe('v1.2.3-alpha.1')
    })

    it('should accept build metadata', () => {
      const version = createSemanticVersion('v1.2.3+build.123')
      expect(version).toBe('v1.2.3+build.123')
    })

    it('should accept pre-release and build metadata', () => {
      const version = createSemanticVersion('v1.2.3-beta.2+build.456')
      expect(version).toBe('v1.2.3-beta.2+build.456')
    })

    it('should trim whitespace', () => {
      const version = createSemanticVersion('  v1.2.3  ')
      expect(version).toBe('v1.2.3')
    })

    it('should accept multi-digit version numbers', () => {
      const version = createSemanticVersion('v10.20.30')
      expect(version).toBe('v10.20.30')
    })

    it('should throw for empty string', () => {
      expect(() => createSemanticVersion('')).toThrow(
        'SemanticVersion must be a non-empty string'
      )
    })

    it('should throw for non-string input', () => {
      // @ts-expect-error - Testing invalid input
      expect(() => createSemanticVersion(123)).toThrow(
        'SemanticVersion must be a non-empty string'
      )
    })

    it('should throw for invalid format (missing patch)', () => {
      expect(() => createSemanticVersion('v1.2')).toThrow(
        'SemanticVersion must match format'
      )
    })

    it('should throw for invalid format (non-numeric)', () => {
      expect(() => createSemanticVersion('v1.x.3')).toThrow(
        'SemanticVersion must match format'
      )
    })

    it('should throw for invalid format (no dots)', () => {
      expect(() => createSemanticVersion('v123')).toThrow(
        'SemanticVersion must match format'
      )
    })

    it('should throw for invalid format (extra dots)', () => {
      expect(() => createSemanticVersion('v1.2.3.4')).toThrow(
        'SemanticVersion must match format'
      )
    })
  })

  describe('createPercentage', () => {
    it('should create valid percentage at 0', () => {
      const percentage = createPercentage(0)
      expect(percentage).toBe(0)
    })

    it('should create valid percentage at 100', () => {
      const percentage = createPercentage(100)
      expect(percentage).toBe(100)
    })

    it('should create valid percentage in middle range', () => {
      const percentage = createPercentage(50)
      expect(percentage).toBe(50)
    })

    it('should create valid decimal percentage', () => {
      const percentage = createPercentage(85.5)
      expect(percentage).toBe(85.5)
    })

    it('should accept integer values', () => {
      const percentage = createPercentage(75)
      expect(percentage).toBe(75)
    })

    it('should throw for negative value', () => {
      expect(() => createPercentage(-1)).toThrow(
        'Percentage must be between 0 and 100'
      )
    })

    it('should throw for value > 100', () => {
      expect(() => createPercentage(101)).toThrow(
        'Percentage must be between 0 and 100'
      )
    })

    it('should throw for non-number input', () => {
      // @ts-expect-error - Testing invalid input
      expect(() => createPercentage('50')).toThrow(
        'Percentage must be a number'
      )
    })

    it('should throw for NaN', () => {
      expect(() => createPercentage(NaN)).toThrow(
        'Percentage must be a finite number'
      )
    })

    it('should throw for Infinity', () => {
      expect(() => createPercentage(Infinity)).toThrow(
        'Percentage must be a finite number'
      )
    })

    it('should throw for -Infinity', () => {
      expect(() => createPercentage(-Infinity)).toThrow(
        'Percentage must be a finite number'
      )
    })
  })

  describe('isCommitHash', () => {
    it('should return true for valid commit hash', () => {
      expect(isCommitHash('abc1234')).toBe(true)
      expect(isCommitHash('abc1234567890def1234567890abcdef12345678')).toBe(
        true
      )
    })

    it('should return false for invalid commit hash', () => {
      expect(isCommitHash('xyz')).toBe(false)
      expect(isCommitHash('abc123')).toBe(false) // Too short
      expect(isCommitHash('')).toBe(false)
    })

    it('should return false for non-string', () => {
      expect(isCommitHash(123)).toBe(false)
      expect(isCommitHash(null)).toBe(false)
      expect(isCommitHash(undefined)).toBe(false)
      expect(isCommitHash({})).toBe(false)
    })
  })

  describe('isSemanticVersion', () => {
    it('should return true for valid semantic version', () => {
      expect(isSemanticVersion('v1.2.3')).toBe(true)
      expect(isSemanticVersion('1.2.3')).toBe(true)
      expect(isSemanticVersion('v1.2.3-alpha.1')).toBe(true)
    })

    it('should return false for invalid semantic version', () => {
      expect(isSemanticVersion('v1.2')).toBe(false)
      expect(isSemanticVersion('v1.x.3')).toBe(false)
      expect(isSemanticVersion('')).toBe(false)
    })

    it('should return false for non-string', () => {
      expect(isSemanticVersion(123)).toBe(false)
      expect(isSemanticVersion(null)).toBe(false)
      expect(isSemanticVersion(undefined)).toBe(false)
      expect(isSemanticVersion({})).toBe(false)
    })
  })

  describe('isPercentage', () => {
    it('should return true for valid percentage', () => {
      expect(isPercentage(0)).toBe(true)
      expect(isPercentage(50)).toBe(true)
      expect(isPercentage(100)).toBe(true)
      expect(isPercentage(85.5)).toBe(true)
    })

    it('should return false for invalid percentage', () => {
      expect(isPercentage(-1)).toBe(false)
      expect(isPercentage(101)).toBe(false)
      expect(isPercentage(NaN)).toBe(false)
      expect(isPercentage(Infinity)).toBe(false)
    })

    it('should return false for non-number', () => {
      expect(isPercentage('50')).toBe(false)
      expect(isPercentage(null)).toBe(false)
      expect(isPercentage(undefined)).toBe(false)
      expect(isPercentage({})).toBe(false)
    })
  })

  describe('Type safety', () => {
    it('should prevent mixing branded types at compile time', () => {
      const hash: CommitHash = createCommitHash('abc1234')
      const version: SemanticVersion = createSemanticVersion('v1.2.3')
      const percentage: Percentage = createPercentage(85)

      // These should be different types
      expect(hash).not.toBe(version)
      expect(hash).not.toBe(percentage)
      expect(version).not.toBe(percentage)

      // Runtime values are still their primitive types
      expect(typeof hash).toBe('string')
      expect(typeof version).toBe('string')
      expect(typeof percentage).toBe('number')
    })

    it('should allow using branded types where primitives are expected', () => {
      const hash: CommitHash = createCommitHash('abc1234')
      const version: SemanticVersion = createSemanticVersion('v1.2.3')
      const percentage: Percentage = createPercentage(85)

      // Can use in string operations
      const hashUpper: string = hash.toUpperCase()
      expect(hashUpper).toBe('ABC1234')

      // Can use in string operations
      const versionLower: string = version.toLowerCase()
      expect(versionLower).toBe('v1.2.3')

      // Can use in arithmetic
      const doubled: number = percentage * 2
      expect(doubled).toBe(170)
    })
  })
})
