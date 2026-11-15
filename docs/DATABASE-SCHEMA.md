# Data Model

Status: DRAFT v0 · Owner: M2

Proposed baseline is the root starter's PostgreSQL and Prisma schema and migration workflow. Confirm runtime and direct migration connections in the destination environment. The Prisma schema in `backend/prisma/schema.prisma` defines all migrations and constraints.

| Entity | Fields and constraints |
|---|---|
| User / external identity | Reuse starter profile and unique provider identity mapping. Platform privileges are server-assigned. |
| Organisation | Opaque ID, name, locality, private contact, access status, timestamps. Reuse the organisation model with explicit lifecycle fields as needed. |
| Organisation membership | Organisation ID and user ID, unique as a pair. Store role and active access using the starter's membership model. Invitation acceptance grants only the role recorded by the server. |
| Organisation invitation | Organisation ID, recipient name and normalized email, proposed role, expiry, status, issuer and acceptance time. Store token digests and expiration times. Redeem once in the same transaction as membership creation. |
| Programme | Opaque ID and required organisation ID. Unique organisation/year pair. Title, publication status, description, guidelines, public contact, registration opening and closing instants, positive registration limit and integer amount/currency. Draft configuration can be incomplete. |
| Audit event | Organisation ID where applicable, actor, action, resource ID and timestamp. Audit lifecycle, invitation and publish writes without storing invitation secrets. Reuse the starter audit model if compatible. |

## Lifecycle

- Proposed organisation transitions are `onboarding → active`, `active → suspended`, `suspended → active`, and closure from any non-closed state. Invitation acceptance may provision membership before activation. Suspension and closure stop workspace access and public reads. They preserve annual records.
- Proposed programme publication starts at `draft` and moves to `published` only after validation. Publication and registration dates describe separate states. Closure records `closedAt`. It requires resolved registration, payment, processing and allocation work. Archived records remain available to authorised readers.
- Scope private resource lookups by both organisation and resource ID. Use the organisation/year unique constraint for concurrent programme creation. Enforce cross-tenant consistency in future child relations and write transactions.
- Public reads select approved fields explicitly. Organisation contacts, membership data and invitations belong to private responses.

## Additional programme data

| Models | Boundaries |
|---|---|
| User identity, sessions and email tokens | Store password hashes, verified Google subject links and rotating opaque refresh-token digests. Email confirmation, recovery and change tokens have expiry and single-use claims. |
| Households, applicant household and registration | The committee directory belongs to one organisation. Applicant details belong to one user/programme. Registrations snapshot household data, option name and fee. Composite keys preserve applicant and programme ownership. |
| Animal, group and share allocation | Reference and capacity belong to one annual programme. Groups share an animal's capacity. Unique registration assignments and serializable writes prevent duplicate or excess allocations. |
| Payment, expense and receipt | All amounts use INR minor units. Pending payments are excluded from verified balances. One receipt per verified payment and one approval confirmation per registration. |
| Volunteer, schedule, task and issue | Team and task references belong to the same programme. Verified sign-in binds the volunteer assignment to its user. Completed processing supplies actual measured stock. |
| Beneficiary, policy, window and distribution | Beneficiaries link to households in the matching organisation. One live allocation per recipient shares a programme-wide gram ledger. Confirmation reserves stock and handoff records the actor and time. |
| Announcement, inbox and email outbox | Public publication is explicit. Inbox items are private to the recipient. Email jobs are claimed and retried with programme and user context. |

Synthetic workflow checks use isolated test accounts and a fresh database. Production seeding creates system roles and permissions only.
