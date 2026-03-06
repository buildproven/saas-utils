/**
 * Playwright Stripe Checkout Helpers
 *
 * Reusable utilities for E2E testing Stripe checkout flows.
 * Use these helpers across SaaS projects.
 *
 * @example
 * ```typescript
 * import { fillStripeCheckout, TEST_CARDS, verifyWebhookDelivered } from 'saas-utils/stripe'
 *
 * test('checkout flow', async ({ page }) => {
 *   await page.click('button:has-text("Buy")')
 *   await page.waitForURL(/checkout\.stripe\.com/)
 *   await fillStripeCheckout(page, {
 *     email: 'test@example.com',
 *     card: TEST_CARDS.success,
 *   })
 *   await page.click('button:has-text("Pay")')
 *   await page.waitForURL(/success/)
 *
 *   // Verify webhook delivered
 *   const delivered = await verifyWebhookDelivered(stripeKey, 'test@example.com')
 *   expect(delivered).toBe(true)
 * })
 * ```
 */

import type { Page, FrameLocator } from '@playwright/test'

/**
 * Test card numbers for Stripe test mode
 */
export const TEST_CARDS = {
  /** Always succeeds */
  success: {
    number: '4242424242424242',
    expiry: '12/34',
    cvc: '123',
  },
  /** Always declines */
  decline: {
    number: '4000000000000002',
    expiry: '12/34',
    cvc: '123',
  },
  /** Requires 3D Secure authentication */
  requires3DS: {
    number: '4000002760003184',
    expiry: '12/34',
    cvc: '123',
  },
  /** Insufficient funds */
  insufficientFunds: {
    number: '4000000000009995',
    expiry: '12/34',
    cvc: '123',
  },
} as const

export interface CheckoutFormData {
  email: string
  card?: {
    number: string
    expiry: string
    cvc: string
  }
  name?: string
  postalCode?: string
  country?: string
}

/**
 * Fill Stripe checkout form on checkout.stripe.com
 *
 * Handles the iframe-based card input fields.
 */
export async function fillStripeCheckout(
  page: Page,
  data: CheckoutFormData
): Promise<void> {
  const card = data.card || TEST_CARDS.success

  // Fill email
  const emailInput = page.getByLabel(/email/i)
  if (await emailInput.isVisible()) {
    await emailInput.fill(data.email)
  }

  // Card details are in an iframe
  const cardFrame = await getCardFrame(page)

  if (cardFrame) {
    // Single combined card input
    const cardInput = cardFrame.getByPlaceholder(/card number/i)
    if (await cardInput.isVisible()) {
      await cardInput.fill(card.number)
    }

    // Expiry
    const expiryInput = cardFrame.getByPlaceholder(/mm.*yy/i)
    if (await expiryInput.isVisible()) {
      await expiryInput.fill(card.expiry)
    }

    // CVC
    const cvcInput = cardFrame.getByPlaceholder(/cvc/i)
    if (await cvcInput.isVisible()) {
      await cvcInput.fill(card.cvc)
    }
  }

  // Name on card
  if (data.name) {
    const nameInput = page.getByLabel(/name on card/i)
    if (await nameInput.isVisible()) {
      await nameInput.fill(data.name)
    }
  }

  // Postal code / ZIP
  const postalCode = data.postalCode || '12345'
  const postalInput = page.getByLabel(/postal code|zip/i)
  if (await postalInput.isVisible()) {
    await postalInput.fill(postalCode)
  }

  // Country (if dropdown)
  if (data.country) {
    const countrySelect = page.getByLabel(/country/i)
    if (await countrySelect.isVisible()) {
      await countrySelect.selectOption(data.country)
    }
  }
}

/**
 * Get the Stripe card input iframe
 */
async function getCardFrame(page: Page): Promise<FrameLocator | null> {
  // Stripe uses various iframe naming conventions
  const iframeSelectors = [
    'iframe[name*="card"]',
    'iframe[name*="privateStripe"]',
    'iframe[title*="card"]',
  ]

  for (const selector of iframeSelectors) {
    const frame = page.frameLocator(selector).first()
    try {
      const cardInput = frame.getByPlaceholder(/card number/i)
      if (await cardInput.isVisible({ timeout: 2000 })) {
        return frame
      }
    } catch {
      // Try next selector
    }
  }

  return null
}

/**
 * Submit payment on Stripe checkout
 */
export async function submitStripePayment(page: Page): Promise<void> {
  const submitButton = page.getByRole('button', {
    name: /subscribe|pay|submit/i,
  })
  await submitButton.click()
}

/**
 * Wait for Stripe checkout to load
 */
export async function waitForStripeCheckout(
  page: Page,
  timeout = 30000
): Promise<void> {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout })
  // Wait for form to be ready
  await page.waitForSelector('form', { timeout: 10000 })
}

/**
 * Complete a full Stripe checkout flow
 */
export async function completeStripeCheckout(
  page: Page,
  data: CheckoutFormData,
  options: { waitForSuccess?: string | RegExp } = {}
): Promise<void> {
  // Wait for checkout page
  await waitForStripeCheckout(page)

  // Fill form
  await fillStripeCheckout(page, data)

  // Submit
  await submitStripePayment(page)

  // Wait for redirect to success
  if (options.waitForSuccess) {
    await page.waitForURL(options.waitForSuccess, { timeout: 60000 })
  }
}

/**
 * Verify a webhook was delivered for a recent purchase
 *
 * Checks Stripe events API to verify webhook delivery.
 */
export async function verifyWebhookDelivered(
  stripeSecretKey: string,
  customerEmail: string,
  options: { maxAge?: number; eventType?: string } = {}
): Promise<{
  delivered: boolean
  eventId?: string
  pendingWebhooks?: number
}> {
  const { getRecentEvents } = await import('./webhooks')
  const eventType = options.eventType || 'checkout.session.completed'
  const maxAge = options.maxAge || 300 // 5 minutes default

  const events = await getRecentEvents(stripeSecretKey, eventType, 10)

  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - maxAge

  // Find event matching email within time window
  const matchingEvent = events.find(event => {
    if (event.created < cutoff) return false
    const session = event.data?.object as Record<string, unknown>
    const details = session?.customer_details as Record<string, unknown>
    return details?.email === customerEmail
  })

  if (!matchingEvent) {
    return { delivered: false }
  }

  return {
    delivered: matchingEvent.pending_webhooks === 0,
    eventId: matchingEvent.id,
    pendingWebhooks: matchingEvent.pending_webhooks,
  }
}

/**
 * Wait for webhook to be delivered (with polling)
 */
export async function waitForWebhookDelivery(
  stripeSecretKey: string,
  customerEmail: string,
  options: { timeout?: number; pollInterval?: number } = {}
): Promise<boolean> {
  const timeout = options.timeout || 30000
  const pollInterval = options.pollInterval || 2000
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const result = await verifyWebhookDelivered(stripeSecretKey, customerEmail)
    if (result.delivered) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  return false
}
