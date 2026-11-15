# API Contract (MVP)

Status: DRAFT v0 · Owner: M2 · Consumer: M1

This proposal covers the M2 journeys in [Features_workflow.md](Features_workflow.md). M1 can use the examples as mock fixtures after reviewing the payloads.

## Conventions

Use JSON over HTTPS. Paths below are relative to the configured API base, including any prefix. In QurbaniOS JWT mode the API base ends in `/api/v1`. Protected calls send the Nest-issued access token as `Authorization: Bearer <token>`. Email signup, email confirmation, password recovery, Google popup sign-in, refresh and logout follow the [frontend auth contract](../backend/FRONTEND-AUTH.md). Protected workspace calls verify the caller's current role, membership and organisation status.

## Screen and endpoint map

All route names and new payloads are proposed. IDs are opaque strings. Mutation responses return the updated resource unless specified below.

| Screen | Method and path | Access and payload | Success |
|---|---|---|---|
| PUB09 and signed-in shell | GET /auth/me | Nest-issued bearer access token. | 200 profile with global roles and organisation memberships |
| SA02–SA03 | GET /platform/organisations | Super Admin. Optional `search`, `cursor`, `limit`. | 200 `{ items, nextCursor }`, with null cursor at the end |
| SA02–SA03 | POST /platform/organisations | Super Admin. `{ name, locality, contact }`. | 201 organisation in `onboarding` |
| SA03 | GET /platform/organisations/:orgId | Super Admin. | 200 organisation |
| SA03 | PATCH /platform/organisations/:orgId | Super Admin. Update `name`, `locality`, `contact` or `status`. | 200 organisation |
| SA04 | POST /platform/organisations/:orgId/invitations | Super Admin. `{ name, email }`. Committee Admin role set by server. | 201 `{ id, status: "pending" }` |
| SA04 | GET /platform/organisations/:orgId/invitations | Super Admin. Cursor paging as above. | 200 invitation summaries with name, email and status |
| Invitation link | POST /organisations/invitations/accept | Verified signed-in recipient. `{ token }`. | 200 `{ organisationId, role: "committee_admin" }` |
| Committee workspace | GET /organisations | Signed-in user. Reuse starter membership lookup, with organisation status available for routing. | 200 caller's workspace list |
| ADM02 | GET /organisations/:orgId/programmes | Committee Admin in that active organisation. Cursor paging as above. | 200 `{ items, nextCursor }` |
| ADM02 | POST /organisations/:orgId/programmes | Same. `{ year, title }`. | 201 programme in `draft` |
| ADM02 | GET /organisations/:orgId/programmes/:programmeId | Same. | 200 programme |
| ADM02 | PATCH /organisations/:orgId/programmes/:programmeId | Same. Update editable programme fields below. | 200 programme |
| ADM02 | POST /organisations/:orgId/programmes/:programmeId/publish | Same. Validated programme with required public information. | 200 programme in `published` |
| PUB02–PUB04, PUB08 | GET /public/organisations/:orgId/programmes/:year | Anonymous. Organisation active and programme published. | 200 public programme projection |

PUB01 is a frontend loading state. Public announcements, aggregate overview and distribution follow the routes below. SA06 and SA07 still have scope TBD.

## Payload examples

Organisation detail (`contact` is private platform/committee contact information):

```json
{"id":"org_demo","name":"Example Mahallu","locality":"Example Town","contact":{"email":"office@example.test"},"status":"onboarding"}
```

Programme detail and public projection share these fields, including the opaque `id` and `organisationId` required to open authenticated participant routes. The committee response additionally includes `registrationLimit`. Public contact comes from the programme's explicitly published contact field.

```json
{
  "id": "opaque-programme-id",
  "organisationId": "opaque-organisation-id",
  "year": 2027,
  "title": "Annual Aḍḥiyah Programme",
  "status": "published",
  "description": "Programme information for residents",
  "guidelines": "Read the participation requirements before registering.",
  "publicContact": {"email":"programme@example.test"},
  "registrationOpensAt": "2027-04-01T03:30:00Z",
  "registrationClosesAt": "2027-05-01T03:30:00Z",
  "price": {"amountMinor":250000,"currency":"INR"}
}
```

