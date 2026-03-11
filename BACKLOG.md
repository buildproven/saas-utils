# saas-utils Backlog

**Last updated**: 2026-03-10

## Scoring Formula

**Score = (Revenue + Retention + Differentiation) / Effort**

- Revenue, Retention, Differentiation: 1-5 each
- Effort: S=1, M=2, L=3, XL=4

---

## P0 — Ship Blockers

| ID | Item | Rev | Ret | Diff | Effort | Score | Status |
|----|------|-----|-----|------|--------|-------|--------|
| SU-001 | Comprehensive unit tests for all 14 modules | 4 | 5 | 3 | L | 4.0 | Not started |
| SU-002 | TypeDoc API reference generation | 3 | 4 | 3 | M | 5.0 | Not started |
| SU-003 | CI/CD pipeline (GitHub Actions: lint, test, build) | 4 | 5 | 2 | M | 5.5 | Not started |
| SU-004 | npm publish workflow (automated release on tag) | 5 | 4 | 2 | M | 5.5 | Not started |

## P1 — Next Wave

| ID | Item | Rev | Ret | Diff | Effort | Score | Status |
|----|------|-----|-----|------|--------|-------|--------|
| SU-005 | jwt-handler module (sign, verify, refresh rotation) | 5 | 4 | 3 | M | 6.0 | Not started |
| SU-006 | email-service module (Resend integration) | 4 | 4 | 3 | M | 5.5 | Not started |
| SU-007 | webhook queue/retry module (idempotent delivery) | 5 | 5 | 4 | L | 4.7 | Not started |
| SU-008 | usage-tracking module (metered billing) | 5 | 5 | 5 | L | 5.0 | Not started |
| SU-009 | audit-logging module (who did what, when) | 4 | 5 | 4 | M | 6.5 | Not started |
| SU-010 | Mock providers for all modules (test without live services) | 3 | 5 | 4 | L | 4.0 | Not started |

## P2 — Polish & Ecosystem

| ID | Item | Rev | Ret | Diff | Effort | Score | Status |
|----|------|-----|-----|------|--------|-------|--------|
| SU-011 | OpenTelemetry integration (tracing + metrics) | 3 | 4 | 4 | L | 3.7 | Not started |
| SU-012 | Tree-shaking analysis (verify no bundle bloat) | 2 | 3 | 2 | S | 7.0 | Not started |
| SU-013 | v1.0 release prep (API stability audit, semver guarantees) | 4 | 5 | 3 | M | 6.0 | Not started |
| SU-014 | Example SaaS app using all 14 modules | 3 | 4 | 5 | XL | 3.0 | Not started |
| SU-015 | Contract tests against Stripe/Upstash APIs | 3 | 5 | 4 | L | 4.0 | Not started |
