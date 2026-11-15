# QurbaniOS backend (M2)

Fastify REST API with Nest-issued sessions, Prisma and PostgreSQL. See the
[API contract](../docs/API-CONTRACT.md) and [SPA sign-in guide](FRONTEND-AUTH.md).

## Local checks

Use Node.js 24. From `backend/`:

```sh
npm ci
npm run build
npm run typecheck
npm run lint
npm test
npm run smoke:workflow
```

The smoke test applies all migrations to an isolated, in-memory PostgreSQL
instance on a loopback port. It uses synthetic accounts, captured email and a
stub for Google credential verification. It covers authentication, tenant
isolation and the annual programme workflow through closure.

## Run against PostgreSQL

Copy `.env.example` to `.env` and set the database URLs,
`JWT_ACCESS_SECRET`, `FRONTEND_URL` and `ALLOWED_ORIGINS`. Configure SMTP for
actual confirmation, recovery and invitation messages. Set
`GOOGLE_OAUTH_ENABLED=true` and `GOOGLE_CLIENT_ID` for Google popup testing.
Keep the database connection and SMTP credentials on the backend.

```sh
npm run prisma:migrate:deploy
npm run prisma:seed
npm run start:dev
```

The seed installs roles and permissions. To provision the first Super Admin,
confirm the intended mailbox, then run `npm run bootstrap:admin` against the
configured environment. Use a dedicated database for shared testing.

The default health and Swagger URLs are `GET /api/v1/health` and `/api/v1/docs`.

## Deployment

`Dockerfile` is built from the `backend/` directory. Inject environment settings
at runtime. Run the Prisma migration and seed as a release step before starting
the API, then check health and sign in from the deployed SPA. Use a retained
previous application image for a compatible application rollback and preserve
the database backups for schema recovery. The shared backend URL and real
provider checks remain pending.
