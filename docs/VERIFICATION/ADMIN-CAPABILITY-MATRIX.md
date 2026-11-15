# Admin Capability Matrix Report: QurbaniOS

**Document:** `docs/VERIFICATION/ADMIN-CAPABILITY-MATRIX.md`  
**Author:** Subagent B — Admin Capability Researcher  
**Status:** COMPLETE AUDIT  
**Date:** 2026-11-15  

---

## Executive Summary

An exhaustive audit of the QurbaniOS codebase was conducted across requirements (`docs/PROJECT.md`, `docs/Features_workflow.md`, `docs/API-CONTRACT.md`), the Prisma schema (`backend/prisma/schema.prisma`), NestJS backend controllers/services (`backend/src/`), and frontend admin components (`frontend/src/components/app/AdminWorkspace.tsx`, `SuperAdminWorkspace.tsx`, `ProgrammeSetupSection.tsx`, `router.tsx`, `backend.adapter.ts`).

### Overall Classification Counts:
- **Total Capabilities Audited:** 20 (14 Committee Admin, 6 Super Admin)
- **Working (Full End-to-End):** 11 capabilities (55%)
- **Partially Implemented (Backend complete or mock fallback in UI):** 3 capabilities (15%)
- **Missing Frontend (Backend built, UI missing):** 2 capabilities (10%)
- **Missing Backend (UI mock exists, backend missing):** 2 capabilities (10%)
- **Missing Both / Requires Product Decision:** 2 capabilities (10%)

---

## 1. Capability Matrix Master Table