Draft fields other than year and title may be null. Year and organisation identify the public page and are immutable after creation in this proposal. Date fields are ISO 8601 instants. Registration close must follow opening. Capacity is a positive integer and price uses non-negative integer minor units. Suggested publish requirements are description, guidelines, public contact, dates, price and capacity. M1 should show whether registration is upcoming, open or ended separately from publication status.

### Programme implementation notes

The six programme routes in the table are implemented for local verification. The platform organisation directory, lifecycle, invitations, and committee workspace discovery are also implemented for local verification. The programme API trims title whitespace and requires a non-blank title of at most 200 characters. It accepts years 1900–9999 and limits description and guidelines to 10,000 characters each. Public contact uses the email object shown in the example. Date inputs require a timezone offset or UTC designator. Registration limits and amounts must fit a signed 32-bit integer. Programme pagination defaults to 25 and caps at 100. Publishing an already published programme returns its current representation. Updates to a published programme must preserve its required public fields. `faqs` optionally accepts up to 25 `{ question, answer }` entries and is returned in programme detail and the public projection.

### Onboarding implementation notes

Creation requires a non-blank organisation name and locality and a private contact email. Names and locality allow up to 200 characters. Platform directory search matches organisation names case-insensitively. Organisations move from onboarding to active, between active and suspended, or to closed from any non-closed state. Closure retains records. The platform actor receives no committee membership when creating an organisation.

Invitation creation requires a non-blank recipient name of at most 200 characters and a valid email. The email is queued through the starter mail service. The signed-in recipient must verify the invited email address before acceptance. Accepting during onboarding creates membership, and committee programme access opens after activation. Workspace discovery returns membership entries with `organization.id`, `name`, `slug`, and lowercase `status`, plus `membershipStatus`, `joinedAt`, and `roles`. Route suspended and closed workspaces to the unavailable state. Expired, revoked and used invitations cannot grant membership.

## Errors and UI behavior

```json
{"statusCode":409,"error":"Conflict","message":"A programme already exists for this year","code":"PROGRAMME_YEAR_EXISTS","timestamp":"2027-01-01T00:00:00.000Z","path":"/organisations/org_demo/programmes"}
```

| HTTP | Client handling |
|---|---|
| 400 | Show validation details. Starter `message` can be a string or array. |
| 401 | Rotate the Nest refresh token and return to sign-in if refresh fails. |
| 403 | Show access denied, verified-email required, or workspace unavailable according to the returned code when defined. |
| 404 | Show unavailable for missing, unpublished public, or out-of-tenant programme resources. |
| 409 | Show duplicate year, invalid transition, or unavailable invitation. Refresh current state before retrying. |
| 429 / 503 | Show temporary unavailability and allow retry. Confirm mutation outcome before repeating a write. |

M1 should provide loading, empty, success and error states for the workspace, lists and setup forms. For onboarding, show pending invitation and activation separately. Confirm exact profile and workspace projections, invitation delivery and resend flow, public URL design, pricing shape and mock location with M1 before freeze. The remaining proposed routes are below. M3 routes are tracked in [EXTRA-FEATURE-PLAN.md](EXTRA-FEATURE-PLAN.md).

## Programme operations and self-service

All routes below are proposed. Prefix relative paths with the base in the first column. `P` is `/organisations/:orgId/programmes/:programmeId`, `O` is `/organisations/:orgId`, and `U` is `/public/organisations/:orgId/programmes/:year`. Lists return `{ items, nextCursor }` and accept `cursor` and `limit`, with proposed default 25 and maximum 100. Reads and actions return 200, creates return 201, and deletes return 204. Optional values are nullable in responses. An omitted PATCH field retains its value. Each resource returns an opaque `id` and applicable state. Timestamps use ISO 8601 and money uses the programme price shape. Quantities are integer grams, counts or share units, as named.

### Public and platform

