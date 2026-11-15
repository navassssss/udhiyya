# QurbaniOS — Consolidated Release Gaps & Verification Audit

**Generated:** 2026-11-15  
**Document:** `docs/VERIFICATION/REMAINING-RELEASE-GAPS.md`  
**Status:** COMPLETE CONSOLIDATED AUDIT  
**Scope:** Production Deployment, Razorpay, Share Modifications, Admin Controls, Universal Interaction Audit  

---

## 1. Executive Summary & Verification Classifications

| # | Focus Area | Status Classification | Key Findings | Affected Files | Outstanding Dependencies |
|---|---|---|---|---|---|
| 1 | **Production Deployment (Vercel + Render)** | **Partially implemented** | Local Fastify NestJS + Postgres dev runs on port 3000 & 51214. Render deployment was blocked by `/api/v1` prefix desynchronization and missing `ALLOWED_ORIGINS` CORS configuration for Vercel origins. | `backend/src/main.ts`<br>`backend/src/config/app.config.ts`<br>`render.yaml`<br>`frontend/src/services/auth/jwt.adapter.ts` | Set `ALLOWED_ORIGINS` in Render env and match API prefix in `VITE_API_BASE_URL`. |
| 2 | **Razorpay Payment Integration** | **Missing** | Cash payments and committee verification are fully operational with receipt generation and balance updates. Real Razorpay test-mode SDK bindings (`POST /payments/razorpay/order`, client checkout, HMAC verification, webhook listener) are not yet implemented. | `backend/src/finance/finance.service.ts`<br>`frontend/src/components/app/ParticipantWorkspace.tsx`<br>`frontend/src/services/backend.adapter.ts` | Razorpay Key ID / Key Secret; backend order creation & webhook endpoint. |
| 3 | **Share Modification Workflow** | **Missing** | Registrations can be approved, rejected, or cancelled. Dynamic participant share count modification post-submission (request -> pending queue -> committee decision -> capacity/financial recalculation) lacks backend endpoints and Prisma models. | `backend/prisma/schema.prisma`<br>`backend/src/registration/registration.service.ts`<br>`frontend/src/components/app/ParticipantWorkspace.tsx` | `ShareModificationRequest` schema model; `/me/registration/modification-request` API. |
| 4 | **Administrative Controls** | **Implemented and verified** (Core workflows)<br>**Partially implemented** (Platform toggles) | All core Mahallu administration controls (programme setup, registration approval/rejection, animal procurement, group creation, share allocation, ground operations progress, payment verification, cash collection tasks) persist to PostgreSQL and enforce backend RBAC. Global user directory and platform settings UI remain mock-backed. | `backend/src/registration/registration.controller.ts`<br>`backend/src/finance/finance.controller.ts`<br>`backend/src/animals/animals.controller.ts`<br>`frontend/src/components/app/AdminWorkspace.tsx` | Wire `GET /users` and `GET /audit-logs` into `SuperAdminWorkspace.tsx`. |
| 5 | **Universal Interaction Audit** | **Implemented and verified** | Resolved all 4 user-reported UI breaks (login recovery tab removed, notification clutter removed from dashboards, "Add sample record" cleaned up, review drawer empty rows filtered). Fixed participant white-screen bug and `/process` 404. | `frontend/src/pages/LoginPage.tsx`<br>`frontend/src/components/app/VolunteerWorkspace.tsx`<br>`frontend/src/components/app/ParticipantWorkspace.tsx`<br>`frontend/src/components/app/AdminWorkspace.tsx`<br>`frontend/src/router.tsx` | None. |

---

## 2. In-Depth Technical Audits