| ID | Capability Name | Role | Scope | Classification | Backend Controller & Endpoint | Frontend Component & Route | Database Models | Priority |
|---|---|---|---|---|---|---|---|---|
| **CA-01** | Programme Management | Committee Admin | Programme | **Working** | `ProgrammesController`<br>`GET/POST/PATCH /organisations/:orgId/programmes`<br>`POST .../publish`, `POST .../close` | `ProgrammeSetupSection.tsx`<br>`AdminWorkspace.tsx:965`<br>`/admin/programme-setup` | `Programme`, `Organization` | **P0** |
| **CA-02** | Registration Review & Decisioning | Committee Admin | Programme | **Working** | `CommitteeRegistrationController`<br>`GET .../registrations`<br>`POST .../registrations/:id/decision` | `AdminWorkspace.tsx:841, 1302`<br>`/admin/participants`<br>`/admin/registrations/:id` | `Registration`, `ApplicantHousehold`, `ParticipationOption` | **P0** |
| **CA-03** | Share-Change Approvals | Committee Admin | Programme | **Missing both / Product decision** | *None* (No controller/endpoint for post-submission share changes) | *None* (Only full cancel/approve/reject available) | `Registration.shares` is static; no `ShareChangeRequest` model | **P2** |
| **CA-04** | Financial Management & Expenses | Committee Admin | Programme | **Working** | `FinanceController`<br>`GET .../finance/summary`<br>`GET/POST/PATCH .../expenses`<br>`GET/POST/PATCH .../expense-categories` | `AdminWorkspace.tsx:968, 144`<br>`/admin/finance`<br>`/admin/expenses` | `Expense`, `ExpenseCategory`, `Payment`, `Receipt` | **P0** |
| **CA-05** | Cash Task Assignment | Committee Admin | Programme | **Working** | `CommitteeOperationsController`<br>`GET/POST/PATCH .../tasks`<br>`VolunteerOperationsController`<br>`POST .../volunteer/cash-submissions` | `AdminWorkspace.tsx:957, 1444`<br>`/admin/volunteers`<br>Task Modal (`dept === "Finance"`) | `VolunteerTask`, `Volunteer`, `Payment`, `Registration` | **P0** |
| **CA-06** | Payment Verification & Receipts | Committee Admin | Programme | **Working** | `FinanceController`<br>`GET/POST .../payments`<br>`POST .../payments/:id/verification`<br>`GET .../receipts/:id` | `AdminWorkspace.tsx:868, 1013, 1399`<br>`/admin/payments`<br>`/admin/finance` | `Payment`, `Receipt`, `Registration`, `UserNotification` | **P0** |
| **CA-07** | Animal Procurement & Registration | Committee Admin | Programme | **Working** | `AnimalsController`<br>`GET/POST/PATCH .../animals` | `AdminWorkspace.tsx:95, 444, 851`<br>`/admin/animals` | `Animal`, `Programme` | **P0** |
| **CA-08** | Animal Group Creation | Committee Admin | Programme | **Working** | `AnimalsController`<br>`GET/POST/PATCH .../groups` | `AdminWorkspace.tsx:113, 452, 863`<br>`/admin/groups` | `AnimalGroup`, `Animal`, `Programme` | **P0** |
| **CA-09** | Share Allocation Engine | Committee Admin | Programme | **Working** | `AnimalsController`<br>`GET/POST .../share-allocations`<br>`DELETE .../share-allocations/:id` | `AdminWorkspace.tsx:335, 605, 1371`<br>`/admin/groups` (Modal & Smart Alloc button) | `ShareAllocation`, `AnimalGroup`, `Registration` | **P0** |
| **CA-10** | Processing Tracking & Operations | Committee Admin | Programme | **Working** | `CommitteeOperationsController`<br>`GET/POST/PATCH .../schedules`<br>`GET .../operations`<br>`POST .../volunteer/operations/:id/progress` | `AdminWorkspace.tsx:191, 1057, 1419`<br>`/admin/operations`<br>`/admin/scheduling` | `Schedule`, `ScheduleMember`, `Animal`, `OperationIssue` | **P0** |
| **CA-11** | Distribution Windows, Queue & Policies | Committee Admin | Programme | **Partially implemented** | `CommitteeDistributionController`<br>`GET/PUT .../distribution/policy`<br>`GET .../distribution/inventory`<br>`GET/POST .../distribution/allocations`<br>`POST .../allocations/:id/transition`<br>`GET/POST/PATCH .../collection-windows` | `AdminWorkspace.tsx:214, 1110`<br>`/admin/distribution`<br>`/admin/distribution-setup` | `DistributionPolicy`, `DistributionAllocation`, `CollectionWindow`, `Beneficiary` | **P1** |
| **CA-12** | Volunteer Management & Roles | Committee Admin | Programme | **Working** | `CommitteeOperationsController`<br>`GET/POST/PATCH .../volunteers` | `AdminWorkspace.tsx:166, 913, 941`<br>`/admin/volunteers` | `Volunteer`, `ScheduleMember`, `VolunteerTask`, `User` | **P0** |
| **CA-13** | Announcements, Notices & Enquiries | Committee Admin | Programme | **Partially implemented** | `CommitteeCommunicationsController`<br>`GET/POST .../announcements`<br>`POST .../announcements/:id/publish`<br>`POST .../notifications`<br>`GET .../enquiries` | `AdminWorkspace.tsx:232, 471, 898`<br>`/admin/communication` | `Announcement`, `NotificationDispatch`, `NotificationEmail`, `ProgrammeEnquiry` | **P1** |
| **CA-14** | Organisation Settings & Member Mgmt | Committee Admin | Organisation | **Missing frontend** | `OrganizationsController`<br>`GET/PATCH /organizations/:id`<br>`GET /organizations/:id/members`<br>`POST .../invitations`<br>`PATCH .../members/:userId/roles` | *None* (Omitted from `adminNav` in `PortalShell.tsx:38-85`) | `Organization`, `OrganizationMember`, `OrganizationMemberRole`, `OrganizationInvitation` | **P1** |
| **SA-01** | Organisation Onboarding | Super Admin | Platform | **Working** | `PlatformOrganisationsController`<br>`POST /platform/organisations`<br>`POST .../invitations` | `SuperAdminWorkspace.tsx:96, 544`<br>`/super-admin/organisations`<br>`/super-admin/dashboard` | `Organization`, `OrganizationInvitation`, `User`, `AuditLog` | **P0** |
| **SA-02** | Organisation Activation / Suspension | Super Admin | Platform | **Working** | `PlatformOrganisationsController`<br>`GET/PATCH /platform/organisations/:id`<br>(status: onboarding, active, suspended, closed) | `SuperAdminWorkspace.tsx:263, 290`<br>`/super-admin/organisations`<br>`/super-admin/organisations/:id` | `Organization`, `AuditLog` | **P0** |
| **SA-03** | Global User Management | Super Admin | Platform | **Missing frontend** | `UsersController`<br>`GET /users`, `GET /users/:id`<br>`PATCH /users/:id/status`<br>`DELETE /users/:id`<br>`RolesController`<br>`POST/DELETE /users/:id/roles` | *None* (`SuperAdminWorkspace.tsx:378` only shows mock Committee Admins) | `User`, `UserRole`, `Role`, `Session`, `AuditLog` | **P1** |
| **SA-04** | Platform-Wide Settings | Super Admin | Platform | **Missing backend / Product decision** | *None* (No `PlatformSettings` controller or Prisma model) | `SuperAdminWorkspace.tsx:430`<br>`/super-admin/settings` (DemoStore only) | *None* in schema | **P2** |
| **SA-05** | Global Feature Toggles & Plans | Super Admin | Platform / Org | **Missing backend** | *None* (`GET/PATCH /platform/organisations/:id/features` missing from `PlatformOrganisationsController`) | `SuperAdminWorkspace.tsx:407`<br>`/super-admin/features`<br>(Calls `mockClient`) | `Organization` lacks `features`/`plan` column | **P2** |
| **SA-06** | Security & System Health Monitoring | Super Admin | Platform | **Partially implemented** | `HealthController`<br>`GET /health`<br>`AuditController`<br>`GET /audit-logs`<br>`GET /organizations/:id/audit-logs` | `SuperAdminWorkspace.tsx:525`<br>`/super-admin/activity`<br>(Uses DemoStore; `/health` not polled) | `AuditLog` | **P1** |

