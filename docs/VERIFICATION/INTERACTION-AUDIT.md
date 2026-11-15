# QurbaniOS Complete Interaction Audit Report

**Generated:** 2026-11-15  
**Auditor:** Subagent A (Read-Only Interaction Specialist)  
**Scope:** `frontend/src` (Routes, Navigation, Controls, Tables, Modals, Forms, Adapters, Auth)

---

## 1. Route & Role Navigation Map

| Route Path | Allowed Role(s) | View Component | Status | Key Issues |
|---|---|---|---|---|
| `/` | Public | `LandingPage.tsx` | WORKING | Live public API + communications fetch; fallback to sample |
| `/programme` | Public | `ProgrammePage.tsx (programme)` | WORKING | Shows metrics, milestones, financial summary |
| `/about` | Public | `ProgrammePage.tsx (about)` | WORKING | About text and high-level timeline |
| `/guidelines` | Public | `ProgrammePage.tsx (guidelines)` | WORKING | Pricing breakdown & participation guidelines |
| `/faq` | Public | `ProgrammePage.tsx (faq)` | WORKING | Interactive accordion items |
| `/contact` | Public | `ProgrammePage.tsx (contact)` | WORKING | Enquiry form connected to `publicApi.submitEnquiry` |
| `/announcements` | Public | `ProgrammePage.tsx (announcements)` | WORKING | Renders published announcements |
| `/distribution` | Public | `ProgrammePage.tsx (distribution)` | WORKING | Distribution metrics & enquiry modal |
| `/process` | Public | *Missing in router.tsx* | BROKEN | Linked from `ProgrammePage.tsx:80`; returns 404 |
| `/login` | Public / Unauth | `LoginPage.tsx (signin)` | WORKING | Live JWT/Supabase sign-in |
| `/signup` | Public / Unauth | `LoginPage.tsx (signup)` | BROKEN | URL mounts with `mode='signin'`; ignores `/signup` |
| `/forgot-password` | Public / Unauth | `LoginPage.tsx (forgot)` | BROKEN | URL mounts with `mode='signin'`; ignores path |
| `/reset-password` | Public / Unauth | `ResetPasswordPage.tsx` | WORKING | Validates token/hash and calls `updatePassword` |
| `/password-change` | Public / Unauth | `ResetPasswordPage.tsx` | WORKING | Alias route for password reset |
| `/confirm-email` | Public / Unauth | `ConfirmEmailPage.tsx` | WORKING | Calls `jwtAdapter.verifyEmail(hash)` |
| `/super-admin` | `super_admin` | Redirect -> `/super-admin/organisations` | WORKING | Redirects to default section |
| `/super-admin/$section` | `super_admin` | `SuperAdminWorkspace.tsx` | WORKING | Dashboard, orgs, access, features, settings, support, audit |
| `/super-admin/organisations/$id` | `super_admin` | `SuperAdminWorkspace.tsx (details)` | WORKING | Detailed org profile and assigned admins |
| `/admin` | `committee_admin`, `super_admin` | Redirect -> `/admin/dashboard` | WORKING | Redirects to default dashboard |
| `/admin/$section` | `committee_admin`, `super_admin` | `AdminWorkspace.tsx` | WORKING | 16 sections (households, participants, animals, etc.) |
| `/admin/registrations/$id` | `committee_admin`, `super_admin` | `AdminWorkspace.tsx` | BROKEN | Passes `section="participants"` but ignores `$id` param |
| `/volunteer` | `volunteer`, `committee_admin`, `super_admin` | Redirect -> `/volunteer/home` | WORKING | Redirects to home |
| `/volunteer/$section` | `volunteer`, `committee_admin`, `super_admin` | `VolunteerWorkspace.tsx` | WORKING | Home, tasks, department, schedule, issues, updates |
| `/participant` | `participant`, `committee_admin`, `super_admin` | Redirect -> `/participant/overview` | WORKING | Redirects to overview |
| `/participant/$section` | `participant`, `committee_admin`, `super_admin` | `ParticipantWorkspace.tsx` | BROKEN | `if (!participant) return null;` renders white screen on login |
| `/dashboard`, `/dashboard/$section` | `participant`, `committee_admin`, `super_admin` | Redirect -> `/participant/$section` | WORKING | Legacy alias route |

---

## 2. In-Depth Root Cause Analysis

### A. Review Drawer with Excessive Empty "—" Rows
- **File:** `frontend/src/components/app/AdminWorkspace.tsx:1285-1294`
- **File:** `frontend/src/lib/workflow.ts:59-120`
- **Root Cause:**
  In `lib/workflow.ts`, `normalizeRow()` initializes 55 universal schema fields (`animal`, `amount`, `weight`, `stage`, `supplier`, `documentation`, `category`, `locality`, etc.) to empty string `""` for every record type.
  When clicking any row to view details (`modal === "details"`), `AdminWorkspace.tsx` executes:
  ```tsx
  {Object.entries(selected).map(([k, v]) => (
    <div key={k} className="grid grid-cols-[110px_1fr] gap-4 py-3 text-sm">
      <dt className="capitalize text-muted-foreground">{k}</dt>
      <dd className="break-words font-medium">{v || "—"}</dd>
    </div>
  ))}
  ```
  Because all 55 keys exist on `selected`, the drawer renders 40+ rows displaying `—`.
