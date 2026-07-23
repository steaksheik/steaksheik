# Dark Kitchen Platform — Platform Foundation

Enterprise, **configuration-first**, **multi-tenant** commerce backend. This sprint
delivers the platform foundation — no customer-facing storefront UI yet. Everything
is exposed as a versioned REST API under `/api/v1`.

## Core subsystems

| Subsystem | Location | Notes |
|-----------|----------|-------|
| Configuration Framework | `lib/config/*` | Hierarchical (platform → tenant) JSONB config, Zod validation, cache + pub/sub invalidation, secret encryption |
| Event Bus | `lib/events/*` | Transactional outbox, QStash delivery (inline fallback), idempotent webhook handlers, signature verification |
| Plugin Architecture | `lib/plugins/*` | 12 service adapters, circuit breakers, graceful fallbacks, health checks, encrypted credential vault, connection testing |
| Feature Flags | `lib/feature-flags/*` | Boolean / percentage-rollout / variant flags with tenant overrides |
| Identity & RBAC | `lib/auth/*` | Session auth (Redis-backed w/ in-memory fallback), roles & `module:resource:action` permissions, bcrypt hashing |
| Audit Logging | `lib/audit/*` | Structured, queryable audit trail |
| Security | `lib/security/*` | CSRF (double-submit), sliding-window rate limiting, security headers/CSP, AES-256-GCM crypto |

## Getting started

```bash
cp .env.example .env   # fill in values
yarn prisma generate
yarn prisma db push
yarn prisma db seed
yarn dev
```

The seed creates a default tenant, the full permission catalog, five system roles,
platform default configuration, and the default feature flags.

## API surface (v1)

- `GET /api/health`, `GET /api/v1/health`, `GET /api/v1/health/services`
- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session`, `POST /api/v1/auth/password/change`
- `GET /api/v1/config/:module`, `GET|PUT|DELETE /api/v1/config/:module/:key`, `GET /api/v1/config/public/:module`
- `GET|POST /api/v1/feature-flags`, `GET|PUT|DELETE /api/v1/feature-flags/:key`, `PUT|DELETE /api/v1/feature-flags/:key/override`
- `GET|POST /api/v1/users`, `GET|PUT|DELETE /api/v1/users/:id`, `GET|POST /api/v1/users/:id/roles`, `DELETE /api/v1/users/:id/roles/:roleId`
- `GET|POST /api/v1/roles`, `GET|PUT /api/v1/roles/:id`, `GET /api/v1/permissions`
- `GET /api/v1/services`, `GET|PUT /api/v1/services/:type`, `POST /api/v1/services/:type/test`, `POST /api/v1/services/:type/toggle`
- `POST /api/v1/events/:handler` (inbound webhook), `POST /api/v1/events/relay` (CRON)
- `GET /api/v1/audit-logs`, `GET /api/v1/audit-logs/:id`
- `GET /api/v1/storefront/config` (public bootstrap)

All responses use a consistent envelope: `{ success, data, meta }` on success and
`{ success:false, error:{ code, message, requestId } }` on failure.

## External services

Redis, QStash and third-party provider credentials are **optional**. When unset, the
platform uses in-memory / local / console fallbacks so the system stays fully
operational in development. To enable real services set the corresponding variables
in `.env` (see `.env.example`): `UPSTASH_REDIS_REST_URL/TOKEN`, `QSTASH_TOKEN`,
`QSTASH_CURRENT_SIGNING_KEY`, and per-service credentials via the
`PUT /api/v1/services/:type` endpoint (stored encrypted).