| Screen | Route | Request and response |
|---|---|---|
| SA01 | GET /platform/dashboard | Super Admin. Organisation counts by status, committee admin count and recent platform events. |
| SA04 | POST /platform/organisations/:orgId/invitations/:id/revoke | Super Admin. Revokes a pending invitation and returns its updated state. |
| SA05 | GET/PATCH /platform/organisations/:orgId/features | Super Admin. GET and PATCH return `{ enabledFeatures: string[] }`. PATCH sends the full set of feature keys from EF-01 through EF-05. Deployed modules also require their server flag to be enabled. |
| SA08 | GET /platform/audit-events | Super Admin. Filter by `organisationId` and `action`. Rows include actor ID, action, resource ID and timestamp. |
| PUB05 | U GET /announcements | Published announcements with title, body and publication time. |
| PUB06 | U GET /overview | Approved aggregates with as-of time. Proposed fields are animal count and programme progress, with optional published financial totals. |
| PUB07 | U GET /distribution | Published eligibility guidance, locations, collection windows and enquiry instructions. |
| PUB08, BEN07 | U POST /enquiries | `{ name, replyEmail, message }` → acknowledgement with ID. Rate limit and keep enquiry contact private. |

SA06 platform settings and SA07 support requests have scope TBD. SA05 paid plans and checkout are conditional scope. Invitation states are proposed as pending, accepted, expired and revoked. Expiry, mismatched recipient or prior redemption must not grant membership.

### Households, registrations and personal tracking

| Screen | Route | Request and response |
|---|---|---|
| ADM03 | O GET/POST /households | Committee. List filter `search`. Create with `{ name, address, contact }`. |
| ADM03 | O GET/PATCH /households/:id | Committee. Read/update household fields. |
| ADM03 | O POST /households/import | Committee. Multipart `file`, CSV/XLSX. Return `{ importedCount, errors: [{ row, field, message }] }`. Proposed atomic import, with any invalid row rejecting the batch. |
| ADM04–05 | P GET /registrations, GET /registrations/:id | Committee. List filters `status`, `search`. Detail includes applicant, household snapshot, option, requested shares and decision. |
| ADM05 | P POST /registrations/:id/decision | Committee. `{ action: "approve"|"reject"|"cancel", reason? }` returns updated registration. |
| PAR02 | PATCH /users/me | Starter profile update. |
| PAR02 | P GET/PUT /me/household | Signed-in applicant. Read/update own submitted household details `{ name, address, contact }`. Committee household links are resolved by the server. |
| PAR03 | P POST /me/registration | Signed-in applicant during registration window. `{ optionId, shares }` → submitted registration. Household data comes from own submission. |
| PAR03 | P GET /me/registration | Applicant. Own registration and decision. 404 before applying. |
| PAR01, PAR04, PAR07–08 | P GET /me/participation | Applicant. `{ registration, assignment, operations, distribution }`. Unassigned sections are null. Return own group/animal/share and published progress and collection details. |
| PAR03, ADM02 | P GET /me/participation-options, GET/PUT /participation-options | Applicant read returns available choices. Committee GET/PUT manages `{ items: [{ id?, name, price, maxShares }] }`. Existing registrations retain their fee and option snapshot. |

The committee household directory and multipart import are implemented for local verification. Household names and addresses are non-blank and limited to 200 and 1,000 characters respectively. Contact is an object with optional email and phone fields. A PATCH that supplies contact replaces that object. Directory search matches name or address. Import uses a single part named `file`, up to 2 MiB and 1,000 data rows. Use `name,address,email,phone` headers, with name and address required. For XLSX, use the first worksheet and keep phone values as text to retain leading zeros. A file with invalid or duplicate rows returns HTTP 200 with `importedCount: 0` and row errors. Invalid file structure returns 400, and limits return 413. A successful batch creates new records, so confirm the result before retrying an upload.

Registration and committee review are implemented for local verification. Signed-in applicants can submit personal household details without committee membership. Those details are separate from the committee directory. Registration requires an active published programme, an open window, saved household details and an active option in the programme. The opening time is inclusive and closing time is exclusive. Submitted and approved registrations consume capacity. Duplicate applications or exhausted capacity return 409. Each submission snapshots the household, option name and unit price and returns `fee` using the shared money representation.