---

## 2. Detailed Findings by Capability

### Committee Admin (Mahallu Administration)

#### 1. Programme Management (CA-01) — Working (P0)
- **Backend Evidence:** `backend/src/programmes/programmes.controller.ts:24-82` (`ProgrammesController`), `programmes.service.ts:1-250`. Routes handle CRUD, publishing checks (required description, guidelines, price, dates, capacity), and formal programme closure (`POST .../close`).
- **Frontend Evidence:** `frontend/src/components/app/ProgrammeSetupSection.tsx:1-456`, mounted in `AdminWorkspace.tsx:965-967` under `/admin/programme-setup`. Calls live endpoints via `programmeAdapter` / `programmeApi`.
- **Database:** `Programme` (`backend/prisma/schema.prisma:370-411`) with relations to `Organization`, `ParticipationOption`, `Registration`, etc.
- **Fix/Recommendation:** Wire the closure confirmation modal in `AdminWorkspace.tsx:1547-1563` to trigger `POST /organisations/:orgId/programmes/:programmeId/close` directly.

#### 2. Registration Review & Decisioning (CA-02) — Working (P0)
- **Backend Evidence:** `backend/src/registration/registration.controller.ts:43-85`, `registration.service.ts:130-220`. Endpoints handle listing with pagination, viewing application details, and atomic decision transitions (`approve`, `reject`, `cancel`) with audit logs and auto-generated notifications.
- **Frontend Evidence:** `AdminWorkspace.tsx:841-850, 1302-1318, 1359-1370`. Approve, reject with reason modal, and cancel registration buttons call `registrationAdapter.decide(...)` (`backend.adapter.ts:186-200`).
- **Database:** `Registration` (`schema.prisma:471-503`), `ApplicantHousehold`, `ParticipationOption`, `Receipt`.

#### 3. Share-Change Approvals (CA-03) — Missing Both / Product Decision (P2)
- **Backend Evidence:** No controller endpoint or DTO exists in `backend/src/registration/` or `backend/src/animals/` for requesting or approving modifications to `Registration.shares`.
- **Frontend Evidence:** In `AdminWorkspace.tsx:1353`, editing a record allows changing the shares field in the client-side `DemoStore`, but no backend request is dispatched.
- **Database:** `Registration.shares` is an immutable integer set on submission. No `ShareChangeRequest` table or audit trail exists.
- **Recommendation:** Product decision needed:
  1. Standard workflow: Committee cancels previous registration and participant submits new registration with correct shares.
  2. Enhanced workflow: Create `ShareChangeRequest` model (`id, registrationId, requestedShares, status: pending|approved|rejected, feeDeltaMinor`) and endpoint `POST .../registrations/:id/share-change`.