### Area 1: Production Deployment (Vercel to Render)
- **Status:** **Partially implemented**
- **Analysis:**
  - In commit `953bdfb`, M2 switched Render to `AUTH_MODE: brocoders` and `API_PREFIX: api/v1`.
  - When the frontend dispatched `POST /auth/register` to Render, the server returned **404 Not Found** because the Brocoders route is `/api/v1/auth/email/register`.
  - Furthermore, `backend/src/main.ts` enforces strict CORS:
    ```typescript
    if (appCfg.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS'), false);
    ```
    If `ALLOWED_ORIGINS` in Render environment variables is empty or does not include `https://udhiyya.vercel.app` and preview URLs (`https://udhiyya-*.vercel.app`), the browser's preflight OPTIONS request fails.
- **Evidence from Local Environment:**
  - Local backend is active on `http://localhost:3000` with PostgreSQL on `localhost:51214`.
  - Health endpoint output:
    ```json
    { "status": "ok", "database": "connected", "uptimeSeconds": 238 }
    ```
  - Authenticated login for `muhammedparad0485@gmail.com` succeeds with HTTP 200 and issues full JWT token.

---

### Area 2: Razorpay Payment Integration
- **Status:** **Missing**
- **Analysis:**
  - Cash submission, volunteer cash task assignment, committee payment verification, rejection with reason, receipt issuance, and ledger recalculation are 100% operational in PostgreSQL.
  - Razorpay checkout, server-side order generation (`POST /v1/orders`), client-side popup checkout, HMAC-SHA256 signature verification (`X-Razorpay-Signature`), and webhook callback handling (`payment.captured`) are not yet written into `finance.module.ts`.
- **Requirements to close:**
  1. Add `@razorpay/razorpay` to backend dependencies.
  2. Implement `POST /finance/razorpay/order` and `POST /finance/razorpay/verify`.
  3. Wire Razorpay checkout script into `ParticipantWorkspace.tsx`.

---

### Area 3: Share Modification Workflow
- **Status:** **Missing**
- **Analysis:**
  - Currently, `Registration.shares` is set at submission. If a participant needs to change from 1 to 2 shares or vice versa, the committee must cancel the registration and the participant must resubmit.
  - No `ShareModificationRequest` table exists in `schema.prisma`.
- **Requirements to close:**
  1. Add `ShareModificationRequest` model (`id, registrationId, requestedShares, status, reason, feeDeltaMinor`).
  2. Implement `POST /me/registration/modification-request` and committee approval endpoint `POST /registrations/modifications/:id/decision`.

---

### Area 4: Administrative Controls & Backend Persistence
- **Status:** **Implemented and verified** (Core workflows)
- **Verified Capabilities:**
  - **Programme Setup:** Updates persist to `Programme` table; publishing gates enforced.
  - **Registration Review:** Approve, reject, and cancel actions update database and record audit logs.
  - **Financial Management:** Verified payments recalculate outstanding balances; receipts issued atomically.
  - **Cash Task Assignment:** Committee assigns collection tasks to volunteers (`VolunteerTask`); volunteer submissions enter pending audit queue.
  - **Animal Management:** Animal procurement, weight, share capacity, group creation, and allocation constraints enforced.
- **Remaining Admin Gaps:**
  - `SuperAdminWorkspace.tsx` uses mock data for the Global User list and Platform Settings.

---

### Area 5: Universal Interaction Audit Reconciled
- **Status:** **Implemented and verified**
- **Reconciliation Summary:**
  1. **Login Mode Tabs:** Removed "Recovery" tab; only "Sign in" and "Register" displayed. "Forgot password?" is the sole password reset entry.
  2. **Notification Confinement:** Removed "Committee instructions" from `/volunteer/home` and `/participant/overview`. All notifications are strictly displayed in dedicated tabs (`/volunteer/updates`, `/participant/updates`, `/admin/communication`).
  3. **"Add sample record" Modal:** Replaced with dynamic titles (`New <Entity>`), replaced unapproved `"Public beneficiary"` with `"Community quota"`.
  4. **Review Drawer Rows:** Filtered out empty/dash fields; only populated, meaningful fields are rendered.
  5. **Participant Blank Screen:** Added fallback to `useAuth().profile` when demo state is empty.
  6. **Public Route 404:** Added `/process` route to `router.tsx`.
