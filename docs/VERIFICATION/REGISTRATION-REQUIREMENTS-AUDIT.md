# QurbaniOS — Registration Requirements & Field Recovery Audit

**Document:** `docs/VERIFICATION/REGISTRATION-REQUIREMENTS-AUDIT.md`  
**Status:** COMPLETE AUDIT & SPECIFICATION  
**Scope:** Participant Registration, Household Linking, Participation Options, Pricing, and Consent  
**Author:** Subagent C — Participant Workflow Researcher  
**Date:** 2026-11-15  

---

## 1. Executive Summary & Operational Context

In QurbaniOS, participant registration is the core entry point for annual Aḍḥiyah operations. Historically, community Qurbani operations suffered from paper slips, unverified telephone requests, duplicate share allocations, and disconnected payment records (`docs/PROJECT.md:24-27`).

The QurbaniOS workflow digitises this process through strict architectural boundaries:
1. **Decoupled Household Model:** A master household record imported by the committee (`households` table) represents physical Mahallu residency, but **importing a household never registers its members** (`docs/Features_workflow.md:731`, `frontend/src/components/app/AdminWorkspace.tsx:931-933`).
2. **Applicant Household Submission:** An applicant signs in (via Supabase Auth or NestJS JWT) and submits or verifies their household details (`applicant_households` table).
3. **Immutable Registration Snapshot:** When a registration is submitted, the system captures an immutable JSON snapshot of the household, the participation option, unit price, requested shares, and calculated fee minor units (`backend/prisma/schema.prisma:471-503`).
4. **Capacity & Window Guarding:** Registration is accepted only when the programme is in `published` status, within the time window (`registrationOpensAt` <= `now` < `registrationClosesAt`), and below the total registration cap (`registrationLimit`) (`backend/src/registration/registration.service.ts:185-220`).

---

## 2. Complete Recovered Registration Fields Matrix

The following table recovers and standardises all previously agreed registration fields across `docs/Features_workflow.md`, `docs/API-CONTRACT.md`, `docs/FRONTEND-NEEDS.md`, backend DTOs, and frontend components:

| Category | Field Name | Data Type | Validation Rules | Backend DTO & DB Column | Frontend Input | Lifecycle / Mutability |
|---|---|---|---|---|---|---|
| **Participant Identity** | Full Name | `string` | Non-blank, min 2, max 200 chars | `User.name` (`schema.prisma:55`) | Text Input (`name="name"`) | Editable in profile; snapshotted at submission |
| | Email Address | `string` | Valid RFC 5322 email, max 254 chars | `User.email` (`schema.prisma:54`) | Email Input (`name="email"`) | Read-only identity from Auth session |
| | Contact Phone | `string` | Optional/Required, max 40 chars, digits/leading 0 | `ApplicantHousehold.contactPhone` (`schema.prisma:460`) | Tel Input (`name="phone"`) | Editable pre-submission; locked post-approval |
| | User UUID | `UUID v4` | Valid UUID | `Registration.applicantId` (`schema.prisma:474`) | System generated (Auth context) | Immutable primary key |
| **Household Information** | Household Head / Name | `string` | Required, non-blank, max 200 chars | `ApplicantHousehold.name` (`schema.prisma:457`) | Text Input (`name="householdName"`) | Saved via `PUT /me/household`; snapshotted in registration |
| | Residential Address | `string` | Required, non-blank, max 1000 chars | `ApplicantHousehold.address` (`schema.prisma:458`) | Textarea (`name="address"`) | Street, building, door number, ward |
| | Locality / Ward | `string` | Optional/Derived, max 200 chars | Derived or in `address` / `householdSnapshot` | Text / Select (`name="locality"`) | Used for logistics and ward distribution |
| | Household Contact Email | `string` | Optional, valid email | `ApplicantHousehold.contactEmail` (`schema.prisma:459`) | Email Input (`name="contactEmail"`) | Fallback communication channel |
| | Household Members Count | `number` | Integer >= 1 | Stored in `householdSnapshot` & master directory | Number Input (`name="members"`) | Used for public beneficiary / family quota planning |
| **Participation Selection** | Option ID | `UUID v4` | Must match active option in programme | `SubmitRegistrationDto.optionId` (`registration.dto.ts:22`) | Radio Card / Select | Selected from `GET /me/participation-options` |
| | Option Name | `string` | Non-blank, max 200 chars | `Registration.optionName` (`schema.prisma:478`) | Display Label ("Cattle share", "Goat") | Snapshotted at submission |
| | Share Quantity | `number` | Integer, min 1, max `option.maxShares` (7) | `SubmitRegistrationDto.shares` (`registration.dto.ts:26`) | Number Stepper / Select (1–7) | Validated against animal share capacity |
| **Financial Pricing** | Unit Price Minor | `number` | Integer minor units (paise, INR) | `Registration.unitPriceMinor` (`schema.prisma:479`) | Read-only currency display | `option.priceMinor` (e.g., 850000 = ₹8,500) |
| | Total Fee Minor | `number` | `shares * unitPriceMinor`, max 2^31 - 1 | `Registration.feeMinor` (`schema.prisma:480`) | Computed display (`shares * price`) | System calculated; forms ledger baseline |
| | Currency | `string` | Constant `'INR'` | `ProgrammePriceDto.currency` (`programmes.dto.ts:37`) | Currency symbol prefix (₹) | System locked to Indian Rupee |
| **Declarations & Consent** | Guidelines Consent | `boolean` | Must be `true` (checked) | Client validation + Audit Log entry | Checkbox (`name="consentGuidelines"`) | Acknowledges programme rules and deadlines |
| | Halal Proxy (Wakala) | `boolean` | Must be `true` (checked) | Client validation + Audit Log entry | Checkbox (`name="consentWakala"`) | Religious authorization for committee slaughter proxy |
| | Distribution Policy Consent | `boolean` | Must be `true` (checked) | Client validation + Audit Log entry | Checkbox (`name="consentDistribution"`) | Acknowledges 1/3 family share and community ration |
| | Status & Timestamps | `enum` / `Date` | Status: `submitted`, `approved`, `rejected`, `cancelled` | `Registration.status`, `submittedAt`, `decidedAt` | Status Badge | Managed exclusively by committee actions |

