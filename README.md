# saas-utils

Production-grade utility modules for SaaS backends. 14 modules covering the boring-but-critical infrastructure every SaaS needs.

Built for Next.js + Upstash Redis + Stripe. Each module is independent — use what you need.

## Modules

| Module | Import | What it does |
|--------|--------|-------------|
| **logger** | `saas-utils/logger` | Structured logging with module context and log levels |
| **cache** | `saas-utils/cache` | Redis wrapper (Upstash) with graceful fallback when Redis is unavailable |
| **rate-limiter** | `saas-utils/rate-limiter` | Simple + advanced rate limiting with request deduplication |
| **product-rate-limiter** | `saas-utils/product-rate-limiter` | Per-product usage limits tied to subscription tiers |
| **encryption** | `saas-utils/encryption` | AES-256-GCM token encryption/decryption |
| **error-handler** | `saas-utils/error-handler` | Standardized API error responses for Next.js |
| **feature-gate** | `saas-utils/feature-gate` | Subscription-based feature access control |
| **user-service** | `saas-utils/user-service` | Redis-based user and tier management |
| **stripe** | `saas-utils/stripe` | Stripe checkout, webhooks, and Playwright test helpers |
| **pricing** | `saas-utils/pricing` | Pricing tier analysis with margin enforcement (80-90% target) |
| **branded-types** | `saas-utils/branded-types` | TypeScript branded types: CommitHash, SemanticVersion, Percentage |
| **type-guards** | `saas-utils/type-guards` | Type-safe narrowing utilities |
| **env-resolver** | `saas-utils/env-resolver` | Multi-source API key resolution with caching |
| **quality-standards** | `saas-utils/quality-standards` | Quality level definitions and exit criteria |

## Install

```bash
pnpm add saas-utils
# or
npm install saas-utils
```

Peer dependencies: `next >= 14`, `stripe` (optional, for stripe module)

## Quick Examples

### Rate Limiting

```typescript
import { createRateLimiter } from 'saas-utils/rate-limiter'

const limiter = createRateLimiter({
  maxRequests: 100,
  windowMs: 60_000, // 1 minute
})

// In your API route
const result = await limiter.check(userId)
if (!result.allowed) {
  return Response.json({ error: 'Rate limited' }, { status: 429 })
}
```

### Encryption

```typescript
import { encrypt, decrypt } from 'saas-utils/encryption'

const encrypted = encrypt(apiToken, process.env.ENCRYPTION_KEY)
const decrypted = decrypt(encrypted, process.env.ENCRYPTION_KEY)
```

### Cache with Fallback

```typescript
import { cache } from 'saas-utils/cache'

// Returns null gracefully if Redis is down (no crash)
const data = await cache.get('user:123')
await cache.set('user:123', userData, { ttl: 3600 })
```

### Error Handler

```typescript
import { handleApiError } from 'saas-utils/error-handler'

export async function GET(req: Request) {
  try {
    // ... your logic
  } catch (error) {
    return handleApiError(error) // Returns proper JSON response with status code
  }
}
```

### Feature Gates

```typescript
import { checkFeatureAccess } from 'saas-utils/feature-gate'

const canExport = await checkFeatureAccess(userId, 'bulk-export')
if (!canExport.allowed) {
  return Response.json({ error: canExport.reason }, { status: 403 })
}
```

### Stripe Webhooks

```typescript
import { handleStripeWebhook } from 'saas-utils/stripe'

export async function POST(req: Request) {
  return handleStripeWebhook(req, {
    onCheckoutComplete: async (session) => { /* provision access */ },
    onSubscriptionUpdated: async (sub) => { /* update tier */ },
    onSubscriptionDeleted: async (sub) => { /* revoke access */ },
  })
}
```

### Branded Types

```typescript
import { CommitHash, SemanticVersion, Percentage } from 'saas-utils/branded-types'

function deploy(commit: CommitHash, version: SemanticVersion) {
  // Type-safe — can't accidentally pass a regular string
}
```

### Pricing Analysis

```typescript
import { analyzePricing } from 'saas-utils/pricing'

const analysis = analyzePricing({
  price: 49,
  costs: { hosting: 3, api: 2, support: 1 },
})
// { margin: 0.878, meetsMinimum: true, meetsTarget: false }
```

## Development

```bash
pnpm install
pnpm test        # Run all tests
pnpm build       # Build for distribution
```

Every module has co-located tests (`*.test.ts`).

## License

Commercial license. See [LICENSE](./LICENSE) for full terms. Not for redistribution.
Contact support@saas-utils.dev for licensing inquiries.
