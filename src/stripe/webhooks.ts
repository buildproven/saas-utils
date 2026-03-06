/**
 * Stripe Webhook Management Utilities
 * Reusable across SaaS projects
 */

export interface WebhookEndpoint {
  id: string
  url: string
  status: string
  secret?: string
  enabled_events: string[]
  description?: string
}

export interface CreateWebhookOptions {
  url: string
  events: string[]
  description?: string
}

export interface WebhookResult {
  endpoint: WebhookEndpoint
  secret: string
}

/**
 * Make authenticated request to Stripe API
 */
async function stripeRequest<T>(
  method: string,
  path: string,
  secretKey: string,
  data?: Record<string, string | string[]>
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
      if (Array.isArray(value)) {
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
 * List all webhook endpoints
 */
export async function listWebhooks(
  secretKey: string
): Promise<WebhookEndpoint[]> {
  const result = await stripeRequest<{ data: WebhookEndpoint[] }>(
    'GET',
    'webhook_endpoints',
    secretKey
  )
  return result.data || []
}

/**
 * Find webhook endpoints matching a URL pattern
 */
export async function findWebhooks(
  secretKey: string,
  urlPattern: string
): Promise<WebhookEndpoint[]> {
  const webhooks = await listWebhooks(secretKey)
  return webhooks.filter(w => w.url.includes(urlPattern))
}

/**
 * Delete a webhook endpoint
 */
export async function deleteWebhook(
  secretKey: string,
  endpointId: string
): Promise<{ deleted: boolean; id: string }> {
  return stripeRequest('DELETE', `webhook_endpoints/${endpointId}`, secretKey)
}

/**
 * Create a new webhook endpoint
 */
export async function createWebhook(
  secretKey: string,
  options: CreateWebhookOptions
): Promise<WebhookResult> {
  const data: Record<string, string | string[]> = {
    url: options.url,
    enabled_events: options.events,
  }

  if (options.description) {
    data.description = options.description
  }

  const endpoint = await stripeRequest<WebhookEndpoint & { secret: string }>(
    'POST',
    'webhook_endpoints',
    secretKey,
    data
  )

  return {
    endpoint,
    secret: endpoint.secret,
  }
}

/**
 * Recreate webhook endpoint with fresh secret
 * Deletes existing endpoints matching the URL and creates a new one
 */
export async function recreateWebhook(
  secretKey: string,
  options: CreateWebhookOptions
): Promise<WebhookResult> {
  // Extract domain from URL for matching
  const urlObj = new URL(options.url)
  const domain = urlObj.hostname

  // Find and delete existing webhooks for this domain
  const existing = await findWebhooks(secretKey, domain)
  for (const endpoint of existing) {
    await deleteWebhook(secretKey, endpoint.id)
  }

  // Create new webhook
  return createWebhook(secretKey, options)
}

/**
 * Get recent webhook events
 */
export async function getRecentEvents(
  secretKey: string,
  eventType?: string,
  limit = 5
): Promise<
  Array<{
    id: string
    type: string
    pending_webhooks: number
    created: number
    data: { object: Record<string, unknown> }
  }>
> {
  let path = `events?limit=${limit}`
  if (eventType) {
    path += `&type=${eventType}`
  }

  const result = await stripeRequest<{ data: Array<unknown> }>(
    'GET',
    path,
    secretKey
  )
  return result.data as Array<{
    id: string
    type: string
    pending_webhooks: number
    created: number
    data: { object: Record<string, unknown> }
  }>
}

/**
 * Check if webhooks are being delivered successfully
 */
export async function checkWebhookHealth(
  secretKey: string,
  urlPattern: string
): Promise<{
  healthy: boolean
  endpoint?: WebhookEndpoint
  pendingEvents: number
  message: string
}> {
  const webhooks = await findWebhooks(secretKey, urlPattern)

  if (webhooks.length === 0) {
    return {
      healthy: false,
      pendingEvents: 0,
      message: `No webhook endpoint found matching "${urlPattern}"`,
    }
  }

  const endpoint = webhooks[0]
  const events = await getRecentEvents(secretKey, 'checkout.session.completed')
  const pendingEvents = events.filter(e => e.pending_webhooks > 0).length

  if (endpoint.status !== 'enabled') {
    return {
      healthy: false,
      endpoint,
      pendingEvents,
      message: `Webhook endpoint is ${endpoint.status}`,
    }
  }

  if (pendingEvents > 0) {
    return {
      healthy: false,
      endpoint,
      pendingEvents,
      message: `${pendingEvents} events with pending webhooks - possible secret mismatch`,
    }
  }

  return {
    healthy: true,
    endpoint,
    pendingEvents: 0,
    message: 'Webhooks are being delivered successfully',
  }
}
