/**
 * Stripe Utilities
 * Reusable Stripe integration helpers for SaaS projects projects
 *
 * @example
 * ```typescript
 * import { stripeWebhooks, stripeCheckout, stripeEnv } from 'saas-utils/stripe'
 *
 * // Check webhook health
 * const health = await stripeWebhooks.checkWebhookHealth(secretKey, 'myapp.com')
 *
 * // Recreate webhook with fresh secret
 * const { secret } = await stripeWebhooks.recreateWebhook(secretKey, {
 *   url: 'https://myapp.com/api/webhooks/stripe',
 *   events: ['checkout.session.completed']
 * })
 *
 * // Full setup: recreate webhook + update Vercel + redeploy
 * const result = await stripeEnv.fullWebhookSetup({
 *   stripeSecretKey: secretKey,
 *   webhookUrl: 'https://myapp.com/api/webhooks/stripe',
 *   events: ['checkout.session.completed'],
 *   vercelCwd: '/path/to/project'
 * })
 * ```
 */

// Webhook management
export {
  listWebhooks,
  findWebhooks,
  deleteWebhook,
  createWebhook,
  recreateWebhook,
  getRecentEvents,
  checkWebhookHealth,
  type WebhookEndpoint,
  type CreateWebhookOptions,
  type WebhookResult,
} from './webhooks'

// Checkout utilities
export {
  createCheckoutSession,
  getCheckoutSession,
  listCheckoutSessions,
  getCompletedCheckouts,
  generateTestCheckoutData,
  TEST_CARDS,
  type CheckoutSession,
  type CreateCheckoutOptions,
  type TestCheckoutData,
} from './checkout'

// Environment management
export {
  updateVercelEnv,
  triggerVercelRedeploy,
  readStripeKeyFromEnv,
  readEnvVar,
  maskSecret,
  fullWebhookSetup,
  type VercelEnvironment,
  type EnvUpdateResult,
  type FullSetupOptions,
  type FullSetupResult,
} from './env'

// Playwright E2E testing helpers
export {
  fillStripeCheckout,
  submitStripePayment,
  waitForStripeCheckout,
  completeStripeCheckout,
  verifyWebhookDelivered,
  waitForWebhookDelivery,
  TEST_CARDS as PLAYWRIGHT_TEST_CARDS,
  type CheckoutFormData,
} from './playwright'

// Unit test mocks and factories - IMPORT DIRECTLY from 'saas-utils/stripe/testing' in test files
// Not exported from main entry to avoid vitest dependency in production builds
// export * from './testing'

// Namespace exports for organized access
import * as webhooks from './webhooks'
import * as checkout from './checkout'
import * as env from './env'
import * as playwright from './playwright'

export const stripeWebhooks = webhooks
export const stripeCheckout = checkout
export const stripeEnv = env
export const stripePlaywright = playwright

// Test utilities available via direct import: import { ... } from 'saas-utils/stripe/testing'
