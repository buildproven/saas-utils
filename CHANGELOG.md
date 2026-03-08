# Changelog

All notable changes to saas-utils will be documented here.

## [0.1.0] - 2026-03-06

### Added

- Initial release of saas-utils
- `logger` — Structured logging with module context and log levels
- `cache` — Upstash Redis wrapper with graceful fallback
- `rate-limiter` — Simple and advanced rate limiting with request deduplication
- `product-rate-limiter` — Per-product usage limits tied to subscription tiers
- `encryption` — AES-256-GCM token encryption with scrypt key derivation
- `error-handler` — Standardized API error responses for Next.js
- `feature-gate` — Subscription-based feature access control
- `user-service` — Redis-based user and tier management
- `stripe` — Stripe checkout, webhooks, Playwright E2E helpers, and test mocks
- `pricing` — Pricing tier analysis with margin enforcement
- `branded-types` — TypeScript branded types: CommitHash, SemanticVersion, Percentage
- `type-guards` — Type-safe narrowing utilities
- `env-resolver` — Multi-source API key resolution with caching
- `quality-standards` — Quality level definitions and exit criteria
- `agent-configs` — Reusable agent spawn configurations
