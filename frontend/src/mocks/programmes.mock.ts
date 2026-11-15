/**
 * M1 Frontend Mock — Programmes
 *
 * Derived from API contract commit 33a7555:
 *   GET  /organisations/:orgId/programmes               → PaginatedList<Programme>
 *   POST /organisations/:orgId/programmes               → Programme (draft)
 *   GET  /organisations/:orgId/programmes/:programmeId  → Programme
 *   PATCH /organisations/:orgId/programmes/:programmeId → Programme
 *   POST /organisations/:orgId/programmes/:programmeId/publish → Programme (published)
 *   GET  /public/organisations/:orgId/programmes/:year  → PublicProgramme
 *   POST /public/organisations/:orgId/programmes/:year/enquiries → { id: string }
 *
 * Owner: M1 — aligned with docs/API-CONTRACT.md and commit d432451 (D-003).
 *
 * STATUS OF GAPS (FRONTEND-NEEDS.md Section 6):
 *   GAP-03 — Public URL design (:orgId vs slug) pending M2 confirmation
 *   GAP-05 — amountMinor confirmed: minor units (paise, ÷100 = ₹) per D-003
 *   GAP-06 — publicContact confirmed: { email: string } independently set per programme
 *   GAP-08 — Post-publish editable fields confirmed: updates must preserve required public fields
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProgrammeStatus = "draft" | "published";

/** Money shape from contract — amountMinor is integer minor units (assumed paise, ÷100 = ₹) */
export type Money = {
  amountMinor: number;
  currency: "INR";
};

/** Full programme (committee-visible response — includes id, organisationId, registrationLimit) */
export type Programme = {
  id: string;
  organisationId: string;
  year: number;
  title: string;
  status: ProgrammeStatus;
  description: string | null;
  guidelines: string | null;
  publicContact: { email: string } | null;
  registrationOpensAt: string | null;  // ISO 8601 UTC
  registrationClosesAt: string | null; // ISO 8601 UTC
  registrationLimit: number | null;    // positive integer
  price: Money;
};

/** Public projection — id, organisationId, registrationLimit are excluded per M2 contract */
export type PublicProgramme = {
  year: number;
  title: string;
  status: ProgrammeStatus;
  description: string | null;
  guidelines: string | null;
  publicContact: { email: string } | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  price: Money;
};

export type PaginatedList<T> = {
  items: T[];
  nextCursor: string | null;
};

// ─── Registration status helper (frontend-derived — not a backend field) ──────

export type RegistrationStatus = "upcoming" | "open" | "ended" | "not-configured";

export function registrationStatus(programme: Pick<PublicProgramme, "registrationOpensAt" | "registrationClosesAt">): RegistrationStatus {
  const { registrationOpensAt, registrationClosesAt } = programme;
  if (!registrationOpensAt || !registrationClosesAt) return "not-configured";
  const now = Date.now();
  const opens = new Date(registrationOpensAt).getTime();
  const closes = new Date(registrationClosesAt).getTime();
  if (now < opens) return "upcoming";
  if (now >= opens && now < closes) return "open";
  return "ended";
}

// ─── Money helper (amountMinor / 100 → ₹, format en-IN) ──────────────────────
// ASSUMED: amountMinor / 100 = rupees. GAP-05 — awaiting M2 confirmation.

export function formatMoney(money: Money): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: money.currency,
    maximumFractionDigits: 0,
  }).format(money.amountMinor / 100);
}

// ─── Fixtures (committee-visible) ─────────────────────────────────────────────

