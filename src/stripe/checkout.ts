/**
 * Stripe Checkout Utilities
 * Helpers for creating and testing checkout sessions
 */

export interface CheckoutSession {
  id: string
  url: string
  status: string
  payment_status: string
  customer_email?: string
  customer_details?: {
    email: string
    name?: string
  }
  metadata?: Record<string, string>
}

export interface CreateCheckoutOptions {
  priceId: string
  successUrl: string
  cancelUrl: string
  mode?: 'payment' | 'subscription'
  customerEmail?: string
  metadata?: Record<string, string>
  allowPromotionCodes?: boolean
}

/**
 * Make authenticated request to Stripe API
 */
async function stripeRequest<T>(
  method: string,
  path: string,
  secretKey: string,
  data?: Record<string, string | string[] | Record<string, string>>
): Promise<T> {
  const url = `https://api.stripe.com/v1/${path}`
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  const options: RequestInit = { method, headers }

  if (data && (method === 'POST' || method === 'PUT')) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle nested objects like metadata
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          params.append(`${key}[${nestedKey}]`, nestedValue)
        }
      } else if (Array.isArray(value)) {
        value.forEach(v => params.append(`${key}[]`, v))
      } else {
        params.append(key, value)
      }
    }
    options.body = params.toString()
  }

  const response = await fetch(url, options)
  return response.json() as Promise<T>
}

/**
 * Create a checkout session
 */
export async function createCheckoutSession(
  secretKey: string,
  options: CreateCheckoutOptions
): Promise<CheckoutSession> {
  const data: Record<string, string | string[] | Record<string, string>> = {
    'line_items[0][price]': options.priceId,
    'line_items[0][quantity]': '1',
    mode: options.mode || 'payment',
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
  }

  if (options.customerEmail) {
    data.customer_email = options.customerEmail
  }

  if (options.allowPromotionCodes) {
    data.allow_promotion_codes = 'true'
  }

  if (options.metadata) {
    data.metadata = options.metadata
  }

  return stripeRequest<CheckoutSession>(
    'POST',
    'checkout/sessions',
    secretKey,
    data
  )
}

/**
 * Retrieve a checkout session
 */
export async function getCheckoutSession(
  secretKey: string,
  sessionId: string
): Promise<CheckoutSession> {
  return stripeRequest<CheckoutSession>(
    'GET',
    `checkout/sessions/${sessionId}`,
    secretKey
  )
}

/**
 * List recent checkout sessions
 */
export async function listCheckoutSessions(
  secretKey: string,
  limit = 10
): Promise<CheckoutSession[]> {
  const result = await stripeRequest<{ data: CheckoutSession[] }>(
    'GET',
    `checkout/sessions?limit=${limit}`,
    secretKey
  )
  return result.data || []
}

/**
 * Get completed checkout sessions (successful payments)
 */
export async function getCompletedCheckouts(
  secretKey: string,
  limit = 10
): Promise<CheckoutSession[]> {
  const sessions = await listCheckoutSessions(secretKey, limit)
  return sessions.filter(
    s => s.status === 'complete' && s.payment_status === 'paid'
  )
}

/**
 * Test card numbers for Stripe test mode
 */
export const TEST_CARDS = {
  success: '4242424242424242',
  declineGeneric: '4000000000000002',
  declineInsufficientFunds: '4000000000009995',
  requires3DS: '4000002760003184',
  requiresAuthentication: '4000002500003155',
} as const

/**
 * Test checkout flow data
 */
export interface TestCheckoutData {
  cardNumber: string
  expiry: string
  cvc: string
  email: string
  name: string
  country: string
  postalCode: string
}

/**
 * Generate test checkout data
 */
export function generateTestCheckoutData(
  email = 'test@example.com'
): TestCheckoutData {
  return {
    cardNumber: TEST_CARDS.success,
    expiry: '12/34',
    cvc: '123',
    email,
    name: 'Test User',
    country: 'US',
    postalCode: '12345',
  }
}