#### 4. Financial Management & Expenses (CA-04) — Working (P0)
- **Backend Evidence:** `backend/src/finance/finance.controller.ts:41-126`, `finance.service.ts`. Endpoints provide financial summary aggregates (expected, verified, outstanding, expenses), category CRUD, and expense logging with currency/minor units.
- **Frontend Evidence:** `AdminWorkspace.tsx:968-1055` (`section === "finance"`), `144-165` (`expenses`). Calls `financeAdapter.summary`, `financeAdapter.createExpense`, `financeAdapter.categories`.
- **Database:** `Expense`, `ExpenseCategory`, `Payment`, `Receipt` (`schema.prisma:575-645`).

#### 5. Cash Task Assignment (CA-05) — Working (P0)
- **Backend Evidence:** `backend/src/operations/operations.controller.ts:82-104` (`postTasks`), `257-263` (`postCashSubmissions`). Supports assigning finance tasks with `resourceId = registrationId` and volunteer cash submissions linked to `cashAssignmentId`.
- **Frontend Evidence:** `AdminWorkspace.tsx:957-961, 1444-1546`. Dedicated modal branch for `taskDepartment === "Finance"` automatically binds volunteer, participant with unpaid balance, and calls `operationsAdapter.createTask(...)` (`backend.adapter.ts:378-393`).
- **Database:** `VolunteerTask`, `Volunteer`, `Payment.cashAssignmentId` (`schema.prisma:587-590, 731-750`).

#### 6. Payment Verification & Receipts (CA-06) — Working (P0)
- **Backend Evidence:** `backend/src/finance/finance.controller.ts:51-74, 151-157`. Provides verification (`action: verify | reject`), atomic receipt generation on verification, idempotency checking, and receipt inspection.
- **Frontend Evidence:** `AdminWorkspace.tsx:868-897, 1013-1041, 1320-1340, 1399-1418`. Verification table, reject with prompt reason, and printable receipt preview. Calls `financeAdapter.verifyPayment`.
- **Database:** `Payment`, `Receipt`, `UserNotification` (`schema.prisma:575-618`).

#### 7. Animal Procurement & Registration (CA-07) — Working (P0)
- **Backend Evidence:** `backend/src/animals/animals.controller.ts:45-74`. Endpoints handle animal creation with `shareCapacity`, `supplierName`, `procurementCostMinor`, and `procuredAt`.
- **Frontend Evidence:** `AdminWorkspace.tsx:95-112, 444-451, 851-862`. Animal directory, verification action, and addition modal calling `animalsAdapter.createAnimal`.
- **Database:** `Animal` (`schema.prisma:505-523`).

#### 8. Animal Group Creation (CA-08) — Working (P0)
- **Backend Evidence:** `backend/src/animals/animals.controller.ts:76-102`. Group creation bound to verified animals.
- **Frontend Evidence:** `AdminWorkspace.tsx:113-126, 452-458, 863-867`. Creates groups and links to animals, calling `animalsAdapter.createGroup`.
- **Database:** `AnimalGroup`, `Animal` (`schema.prisma:524-537`).

#### 9. Share Allocation Engine (CA-09) — Working (P0)
- **Backend Evidence:** `backend/src/animals/animals.controller.ts:104-128`. Enforces approved registration check, prevents duplicate allocation, updates occupied shares atomically, and supports release (`DELETE /share-allocations/:id`).
- **Frontend Evidence:** `AdminWorkspace.tsx:335-352, 605-610, 1371-1398`. Share allocation modal validates capacity and participant status, calling `animalsAdapter.allocate(...)`. Features EF-02 Smart Allocation slot button (`AdminWorkspace.tsx:592-604`).
- **Database:** `ShareAllocation`, `AnimalGroup`, `Registration` (`schema.prisma:538-554`).

