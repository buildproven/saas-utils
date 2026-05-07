# saas-utils

Production-grade utility module library for SaaS backends. 14 independent modules covering rate limiting, encryption, caching, Stripe integration, auth, and more. Built for Next.js + Upstash Redis + Stripe.

## Key Commands

```bash
npm test          # vitest run — all tests
npm run build     # tsc — compile to dist/
npm run dev       # tsc --watch — rebuild on change
```

## Architecture

Each module lives in `src/` as a self-contained directory (or file) with its own `index.ts`. Modules export through `package.json` exports map for subpath imports (`saas-utils/logger`, `saas-utils/rate-limiter`, etc.).

```
src/
  logger/index.ts
  cache/index.ts
  rate-limiter/index.ts
  product-rate-limiter/index.ts
  encryption/index.ts
  error-handler/index.ts
  feature-gate/index.ts
  user-service/index.ts
  stripe/index.ts
  pricing/index.ts
  branded-types.ts
  type-guards/index.ts
  env-resolver.ts
  quality-standards/index.ts
  index.ts              # barrel re-exports
```

Tests are co-located (`*.test.ts` next to source). Config: `vitest.config.ts`.

TypeScript 5.3, compiled to `dist/`. tsconfig extends a parent config with `rootDir: ./src`, `outDir: ./dist`.

## Module List

| Module | Purpose |
|--------|---------|
| **logger** | Structured logging with module context and log levels |
| **cache** | Redis wrapper (Upstash) with graceful fallback |
| **rate-limiter** | Simple + advanced rate limiting with request dedup |
| **product-rate-limiter** | Per-product usage limits tied to subscription tiers |
| **encryption** | AES-256-GCM token encryption/decryption |
| **error-handler** | Standardized API error responses for Next.js |
| **feature-gate** | Subscription-based feature access control |
| **user-service** | Redis-based user and tier management |
| **stripe** | Checkout, webhooks, and Playwright test helpers |
| **pricing** | Pricing tier analysis with margin enforcement |
| **branded-types** | TypeScript branded types (CommitHash, SemanticVersion, Percentage) |
| **type-guards** | Type-safe narrowing utilities |
| **env-resolver** | Multi-source API key resolution with caching |
| **quality-standards** | Quality level definitions and exit criteria |

## Conventions

- **Commits**: Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Branches**: Feature branches only. Never commit directly to main.
- **Types**: No `any`. Use specific TypeScript types. Branded types available in `src/branded-types.ts`.
- **Linting**: No eslint-disable. Fix at root cause.
- **Dependencies**: `@upstash/redis` and `zod` are runtime deps. `next` is a peer dep. `stripe` is a dev/optional dep.
- **License**: Commercial. Not open source. See LICENSE file.
- **Version**: 0.1.0 (pre-release). API may change before 1.0.

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Module directories | kebab-case | `rate-limiter/`, `feature-gate/` |
| Functions | camelCase | `createRateLimiter`, `handleApiError` |
| Types/Interfaces | PascalCase | `CommitHash`, `SemanticVersion` |
| True constants | UPPER_SNAKE_CASE | — |
| Exports | each module exports from its `index.ts` | — |

- Use `zod` for runtime validation. Use `@upstash/redis` for all Redis operations.
- Use `error-handler` module patterns for API responses. Throw typed errors, catch at boundaries.
- Do not add open-source license headers — commercial project.

## Project Structure Details

```
saas-utils/
  src/
    index.ts                        # Barrel re-exports
    branded-types.ts                # Standalone module (no directory)
    branded-types.test.ts
    env-resolver.ts                 # Standalone module (no directory)
    utils.test.ts
    logger/index.ts                 # Directory-based modules
    ...
    agent-configs/index.ts          # Internal config module
    workflow-patterns/index.ts      # Internal workflow module
  dist/                             # Compiled output (gitignored)
  package.json
  tsconfig.json                     # Extends parent tsconfig; rootDir ./src, outDir ./dist
  vitest.config.ts
```

Tests excluded from build (`**/*.test.ts` in tsconfig exclude). Consumers import via subpath exports: `import { createRateLimiter } from 'saas-utils/rate-limiter'`.

## Testing Guidelines

- **Co-located tests**: Place `*.test.ts` files next to the source they test (`src/branded-types.test.ts`)
- **Framework**: Vitest (v1.x). Use `describe`/`it`/`expect`.
- **No live services in unit tests**: Mock Redis (`@upstash/redis`), Stripe, and external APIs. Use dependency injection.
- **Test file naming**: `<module-name>.test.ts` or `index.test.ts` inside module directory
- **Coverage**: Every exported function needs at least one happy-path and one error-path test
- **Stripe module**: Has dedicated Playwright test helpers (`src/stripe/testing.ts`) for E2E checkout. Unit tests should mock Stripe SDK.
- `npm test` must pass before committing. No `it.skip` on main branch.
