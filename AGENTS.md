# saas-utils — Agent Reference

## Project Structure & Module Organization

```
saas-utils/
  src/
    index.ts                        # Barrel re-exports
    branded-types.ts                # Standalone module (no directory)
    branded-types.test.ts
    env-resolver.ts                 # Standalone module (no directory)
    utils.test.ts
    logger/index.ts                 # Directory-based modules
    cache/index.ts
    rate-limiter/index.ts
    product-rate-limiter/index.ts
    encryption/index.ts
    error-handler/index.ts
    feature-gate/index.ts
    user-service/index.ts
    stripe/index.ts
    pricing/index.ts
    type-guards/index.ts
    quality-standards/index.ts
    agent-configs/index.ts          # Internal config module
    workflow-patterns/index.ts      # Internal workflow module
  dist/                             # Compiled output (gitignored)
  package.json
  tsconfig.json                     # Extends parent tsconfig
  vitest.config.ts
```

14 public modules. Each is independent — no cross-module imports required. Consumers import via subpath exports: `import { createRateLimiter } from 'saas-utils/rate-limiter'`.

Runtime dependencies: `@upstash/redis`, `zod`. Peer dependency: `next >= 14`. Optional: `stripe` (dev dep, needed only for stripe module).

## Build, Test, and Development Commands

| Command | What it does |
|---------|-------------|
| `npm test` | Run all tests with Vitest (`vitest run`) |
| `npm run build` | Compile TypeScript to `dist/` (`tsc`) |
| `npm run dev` | Watch mode — recompile on change (`tsc --watch`) |

- Test config: `vitest.config.ts` at project root
- TypeScript config: `tsconfig.json` extends `../../tsconfig.json`, rootDir `./src`, outDir `./dist`
- Tests excluded from build (`**/*.test.ts` in tsconfig exclude)

## Coding Style & Naming Conventions

- **TypeScript 5.3** — strict mode via parent tsconfig
- **No `any`** — use specific types. Branded types available in `src/branded-types.ts`
- **No `eslint-disable`** — fix lint errors at root cause
- **Exports**: Each module exports from its `index.ts`. Public API surfaced through `package.json` exports map.
- **Naming**:
  - Modules: kebab-case directories (`rate-limiter`, `feature-gate`)
  - Functions: camelCase (`createRateLimiter`, `handleApiError`)
  - Types/Interfaces: PascalCase (`CommitHash`, `SemanticVersion`)
  - Constants: camelCase or UPPER_SNAKE_CASE for true constants
- **Dependencies**: Use `zod` for runtime validation. Use `@upstash/redis` for all Redis operations.
- **Error handling**: Use `error-handler` module patterns for API responses. Throw typed errors, catch at boundaries.
- **Commits**: Conventional commits — `feat:`, `fix:`, `chore:`, `docs:`
- **Branches**: Feature branches only. No direct commits to main.
- **License**: Commercial. Do not add open-source license headers.

## Testing Guidelines

- **Co-located tests**: Place `*.test.ts` files next to the source they test (e.g., `src/branded-types.test.ts`)
- **Framework**: Vitest (v1.x). Use `describe`/`it`/`expect` from vitest.
- **No live services in unit tests**: Mock Redis (`@upstash/redis`), Stripe, and external APIs. Use dependency injection where modules accept client instances.
- **Test file naming**: `<module-name>.test.ts` or `index.test.ts` inside module directory
- **Coverage targets**: Aim for full coverage of public API surface. Every exported function should have at least one happy-path and one error-path test.
- **Stripe module**: Has dedicated Playwright test helpers (`src/stripe/testing.ts`) for end-to-end checkout flows. Unit tests should mock Stripe SDK.
- **Run tests before committing**: `npm test` must pass. No skipped tests (`it.skip`) in main branch.