Committee decisions transition submitted to approved, rejected or cancelled, or approved to cancelled. Repeating the same decision returns the existing record. Review is tenant-scoped and audited. Cancellation after a payment or allocation will be guarded when those records are implemented. Participation initially returns the registration and null assignment, operations and distribution sections.

### Animals, finance and receipts

| Screen | Route | Request and response |
|---|---|---|
| ADM06 | P GET/POST /animals, GET/PATCH /animals/:id | Committee. `{ reference, shareCapacity, supplierName, procurementCost, procuredAt }`. Return animal and allocated share count. |
| ADM07 | P GET/POST /groups, GET/PATCH /groups/:id | Committee. `{ name, animalId }`. Return group with capacity and assigned share count. |
| ADM07 | P GET/POST /share-allocations, DELETE /share-allocations/:id | Committee. Create with `{ registrationId, groupId, shares }`. Query by group or registration. Allocation and release update capacity atomically. |
| ADM08 | P GET /finance/summary | Finance-authorized committee. Expected, verified, outstanding and expenses totals. |
| ADM09 | P GET/POST /payments | Finance-authorized committee. Filter by registration/status. Create with `{ registrationId, amount, method, reference?, receivedAt }` → pending payment. |
| ADM09 | P POST /payments/:id/verification | Finance-authorized committee. `{ action: "verify"|"reject", reason? }` → updated payment and receipt ID when verified. |
| ADM10 | P GET/POST /expense-categories, PATCH /expense-categories/:id | Finance-authorized committee. `{ name }`. |
| ADM10 | P GET/POST /expenses, PATCH /expenses/:id | Finance-authorized committee. `{ categoryId, amount, description, incurredAt }`. |
| PAR05 | P GET /me/payments | Applicant. `{ expected, verified, outstanding, items, nextCursor }`. Items show own payment amount, method, status and date. |
| PAR06, ADM09 | P GET /me/receipts, GET /receipts/:id | Own receipt metadata list. Detail requires owner or finance-authorized committee. Fields include receipt number, issue date, kind, amount when applicable and associated record ID. |
| VOL03 finance | P GET /volunteer/collections, POST /volunteer/cash-submissions | Assigned finance volunteer. Read own collection assignments. Submit `{ assignmentId, amount, receivedAt, reference? }` → pending payment summary. |

Pending payments move to verified or rejected. Verified balances and payment receipts derive from verified records only. Duplicate submissions and verification retries must preserve a single financial effect. Shares require approved registrations, valid tenant relations and available capacity. Animal, group and share-allocation routes are implemented for local verification. An approved registration may have one assignment, up to its approved share count. Approval is required for allocating shares. Groups on the same animal draw from its shared capacity. Release an assignment before cancelling an approved registration. Receipt download format, refund rules and receipt issuance timing remain open.

Animal, group, allocation and participant assignment routes are implemented locally. A registration can hold one assignment, up to its approved share count. Groups on the same animal share its total capacity. Approval is required for allocating shares. Release the assignment before cancelling.

Committee finance and participant payment and receipt reads are implemented locally. Payment methods are `cash`, `upi`, `bank_transfer` and `other`. Amounts must be positive. Exact payment submissions with the same registration, amount, method, reference and timestamp resolve to the existing payment. Verification rejects amounts above the outstanding balance. Successful verification issues one payment receipt. Approval issues one registration confirmation receipt. Resolve outstanding payment records before cancelling a registration. Refund and adjustment policy remains open. Volunteer cash submission will follow the volunteer assignment slice.

### Volunteer assignments and operations