/** GET /organisations/org_noor/programmes → PaginatedList<Programme> */
export const mockProgrammesList: Record<string, PaginatedList<Programme>> = {
  org_noor: {
    items: [
      {
        id: "prog_noor_2027",
        organisationId: "org_noor",
        year: 2027,
        title: "Annual Aḍḥiyah Programme 2027",
        status: "published",
        description: "Annual Aḍḥiyah programme for the residents of Noor Mahallu.",
        guidelines:
          "Participation is open to registered households only. Submit your household and participation details for committee review before the closing date.",
        publicContact: { email: "programme@noor.example" },
        registrationOpensAt: "2027-04-01T03:30:00Z",
        registrationClosesAt: "2027-05-01T03:30:00Z",
        registrationLimit: 150,
        price: { amountMinor: 850000, currency: "INR" },
      },
      {
        id: "prog_noor_2026",
        organisationId: "org_noor",
        year: 2026,
        title: "Annual Aḍḥiyah Programme 2026",
        status: "published",
        description: "Previous year's programme archive.",
        guidelines: "Registration is closed for 2026.",
        publicContact: { email: "programme@noor.example" },
        registrationOpensAt: "2026-04-01T03:30:00Z",
        registrationClosesAt: "2026-05-01T03:30:00Z",
        registrationLimit: 130,
        price: { amountMinor: 820000, currency: "INR" },
      },
    ],
    nextCursor: null,
  },
  org_alhuda: {
    items: [
      {
        id: "prog_alhuda_2027",
        organisationId: "org_alhuda",
        year: 2027,
        title: "Al Huda Aḍḥiyah Programme",
        status: "draft",
        description: null,
        guidelines: null,
        publicContact: null,
        registrationOpensAt: null,
        registrationClosesAt: null,
        registrationLimit: null,
        price: { amountMinor: 0, currency: "INR" },
      },
    ],
    nextCursor: null,
  },
};

/** GET /organisations/:orgId/programmes/:programmeId → Programme */
export const mockProgrammeDetail: Record<string, Programme> = {
  prog_noor_2027: {
    id: "prog_noor_2027",
    organisationId: "org_noor",
    year: 2027,
    title: "Annual Aḍḥiyah Programme 2027",
    status: "published",
    description: "Annual Aḍḥiyah programme for the residents of Noor Mahallu.",
    guidelines:
      "Participation is open to registered households only. Submit your household and participation details for committee review before the closing date.",
    publicContact: { email: "programme@noor.example" },
    registrationOpensAt: "2027-04-01T03:30:00Z",
    registrationClosesAt: "2027-05-01T03:30:00Z",
    registrationLimit: 150,
    price: { amountMinor: 850000, currency: "INR" },
  },
  prog_alhuda_2027: {
    id: "prog_alhuda_2027",
    organisationId: "org_alhuda",
    year: 2027,
    title: "Al Huda Aḍḥiyah Programme",
    status: "draft",
    description: null,
    guidelines: null,
    publicContact: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    registrationLimit: null,
    price: { amountMinor: 0, currency: "INR" },
  },
};

// ─── Fixtures (public projection) ─────────────────────────────────────────────

/**
 * GET /public/organisations/:orgId/programmes/:year → PublicProgramme
 * Note: id, organisationId, registrationLimit are NOT returned in the public response.
 */
export const mockPublicProgrammes: Record<string, Record<number, PublicProgramme>> = {
  org_noor: {
    2027: {
      year: 2027,
      title: "Annual Aḍḥiyah Programme 2027",
      status: "published",
      description: "Annual Aḍḥiyah programme for the residents of Noor Mahallu.",
      guidelines:
        "Participation is open to registered households only. Submit your household and participation details for committee review before the closing date.",
      publicContact: { email: "programme@noor.example" },
      registrationOpensAt: "2027-04-01T03:30:00Z",
      registrationClosesAt: "2027-05-01T03:30:00Z",
      price: { amountMinor: 850000, currency: "INR" },
    },
  },
};

// ─── Error responses (mirror API contract error shape) ─────────────────────────

/** 409 — from POST /organisations/:orgId/programmes when year already exists */
export const mockProgrammeYearConflictError = {
  statusCode: 409,
  error: "Conflict",
  message: "A programme already exists for this year",
  code: "PROGRAMME_YEAR_EXISTS",
  timestamp: "2027-01-01T00:00:00.000Z",
  path: "/organisations/org_noor/programmes",
};

/** 400 — from POST /publish when required fields are missing */
export const mockPublishValidationError = {
  statusCode: 400,
  error: "Bad Request",
  message: [
    "description must not be empty",
    "publicContact.email must be a valid email",
    "registrationOpensAt must be a future date",
  ],
  timestamp: "2027-01-01T00:00:00.000Z",
  path: "/organisations/org_alhuda/programmes/prog_alhuda_2027/publish",
};
