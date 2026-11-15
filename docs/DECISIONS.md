# Decision Log

Append only. Add one entry at the end for each decision about scope, architecture, contracts, process or dependencies. If two entries conflict in git, keep both.

### D-000: Team process
- **Date:** TBD · **Status:** Proposed (Accepted once all three confirm on the planning call)
- **Decision:** Use this template's protocol: files are truth, WhatsApp pings with commit hashes, one writer per file, M3's features merge dark behind flags with V0/V1/V2 verification, shared `main` branch, contract freeze, cut line at T-90.
- **Reason:** Removes waiting for M3, prevents merge conflicts, keeps M1/M2 attention on the MVP.
- **Consequences:** Flag-off code must be inert. M3 must produce verification evidence.

### D-001: QurbaniOS Technology Stack & Domain Model
- **Date:** 2026-11-15 · **Status:** Accepted · **Decided by:** Team (M1, M2, M3)
- **Decision:** Use React + Vite + Tailwind CSS for frontend, NestJS + Fastify + Prisma + PostgreSQL for backend. Models represent Programmes, Households, Participants, Animals, Allocations, Volunteers, Tasks, Payments, and Distributions.
- **Reason and trade-offs:** Provides rapid development, strong type safety end-to-end, and high performance via Fastify adapter.
- **Affected files:** `docs/ARCHITECTURE.md`, `docs/DATABASE-SCHEMA.md`, `docs/API-CONTRACT.md`, `docs/FRONTEND-NEEDS.md`

### D-002: Git Manager & Upstream Features Workflow Integration
- **Date:** 2026-11-15 · **Status:** Accepted · **Decided by:** Git Manager
- **Decision:** Incorporate `docs/Features_workflow.md` from `origin/main` into the project baseline and rebase setup documentation commits directly on top of `origin/main`.
- **Reason and trade-offs:** Keeps repo history clean and ensures all team members have immediate access to the full SaaS and role specification document.
- **Affected files:** `docs/Features_workflow.md`, `docs/DECISIONS.md`, Git branch history

### D-003: M2 REST field conventions
- **Date:** 2026-11-15 · **Status:** Accepted · **Decided by:** M2 with project owner direction
- **Decision:** Use the existing API contract's opaque string IDs, ISO 8601 `registrationOpensAt` and `registrationClosesAt`, money as `{ amountMinor, currency }` with INR for the programme, integer grams for distribution, and XLSX/PDF report exports. Distribution states are `draft`, `confirmed`, `packed`, `collected`, and `delivered`, with cancellation handled by the documented committee action. Use method and path to identify endpoints in mocks. Batch allocation remains a proposed additive endpoint.
- **Reason and trade-offs:** Align backend implementation and frontend mocks with the published draft and use exact integer units for financial and inventory accounting.
- **Consequences:** M1 can align its notes and mocks to these conventions. The full contract remains subject to its existing reconciliation and change rules.

### D-004: Scope Approval for EF-03 (Financial Intelligence)
- **Date:** 2026-11-15 · **Status:** Accepted · **Decided by:** M3 with Task Manager directive
- **Decision:** Advance EF-03 (Financial Intelligence) from Optional to Selected. Implemented as an isolated vertical slice in `enhancements/EF-03-financial-intelligence/` behind `FEATURE_EF_03` (default off), providing automated expense categorisation, financial anomaly detection, and reconciliation summaries via `/api/ext/EF-03/*`.
- **Reason and trade-offs:** Solves critical committee pain point regarding manual bookkeeping and reconciliation errors across participant payments and operational expenses, with low integration risk and zero MVP schema mutations.
- **Affected files:** `docs/EXTRA-FEATURE-PLAN.md`, `docs/TASKS/M3.md`, `enhancements/EF-03-financial-intelligence/`

### D-005: Brocoders-compatible Nest authentication
- **Date:** 2026-11-15 · **Status:** Accepted · **Decided by:** Project owner
- **Decision:** QurbaniOS uses the Brocoders authentication HTTP contract at `/api/v1`, with Nest-issued JWTs and rotating refresh tokens. Email is confirmed through Nest mail links. Continue with Google uses the Google Identity Services popup and Nest verification of the Google credential.
- **Reason and trade-offs:** Align the API with the authentication handoff sent to M1 while retaining the NestJS 12, Fastify and Prisma backend.
- **Affected files:** `backend/FRONTEND-AUTH.md`, `docs/API-CONTRACT.md`, `docs/ARCHITECTURE.md`, backend auth and Prisma migrations.