| Screen | Route | Request and response |
|---|---|---|
| ADM11 | P GET/POST /volunteers, PATCH /volunteers/:id | Committee. Create/invite `{ name, email, departments }`. Edit departments/access. Return identity summary and invitation/access status. |
| ADM11–12 | P GET/POST /tasks, PATCH /tasks/:id | Committee. `{ department, assigneeId, title, scheduleId?, resourceId? }`. |
| ADM12–13 | P GET/POST /schedules, PATCH /schedules/:id | Committee. `{ department, animalId?, startsAt, endsAt, location, teamMemberIds }`. |
| ADM13 | P GET /operations, GET /issues, PATCH /issues/:id | Committee. Filter by department/status. Issue patch sets resolution/status. |
| VOL01–04 | P GET /volunteer/workspace, GET /volunteer/tasks, GET /volunteer/schedules, GET /volunteer/operations | Assigned volunteer. Return own departments, tasks, team schedules and assigned record projections. |
| VOL02 | P POST /volunteer/tasks/:id/progress | Assigned volunteer. `{ status, note? }` → task. |
| VOL03 | P POST /volunteer/operations/:id/progress | Assigned slaughter/processing volunteer. `{ status, stage?, measuredGrams?, packageCount? }` → operation. Stage-specific fields require matching department and action. |
| VOL05 | P GET/POST /volunteer/issues | Assigned volunteer. Own issue history. Create with `{ taskId?, operationId?, description }` → open issue. |
| VOL06 | GET/PATCH /users/me | Starter profile read/update. Notifications below. |

Tasks and operations propose pending → in progress → completed. Processing stages track cutting, weighing and packaging. Slaughter scheduling requires a confirmed animal assignment. Operational updates record the actor and time. Committee approves the exact transition graph, required measurements and correction permissions before consuming writes.

Operations and volunteer routes are implemented locally. Provisioned volunteers link their verified sign-in to the programme by matching the invitation email. The committee can disable access or change departments. Work status values are `pending`, `in_progress`, and `completed`. Schedule edits and reassignment are allowed while work is pending. Only assigned members can advance the corresponding task or operation. Processing requires completed slaughter and completed packaging with measured grams and package count before it contributes stock. Finance tasks use an approved registration as `resourceId`; a cash submission uses the task ID as `assignmentId` and sends `amount` as the shared money object. Committee verification is still required.

### Beneficiary access and distribution

| Screen | Route | Request and response |
|---|---|---|
| ADM14 | P GET/POST /beneficiaries, GET/PATCH /beneficiaries/:id | Committee. Create `{ householdId }`, maintain recipient details and verify eligibility through an explicit status action below. |
| ADM14 | P POST /beneficiaries/:id/eligibility | Committee. `{ action: "approve"|"reject", reason? }` → eligibility summary. |
| ADM14, BEN01 | P POST /beneficiaries/:id/access, POST /me/beneficiary-access/accept | Committee issues access instructions. Verified recipient completes account linking. Email provides a single-use link for the verified address, valid for seven days. Accept sends `{ token }`. |
| BEN02–BEN06 | P GET /me/beneficiary, GET /me/beneficiary/distribution | Linked recipient. Own household projection and eligibility, plus confirmed allocation/collection and tracking. Allocation is null before confirmation. |
| ADM14 | P GET/PUT /distribution/policy | Committee. Return/update participant and public eligibility rules and ration quantities. `{ participant: { enabled, gramsPerShare }, public: { enabled, gramsPerHousehold, guidance } }`. |
| ADM15 | P GET /distribution/inventory | Committee. `{ recordedGrams, allocatedGrams, availableGrams }` derived from actual processing records. |
| ADM15 | P GET/POST /distribution/allocations | Committee. `{ recipientType, recipientId, quantityGrams, collectionWindowId }` → draft allocation. |
| ADM15 | P POST /distribution/allocations/:id/transition | Committee. `{ action: "confirm"|"pack"|"cancel" }` → allocation. Confirmation and inventory reservation are atomic. |
| ADM15 | P GET/POST /distribution/collection-windows, PATCH /distribution/collection-windows/:id | Committee. `{ location, startsAt, endsAt, instructions }`. |
| VOL03 distribution | P GET /volunteer/distribution/queue, POST /volunteer/distribution/allocations/:id/handoff | Assigned distribution volunteer. List assigned packages. Handoff takes `{ outcome: "collected"|"delivered", recipientProof }` and returns updated allocation. Send the recipient-owned `collectionReference` UUID as `recipientProof`. |

Beneficiary eligibility proposes pending → approved/rejected. Distribution proposes draft → confirmed → packed → collected/delivered. Committee cancellation and adjustment policy must define when reserved stock is released. Participant and beneficiary recipient IDs resolve through separate records and share inventory accounting. A handoff can only consume a confirmed and packed allocation once.