---

## 3. Backend Implementation & DTO Audit

### 3.1 DTO Invariants (`backend/src/registration/registration.dto.ts`)
```typescript
export class SubmitRegistrationDto {
  @IsUUID()
  optionId!: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  shares!: number;
}
```
*Audit Observation:* `SubmitRegistrationDto` accepts only `optionId` and `shares`. It relies on a mandatory prerequisite call to `PUT /organisations/:orgId/programmes/:programmeId/me/household` (`ApplicantRegistrationController:105-112`). If household details have not been submitted beforehand, registration submission fails with `409 Conflict: "Submit household details before applying"` (`registration.service.ts:224-225`).

### 3.2 Household DTO Invariants (`backend/src/households/households.dto.ts`)
```typescript
export class CreateHouseholdDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  address!: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => HouseholdContactDto)
  contact!: HouseholdContactDto;
}
```
*Audit Observation:* The `contact` object permits optional `email` and optional `phone`. Both `name` and `address` are validated against whitespace trimming.

### 3.3 Database Constraints (`backend/prisma/schema.prisma`)
1. `@@unique([programmeId, applicantId])`: Strictly prevents an applicant from submitting multiple registrations in the same annual programme.
2. `@@unique([programmeId, id])`: Enforces composite tenant isolation.
3. Foreign key constraints ensure referential integrity with `ApplicantHousehold` and `ParticipationOption`.
4. Deletion of programmes or participation options with active registrations is prevented via `onDelete: Restrict`.

---

## 4. Frontend Registration Forms & Journey Audit

### 4.1 Current Journey Flow
1. **Public Site (`/programme`, `/guidelines`):** Visitor reads guidelines and clicks "Start participation" or "Register", routing to `/signup` (`frontend/src/components/app/ProgrammePage.tsx:120, 196`).
2. **Authentication (`/signup`, `/login`):** User creates account or signs in via email/password or Google OAuth (`frontend/src/pages/LoginPage.tsx:47-67`). Role is defaulted to `"participant"`.
3. **Workspace Redirection (`/participant/overview`):** Protected route validates participant session and opens `ParticipantWorkspace.tsx`.

### 4.2 Gaps in Current Frontend Implementation
1. **Missing Registration Wizard:** In `frontend/src/components/app/ParticipantWorkspace.tsx`, if the participant has no active registration, the portal expects demo store rows (`records.participants`) or fails silently. The 7-step wizard defined in `frontend/src/lib/workflow.ts:452-460`:
   ```typescript
   export const registrationSteps = [
     "Verify identity",
     "Household",
     "Your details",
     "Participation",
     "Review",
     "Confirmation",
     "Committee review",
   ];
   ```
   is not instantiated as an active interactive form component in the workspace.
2. **Missing Consent Checkboxes:** The Wakala (proxy authorization) and Guidelines checkboxes are mentioned in public guidelines text but not wired into a persistent submission payload.

---

## 5. Architectural Recommendations for Registration

1. **Composite Registration Endpoint (or Two-Step Wizard):** Implement a unified multi-step frontend wizard component `RegistrationWizard.tsx` mounted in `ParticipantWorkspace.tsx` when `registration === null`.
2. **Persist Declarations:** Extend `Registration` Prisma schema or store consent metadata in `householdSnapshot` / audit log:
   ```json
   {
     "consents": {
       "guidelinesAcceptedAt": "2027-05-01T10:00:00Z",
       "wakalaProxyAuthorized": true,
       "distributionPolicyAcknowledged": true
     }
   }
   ```
3. **Graceful Handling of Closed/Capped Programmes:** Frontend must query `publicAdapter.getPublicProgramme` and disable registration with an informative alert if `now >= registrationClosesAt` or capacity is reached.