#### 10. Processing Tracking & Operations (CA-10) — Working (P0)
- **Backend Evidence:** `backend/src/operations/operations.controller.ts:105-161, 223-236`. Schedule management, team assignments, ground operation progress updates (`cutting`, `weighing`, `packaging` with `measuredGrams` and `packageCount`), and issue tracking (`OperationIssue`).
- **Frontend Evidence:** `AdminWorkspace.tsx:1057-1108` (`operations`), `191-213` (`scheduling`), `1419-1443` (animal stage timeline). Calls `operationsAdapter.schedules`, `operationsAdapter.updateOperationProgress`.
- **Database:** `Schedule`, `ScheduleMember`, `OperationIssue`, `Animal` (`schema.prisma:692-772`).

#### 11. Distribution Windows, Queue & Policies (CA-11) — Partially Implemented (P1)
- **Backend Evidence:** `backend/src/distribution/distribution.controller.ts:50-196`. Complete implementation of distribution policies (`gramsPerShare`, `gramsPerHousehold`), live inventory derived from processing, window CRUD, draft -> confirm -> pack -> handoff transitions, and recipient token linking.
- **Frontend Evidence:** `AdminWorkspace.tsx:1110-1170` has policy form and package listing, but Collection Window management has only a static date input rather than dynamic CRUD calling `POST/PATCH .../distribution/collection-windows`, and beneficiary management is not exposed as a distinct admin tab.
- **Database:** `DistributionPolicy`, `DistributionAllocation`, `CollectionWindow`, `Beneficiary` (`schema.prisma:794-868`).
- **Fix/Recommendation:** Add a Collection Windows manager component in `AdminWorkspace.tsx` and a Beneficiary verification queue view.

#### 12. Volunteer Management & Roles (CA-12) — Working (P0)
- **Backend Evidence:** `backend/src/operations/operations.controller.ts:51-80`. Create volunteer, assign departments (`slaughter`, `processing`, `distribution`, `finance`), toggle active status.
- **Frontend Evidence:** `AdminWorkspace.tsx:166-190, 913-926, 941-962`. Volunteer directory, activate/deactivate toggle, department responsibilities matrix, and task assignment.
- **Database:** `Volunteer`, `ScheduleMember`, `VolunteerTask` (`schema.prisma:671-690`).

#### 13. Announcements, Notices & Enquiries (CA-13) — Partially Implemented (P1)
- **Backend Evidence:** `backend/src/communications/communications.controller.ts:43-98`. Announcements CRUD & publish, targeted push/email notifications (`POST .../notifications`), and public enquiries inbox (`GET .../enquiries`).
- **Frontend Evidence:** `AdminWorkspace.tsx:232-257, 898-912` implements announcement creation and publishing (`communicationsAdapter.publishAnnouncement`). However, broadcasting targeted notifications to audiences (`participants`, `volunteers`, etc.) and viewing public enquiries have no UI.
- **Database:** `Announcement`, `NotificationDispatch`, `NotificationEmail`, `ProgrammeEnquiry` (`schema.prisma:885-959`).
- **Fix/Recommendation:** Add an "Enquiries Inbox" sub-tab and a "Broadcast Notification" modal in `AdminWorkspace.tsx`.

#### 14. Organisation Settings & Member Management (CA-14) — Missing Frontend (P1)
- **Backend Evidence:** `backend/src/organizations/organizations.controller.ts:100-219`. Fully implemented tenant-isolated endpoints: `GET/PATCH /organizations/:id`, member listing, invitation creation, role updates, and member removal.
- **Frontend Evidence:** Omitted from `adminNav` in `PortalShell.tsx:38-85`. Committee admins have no UI tab to view their organisation profile, invite co-admins, or manage committee member roles.
- **Database:** `Organization`, `OrganizationMember`, `OrganizationMemberRole`, `OrganizationInvitation` (`schema.prisma:186-267`).
- **Fix/Recommendation:** Add `slug: "settings", label: "Organisation settings"` to `adminNav` in `PortalShell.tsx` and build an Organisation & Team Management section in `AdminWorkspace.tsx`.

---

### Super Admin (Platform Owner)

#### 15. Organisation Onboarding (SA-01) — Working (P0)
- **Backend Evidence:** `backend/src/platform/platform-organisations.controller.ts:34-40, 56-64`. Endpoints create organisation in `onboarding` status and dispatch admin invitation token.
- **Frontend Evidence:** `SuperAdminWorkspace.tsx:96-141, 544-550`. Multi-step onboarding modal collects name, locality, contact, admin invitation, and calls `platformAdapter.createOrganisation` and `platformAdapter.inviteAdmin`.
- **Database:** `Organization`, `OrganizationInvitation`, `User`, `AuditLog` (`schema.prisma:186-267, 342-362`).

