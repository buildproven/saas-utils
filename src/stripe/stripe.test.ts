/**
 * Stripe Utilities Tests
 */

import { describe, it, expect } from 'vitest'
import { generateTestCheckoutData, TEST_CARDS, maskSecret } from './index'

describe('Stripe Checkout Utilities', () => {
  describe('generateTestCheckoutData', () => {
    it('should generate valid test checkout data', () => {
      const data = generateTestCheckoutData()

      expect(data.cardNumber).toBe(TEST_CARDS.success)
      expect(data.expiry).toBe('12/34')
      expect(data.cvc).toBe('123')
      expect(data.email).toBe('test@example.com')
      expect(data.name).toBe('Test User')
      expect(data.country).toBe('US')
      expect(data.postalCode).toBe('12345')
    })

    it('should use custom email when provided', () => {
      const data = generateTestCheckoutData('custom@test.com')
      expect(data.email).toBe('custom@test.com')
    })
  })

  describe('TEST_CARDS', () => {
    it('should have standard test card numbers', () => {
      expect(TEST_CARDS.success).toBe('4242424242424242')
      expect(TEST_CARDS.declineGeneric).toBe('4000000000000002')
      expect(TEST_CARDS.declineInsufficientFunds).toBe('4000000000009995')
      expect(TEST_CARDS.requires3DS).toBe('4000002760003184')
      expect(TEST_CARDS.requiresAuthentication).toBe('4000002500003155')
    })
  })
})

describe('Stripe Environment Utilities', () => {
  describe('maskSecret', () => {
    it('should mask secret showing only last 8 chars by default', () => {
      const secret = 'whsec_abcdefghijklmnopqrstuvwxyz123456'
      const masked = maskSecret(secret)

      expect(masked.endsWith('yz123456')).toBe(true)
      expect(masked.startsWith('*')).toBe(true)
      expect(masked.length).toBe(secret.length)
    })

    it('should allow custom visible char count', () => {
      const secret = 'whsec_test123'
      const masked = maskSecret(secret, 4)

      expect(masked.endsWith('t123')).toBe(true)
    })

    it('should fully mask short secrets', () => {
      const secret = 'short'
      const masked = maskSecret(secret, 8)

      expect(masked).toBe('*****')
    })
  })
})

describe('Stripe Webhook Types', () => {
  it('should export webhook types', async () => {
    const { listWebhooks, createWebhook, recreateWebhook, checkWebhookHealth } =
      await import('./webhooks')

    expect(typeof listWebhooks).toBe('function')
    expect(typeof createWebhook).toBe('function')
    expect(typeof recreateWebhook).toBe('function')
    expect(typeof checkWebhookHealth).toBe('function')
  })
})

describe('Stripe Checkout Types', () => {
  it('should export checkout types', async () => {
    const {
      createCheckoutSession,
      getCheckoutSession,
      listCheckoutSessions,
      getCompletedCheckouts,
    } = await import('./checkout')

    expect(typeof createCheckoutSession).toBe('function')
    expect(typeof getCheckoutSession).toBe('function')
    expect(typeof listCheckoutSessions).toBe('function')
    expect(typeof getCompletedCheckouts).toBe('function')
  })
})

describe('Stripe Environment Types', () => {
  it('should export env types', async () => {
    const {
      updateVercelEnv,
      triggerVercelRedeploy,
      readStripeKeyFromEnv,
      readEnvVar,
      fullWebhookSetup,
    } = await import('./env')

    expect(typeof updateVercelEnv).toBe('function')
    expect(typeof triggerVercelRedeploy).toBe('function')
    expect(typeof readStripeKeyFromEnv).toBe('function')
    expect(typeof readEnvVar).toBe('function')
    expect(typeof fullWebhookSetup).toBe('function')
  })
})

describe('Namespace Exports', () => {
  it('should export stripeWebhooks namespace', async () => {
    const { stripeWebhooks } = await import('./index')

    expect(stripeWebhooks.listWebhooks).toBeDefined()
    expect(stripeWebhooks.createWebhook).toBeDefined()
    expect(stripeWebhooks.recreateWebhook).toBeDefined()
  })

  it('should export stripeCheckout namespace', async () => {
    const { stripeCheckout } = await import('./index')

    expect(stripeCheckout.createCheckoutSession).toBeDefined()
    expect(stripeCheckout.TEST_CARDS).toBeDefined()
  })

  it('should export stripeEnv namespace', async () => {
    const { stripeEnv } = await import('./index')

    expect(stripeEnv.updateVercelEnv).toBeDefined()
    expect(stripeEnv.fullWebhookSetup).toBeDefined()
  })
})