- **Required Fix (P0):**
  1. Filter out empty/null values: `Object.entries(selected).filter(([k, v]) => v !== "" && v !== null && v !== undefined)`
  2. Or restrict keys to the entity's configured fields (`cfg.fields` / `cfg.columns`) plus non-empty metadata (`id`, `status`).

### B. "Add Sample Record" Modal & Missing API Persistence
- **File:** `frontend/src/components/app/AdminWorkspace.tsx:443-488`, `616-624`, `1234-1236`
- **Root Cause:**
  - The modal title is hardcoded to `title={modal === "add" ? "Add sample record" : ...}` regardless of context.
  - The toast is hardcoded to `toast.success('${selected ? "Updated" : "Added"} sample record')`.
  - While `saveRecord()` dispatches live API calls for `animals`, `groups`, `expenses`, `communication`, and `households`, it completely skips backend calls for `participants`, `payments`, `volunteers`, `scheduling`, and `distribution`.
  - When creating a participant, `household` is rendered as a plain uncontrolled text field (`<Field name="household" label="Household reference" />`) instead of a dropdown of existing households.
- **Required Fix (P1):**
  1. Dynamic modal title: `modal === "add" ? "Add " + (entityTitle) : "Edit " + (entityTitle)`.
  2. Change toast message to remove "sample".
  3. Wire `registrationAdapter`, `financeAdapter.recordPayment`, and volunteer/scheduling adapters into `saveRecord()`.
  4. Provide a household selector for participant creation.

### C. Participant Workspace Blank Screen Bug
- **File:** `frontend/src/components/app/ParticipantWorkspace.tsx:67`
- **Root Cause:**
  `ParticipantWorkspace.tsx` contains:
  ```tsx
  const { participant, enter } = useParticipant();
  if (!participant) return null;
  ```
  `ParticipantSession` expects an object stored in `sessionStorage['eid-demo-participant']`. When a real participant signs in via `LoginPage.tsx` (using NestJS JWT or Supabase), `useAuth().profile` is populated, but `ParticipantSession` remains empty. Consequently, `participant` is `null` and the entire workspace returns `null` (blank screen).
- **Required Fix (P0):**
  Synchronize `ParticipantSession` with `useAuth().profile` or fallback to `profile` when `participant` is not set:
  ```tsx
  const activeParticipant = participant || (profile ? {
    name: profile.name,
    email: profile.email,
    activity: "Participant",
    reference: (profile as any).reference || "QOS-2027-001",
    status: "Approved",
  } : null);
  ```

### D. Authentication Tabs & UX Redundancy
- **File:** `frontend/src/pages/LoginPage.tsx:19`, `118-154`, `231-248`
- **Root Cause:**
  - `LoginPage` defines `const [mode, setMode] = useState<AuthMode>("signin");`. When router navigates to `/signup` or `/forgot-password`, `mode` remains `"signin"`.
  - Tab buttons provide "Sign in", "Register", "Recovery". Underneath the form, a "Forgot password?" button also switches to `"forgot"`.
  - In `LoginPage.tsx:225`, Google sign-in success hardcodes `redirectForRole("participant")` ignoring the user's assigned role.
- **Required Fix (P1):**
  1. Initialize `mode` from URL pathname: `window.location.pathname === "/signup" ? "signup" : window.location.pathname === "/forgot-password" ? "forgot" : "signin"`.
  2. Consolidate "Recovery" tab and "Forgot password?" link to avoid redundant triggers.
  3. Look up user profile role upon Google sign-in before redirecting.

### E. Notification Architecture Across Portal & Pages
- **Findings:**
  - Header Shell (`PortalShell.tsx`): Has no notification bell button or drawer. `Bell` is imported only as an icon for the participant "Updates" menu item.
  - Public Site: Notices are fetched on Landing Page via `communicationsAdapter.publicAnnouncements` and displayed as cards, linking to `/announcements`.
  - Programme Page (`/announcements`): Renders from client `DemoStore.records.announcements` rather than live backend.
  - Admin (`/admin/communication`): Lists announcements, allows creating and publishing drafts via `communicationsAdapter`.
  - Volunteer (`/volunteer/updates` & `/volunteer/home`): Shows notices targeted to `["All users", "Volunteers", dept]`.
  - Participant (`/participant/updates` & `/participant/overview`): Shows notices targeted to `["All users", "Participants"]`.

---

## 3. Priority Fix Plan

1. **Fix Participant Blank Screen (`ParticipantWorkspace.tsx:67`)**
2. **Fix Review Drawer Empty Rows (`AdminWorkspace.tsx:1285-1294`)**
3. **Remove "Add Sample Record" Modal Title & "Sample" Toast Copy (`AdminWorkspace.tsx:443-488`, `1234-1236`)**
4. **Remove Unwanted Notification Clutter on Home Pages (`VolunteerWorkspace.tsx:119`, `ParticipantWorkspace.tsx:151`)**
5. **Fix Login Mode Initialization (`LoginPage.tsx:19`) and remove Recovery Tab**
6. **Fix `/process` 404 Route (`router.tsx:77-126`)**
7. **Ensure clean data tables with search, filtering and no excessive rows**
