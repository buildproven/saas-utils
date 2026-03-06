/**
 * Shared Utils Tests
 */

import { describe, it, expect } from 'vitest'
import {
  slugify,
  formatDate,
  calculateViabilityScore,
  getRecommendation,
  VIABILITY_THRESHOLD_GO,
  VIABILITY_THRESHOLD_PIVOT,
} from './index'

describe('slugify', () => {
  it('should convert string to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('should remove special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
  })

  it('should handle multiple spaces', () => {
    expect(slugify('Hello   World')).toBe('hello-world')
  })

  it('should trim leading/trailing spaces', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world')
  })

  it('should handle numbers', () => {
    expect(slugify('Product 123')).toBe('product-123')
  })

  it('should handle already slugified strings', () => {
    expect(slugify('already-slugified')).toBe('already-slugified')
  })
})

describe('formatDate', () => {
  it('should format date as YYYY-MM-DD', () => {
    const date = new Date('2025-12-10T12:00:00Z')
    expect(formatDate(date)).toBe('2025-12-10')
  })

  it('should handle Date objects', () => {
    const date = new Date('2025-01-15T00:00:00Z')
    const result = formatDate(date)
    expect(result).toBe('2025-01-15')
  })
})

describe('calculateViabilityScore', () => {
  it('should calculate weighted score correctly', () => {
    // demand * 0.4 + competition * 0.3 + pricing * 0.3
    // 100 * 0.4 + 100 * 0.3 + 100 * 0.3 = 100
    expect(calculateViabilityScore(100, 100, 100)).toBe(100)
  })

  it('should weight demand at 40%', () => {
    // 100 * 0.4 + 0 + 0 = 40
    expect(calculateViabilityScore(100, 0, 0)).toBe(40)
  })

  it('should weight competition at 30%', () => {
    // 0 + 100 * 0.3 + 0 = 30
    expect(calculateViabilityScore(0, 100, 0)).toBe(30)
  })

  it('should weight pricing at 30%', () => {
    // 0 + 0 + 100 * 0.3 = 30
    expect(calculateViabilityScore(0, 0, 100)).toBe(30)
  })

  it('should return 0 for all zeros', () => {
    expect(calculateViabilityScore(0, 0, 0)).toBe(0)
  })

  it('should calculate mixed scores', () => {
    // 80 * 0.4 + 60 * 0.3 + 70 * 0.3 = 32 + 18 + 21 = 71
    expect(calculateViabilityScore(80, 60, 70)).toBe(71)
  })
})

describe('getRecommendation', () => {
  it('should return GO for scores >= GO threshold', () => {
    expect(getRecommendation(VIABILITY_THRESHOLD_GO)).toBe('GO')
    expect(getRecommendation(VIABILITY_THRESHOLD_GO + 10)).toBe('GO')
    expect(getRecommendation(100)).toBe('GO')
  })

  it('should return PIVOT for scores between PIVOT and GO thresholds', () => {
    expect(getRecommendation(VIABILITY_THRESHOLD_PIVOT)).toBe('PIVOT')
    expect(getRecommendation(VIABILITY_THRESHOLD_GO - 1)).toBe('PIVOT')
  })

  it('should return NO-GO for scores below PIVOT threshold', () => {
    expect(getRecommendation(VIABILITY_THRESHOLD_PIVOT - 1)).toBe('NO-GO')
    expect(getRecommendation(0)).toBe('NO-GO')
  })
})