#### 16. Organisation Activation / Suspension (SA-02) — Working (P0)
- **Backend Evidence:** `backend/src/platform/platform-organisations.controller.ts:29-54`, `platform-organisations.service.ts:109-138`. Enforces lifecycle transitions (`onboarding` -> `active`, `active` <-> `suspended`, any -> `closed`), audited in `AuditLog`.
- **Frontend Evidence:** `SuperAdminWorkspace.tsx:263-289, 290-376`. Status badge, edit modal, and detail view allow updating access status.
- **Database:** `Organization`, `AuditLog` (`schema.prisma:186-208, 342-362`).

#### 17. Global User Management (SA-03) — Missing Frontend (P1)
- **Backend Evidence:** `backend/src/users/users.controller.ts:87-138` and `backend/src/roles/roles.controller.ts:134-162`. Fully implemented endpoints: `GET /users`, `GET /users/:id`, `PATCH /users/:id/status`, `DELETE /users/:id`, `POST/DELETE /users/:id/roles`.
- **Frontend Evidence:** `SuperAdminWorkspace.tsx:378-406` (`section === "access"`) only displays a table of Committee Admin invitation records from local mock data. There is no user management view connected to `/users` to inspect all users or toggle account status.
- **Database:** `User`, `UserRole`, `Role`, `Session`, `AuditLog` (`schema.prisma:52-96, 115-185`).
- **Fix/Recommendation:** Implement a Global User Directory table in `SuperAdminWorkspace.tsx` connecting to `GET /users` with status toggle (`PATCH /users/:id/status`) and role assignment.

#### 18. Platform-Wide Settings (SA-04) — Missing Backend / Product Decision (P2)
- **Backend Evidence:** No `PlatformSettingsController`, no route (`GET/PATCH /platform/settings`), and no database model exists.
- **Frontend Evidence:** `SuperAdminWorkspace.tsx:430-487` renders a form for platform name, support email, service status, default timezone, and plan, but persists solely to the in-memory `DemoStore`.
- **Database:** Missing model in `schema.prisma`.
- **Recommendation:** Product decision: Keep platform settings in environment configuration or add a `platform_settings` table in Postgres for dynamic runtime overrides.

#### 19. Global Feature Toggles & Plans (SA-05) — Missing Backend (P2)
- **Backend Evidence:** Route `GET/PATCH /platform/organisations/:id/features` proposed in `docs/API-CONTRACT.md:98` is missing from `PlatformOrganisationsController`. `Organization` table has no `features` or `plan` column.
- **Frontend Evidence:** `SuperAdminWorkspace.tsx:407-428` (`section === "features"`) configures feature toggles, but connects to `mockClient.getOrgFeatures` / `updateOrgFeatures` (`services/api.ts:52-53`).
- **Database:** Missing column/table.
- **Recommendation:** Add `features Json?` or `enabledFeatures String[]` to `Organization` model in `schema.prisma`, and implement controller endpoints in `PlatformOrganisationsController`.

#### 20. Security Audit Logging & System Health Monitoring (SA-06) — Partially Implemented (P1)
- **Backend Evidence:** 
  - `backend/src/health/health.controller.ts:8-33`: `GET /health` tests PostgreSQL connectivity and returns uptime.
  - `backend/src/audit/audit.controller.ts:16-42`: `GET /audit-logs` and `GET /organizations/:id/audit-logs` query `AuditLog` records with filtering and pagination.
- **Frontend Evidence:** `SuperAdminWorkspace.tsx:525-538` (`section === "activity"`) displays synthetic activity records from `DemoStore`. No fetch to `GET /audit-logs` or `GET /health` is wired in `backend.adapter.ts`.
- **Database:** `AuditLog` (`schema.prisma:342-362`).
- **Fix/Recommendation:** Wire `platformAdapter.getAuditLogs()` to `GET /audit-logs` and render live audit rows and database health status banner on the Super Admin dashboard.
