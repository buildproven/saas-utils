# Setup Guide

## Requirements

- Node.js 18+
- pnpm 8+ (or npm/yarn)
- Upstash Redis account (for cache, rate-limiter, user-service modules)
- Stripe account (for stripe module)

## Installation

```bash
pnpm add saas-utils
# or
npm install saas-utils
```

Peer dependencies:

```bash
pnpm add next@>=14
# Stripe module also requires:
pnpm add stripe
```

## Environment Variables

Copy `.env.example` to your project's `.env.local` and fill in values:

```bash
cp node_modules/saas-utils/.env.example .env.local
```

### Required Variables

| Variable | Module | Description |
|----------|--------|-------------|
| `UPSTASH_REDIS_REST_URL` | cache, rate-limiter, user-service | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | cache, rate-limiter, user-service | Upstash Redis REST token |
| `ENCRYPTION_KEY` | encryption | 64-char hex key (32 bytes) |
| `STRIPE_SECRET_KEY` | stripe | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | stripe | Stripe webhook signing secret |

### Generating an Encryption Key

```bash
openssl rand -hex 32
```

### Upstash Redis Setup

1. Create a free database at [console.upstash.com](https://console.upstash.com)
2. Copy the REST URL and REST Token from the dashboard
3. Add both to your `.env.local`

### Stripe Webhook Setup

1. In the Stripe Dashboard, go to Developers > Webhooks
2. Add an endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the signing secret (`whsec_...`) to `STRIPE_WEBHOOK_SECRET`

## Module Usage

Each module is independently importable:

```typescript
// Only import what you need — no side effects from unused modules
import { createCache } from 'saas-utils/cache'
import { createRateLimiter } from 'saas-utils/rate-limiter'
import { encryptToken, decryptToken } from 'saas-utils/encryption'
import { handleApiError } from 'saas-utils/error-handler'
import { checkFeatureAccess } from 'saas-utils/feature-gate'
import { createUserService } from 'saas-utils/user-service'
import { handleStripeWebhook } from 'saas-utils/stripe'
import { analyzePricing } from 'saas-utils/pricing'
```

See [README.md](./README.md) for usage examples for each module.

## TypeScript Configuration

This package ships with full TypeScript types. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "strict": true
  }
}
```

## Verifying Setup

After configuring environment variables, verify each module:

```typescript
import { createCache } from 'saas-utils/cache'

const cache = createCache()
const ok = await cache.ping()
console.log('Redis connected:', ok)
```

## Support

For licensing and support inquiries: support@saas-utils.dev