Distribution is implemented locally. The beneficiary email link points to `/beneficiary/access?organisationId=<id>&programmeId=<id>#token=<token>` on the SPA. The invite recipient signs in with the verified household email, then submits the fragment token. Eligibility and linkage are separate from participant registration. A confirmed allocation reserves stock from completed processing. Cancelling an unhanded-off allocation releases it. Pack before handoff. A volunteer must have a distribution task with the allocation ID as its `resourceId`. The owner sees a collection reference in the private distribution response. The volunteer queue and committee allocation list omit it.

### Communications, reporting and closure

| Screen | Route | Request and response |
|---|---|---|
| ADM01 | P GET /dashboard | Committee. Household, registration, animal, finance, volunteer, operations and distribution summaries plus pending actions and recent activity. |
| ADM16 | P GET/POST /announcements, POST /announcements/:id/publish | Committee. Create with `{ title, body }` → draft. Publish returns publication time. |
| ADM16 | P GET /enquiries | Committee. Paged public enquiries include the reply email and message. |
| ADM16 | P POST /notifications | Committee. `{ title, body, audience, channels }` → dispatch ID/status. Backend resolves tenant-scoped recipients. Audience is one of `participants`, `beneficiaries`, `volunteers`, or `all`. Channels are `in_app` and `email`. |
| PAR09, BEN07, VOL06 | P GET /me/notifications, PATCH /me/notifications/:id | Recipient. Own notification list. PATCH `{ read: true }` → updated item. |
| ADM17 | P GET /reports/:kind, GET /reports/:kind/export | Committee with report-specific permissions. Kinds cover registration, participant, animal, allocation, payment, expense and financial summaries. Export accepts `format=xlsx|pdf` and returns a file. |
| ADM17 | P POST /close | Committee. Returns programme with closure state. Preserve historical records and reject subsequent operational writes. Closure requires a published programme with no submitted registrations, pending payments, unfinished slaughter/processing, or draft/confirmed/packed allocations. Closed programmes stay visible to authorised private readers and are absent from anonymous programme pages. |

Communications, public overview, and archive are implemented locally. Only published announcements are visible publicly. Public overview includes animal count and slaughter/processing progress. It excludes private records and financial totals. Notifications use an inbox scoped to the signed-in owner. Payment review and registration decisions create in-app messages in the same transaction. Email dispatch returns queued status when the SMTP channel is enabled and recipients exist. The outbox retries up to three attempts. If SMTP is disabled, email-only dispatch returns 503 and mixed-channel dispatch proceeds with in-app delivery. An ambiguous SMTP acknowledgement may lead to a repeated email. The in-app action remains atomic. Archived writes return 409 for authorised users. Read receipts on existing inbox entries can still be marked.

The committee dashboard and report routes are implemented locally. Report keys are `registration`, `participant`, `animal`, `allocation`, `payment`, `expense`, `financial`, and `operations`. The JSON view uses cursor paging. For dated reports, optional `from` and `to` ISO 8601 instants bound the report inclusively and exclusively, respectively. Allocation and financial summary reports cover the whole programme and reject date filters. XLSX and PDF exports accept the same filters and allow at most 2,000 rows. The payment export retains the verification status on each row. Financial totals use verified payments only. Receipt and dashboard reads remain available to authorised users after closure.

### Frontend reconciliation

M1 should check route grouping, payloads and loading, empty, pending, denied and conflict states against the screens. Representative conflicts include duplicate registration, exhausted share capacity, stale state and insufficient stock. Use HTTP status plus the agreed stable error code when present. Confirm the final error-code catalogue, import/report columns, options and financial rules, beneficiary proof, delivery status and mock ownership before freeze. Destructive state changes and retryable writes need explicit concurrency and idempotency behaviour during implementation.
## Change rules

Keep mocks and this file aligned. Send `CONTRACT additive` with additive changes. Coordinate breaking changes with consumers before merging. Send `CONTRACT FREEZE v1` after reconciliation with M1.
