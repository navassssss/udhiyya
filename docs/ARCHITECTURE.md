# Architecture

Status: DRAFT v0 · Owner: M2

## Proposed baseline

Use the parent authentication starter for the NestJS REST API, ESM, Prisma/PostgreSQL and Vitest. Source and lockfile from starter commit `db7a191` are imported into `backend/`. QurbaniOS serves the Brocoders HTTP auth contract on Fastify and reuses the existing password, Google verification and rotating session services. See the [frontend auth contract](../backend/FRONTEND-AUTH.md). Legacy cookie mode uses Express for starter compatibility. Review starter routes and permissions before exposing them, especially organisation creation, invitation and platform admin access.

| Path | Responsibility |
|---|---|
| `frontend/` | M1 React + Vite + TypeScript client-rendered SPA with Tailwind. Calls the separate NestJS REST API. |
| `backend/` | M2 API, data access, migrations and tests. |
| `enhancements/` | M3 feature modules behind flags. |
| `shared/` | Shared assets if agreed by the team. |

## Request flow

The browser signs in through the Nest email route or sends a Google Identity Services credential to Nest. Nest verifies credentials, issues an access JWT and rotates an opaque refresh token. The Google subject is linked to the local profile after provider verification. Platform routes check server-assigned platform permissions. Committee routes resolve the requested organisation, current membership and workspace state, then constrain Prisma queries to that organisation. Platform admin access covers platform operations. Exceptional support access requires scoped authorization and audit.

Anonymous programme routes look up the organisation and year and serve an explicit public projection for active organisations and published programmes. App data flows through Nest. The browser accesses programme tables through the Nest REST API. If using Supabase as PostgreSQL host, keep app tables outside its Data API.

Reuse the starter's auth, identity mapping, organisation membership, validation, error filter and health infrastructure. Adapt the competition starter's notification and payment integrations at the service boundary. M2 records and verifies core payment activity. Razorpay checkout depends on the optional scope decision in the workflow. Provider-specific order identifiers must map to programme records before checkout is adopted.

## Integration and rollout

Set `AUTH_MODE=brocoders`, `API_PREFIX=api/v1`, `JWT_ACCESS_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `FRONTEND_URL` and `ALLOWED_ORIGINS`. Configure the Google popup with `GOOGLE_OAUTH_ENABLED` and `GOOGLE_CLIENT_ID`. Configure SMTP for real email delivery. The shared environment and live provider checks are pending.

Register optional modules in `backend/src/enhancements/enhancement-mount.module.ts`. The mount loads registered modules only when the corresponding `FEATURE_EF_XX=on`. The namespace is `/ext/<feature-id>` relative to the API base. Apply `EnhancementAccess` to controllers and send a scoped programme UUID and organisation context. Existing M3 controllers still require adaptation before registration. Frontend slots are owned by M1.

Use bounded pagination for organisation and programme lists. Index tenant-scoped lookups and keep publication, invitation acceptance and audit writes consistent under retry. Before deployment, verify onboarding through publication in two organisations, including suspended access, draft visibility and cross-tenant denial.
