/**
 * M1 Frontend — API Client (Mock Mode)
 *
 * This module wraps all API calls for the three scopes in this iteration:
 *   1. Organisation onboarding (SA02–SA04)
 *   2. Annual programme setup (ADM02)
 *   3. Public programme page (PUB02–PUB08)
 *
 * In MOCK MODE (VITE_USE_MOCK_API=true or backend not yet deployed),
 * all functions return fixture data from the *.mock.ts files.
 *
 * In REAL MODE, functions call the actual API base URL.
 *
 * Owner: M1. Aligned with docs/API-CONTRACT.md and commit d432451 (D-003).
 *
 * Base URL is read from VITE_API_BASE_URL env var.
 * Auth token is read from Supabase Auth session as Authorization: Bearer <token>.
 *
 * Contract baseline: docs/API-CONTRACT.md commit 33a7555 + D-003 conventions (commit d432451)
 */

import {
  mockOrganisationsList,
  mockOrganisationDetail,
  mockInvitations,
  mockOrgFeatures,
  type Organisation,
  type InvitationItem,
  type OrgFeatures,
  type PaginatedList,
  type FeatureKey,
} from "./organisations.mock";

import {
  mockProgrammesList,
  mockProgrammeDetail,
  mockPublicProgrammes,
  type Programme,
  type PublicProgramme,
} from "./programmes.mock";

// ─── Config ───────────────────────────────────────────────────────────────────

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === "true" || import.meta.env.DEV;
import { API_BASE } from "../services/api-base";

// Mock network delay for realistic UX development
const MOCK_DELAY_MS = 350;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS));
}

// ─── Auth token helper ─────────────────────────────────────────────────────────
// TODO: Replace with real Supabase Auth token retrieval once frontend-auth.md is received (GAP-07).
// For now, reads from sessionStorage demo token or returns empty string.

async function getAuthToken(): Promise<string> {
  if (USE_MOCK) return "mock-bearer-token";
  // Real implementation: return supabase.auth.getSession().then(s => s.data.session?.access_token ?? "")
  return "";
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Error handling ────────────────────────────────────────────────────────────

export type ApiError = {
  statusCode: number;
  error: string;
  message: string | string[];
  code?: string;
};

function isApiError(e: unknown): e is ApiError {
  return typeof e === "object" && e !== null && "statusCode" in e;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ statusCode: res.status, error: "Unknown", message: res.statusText }));
    throw body as ApiError;
  }
  return res.json() as Promise<T>;
}

export { isApiError };

// ─── Platform / Super Admin endpoints ─────────────────────────────────────────

/** GET /platform/organisations */
export async function listOrganisations(params?: {
  search?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedList<Organisation>> {
  if (USE_MOCK) {
    const items = params?.search
      ? mockOrganisationsList.items.filter(
          (o) =>
            o.name.toLowerCase().includes(params.search!.toLowerCase()) ||
            o.locality.toLowerCase().includes(params.search!.toLowerCase()),
        )
      : mockOrganisationsList.items;
    return delay({ items, nextCursor: null });
  }
  const url = new URL(`${API_BASE}/platform/organisations`);
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.cursor) url.searchParams.set("cursor", params.cursor);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), { headers: await authHeaders() });
  return handleResponse(res);
}

/** GET /platform/organisations/:orgId */
export async function getOrganisation(orgId: string): Promise<Organisation> {
  if (USE_MOCK) {
    const org = mockOrganisationDetail[orgId];
    if (!org) throw { statusCode: 404, error: "Not Found", message: "Organisation not found" } satisfies ApiError;
    return delay(org);
  }
  const res = await fetch(`${API_BASE}/platform/organisations/${orgId}`, {
    headers: await authHeaders(),
  });
  return handleResponse(res);
}

/** POST /platform/organisations */
export async function createOrganisation(body: {
  name: string;
  locality: string;
  contact: { email: string };
}): Promise<Organisation> {
  if (USE_MOCK) {
    const newOrg: Organisation = {
      id: `org_${crypto.randomUUID().slice(0, 8)}`,
      ...body,
      status: "onboarding",
    };
    mockOrganisationsList.items.unshift(newOrg);
    mockOrganisationDetail[newOrg.id] = newOrg;
    return delay(newOrg);
  }
  const res = await fetch(`${API_BASE}/platform/organisations`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

/** PATCH /platform/organisations/:orgId */
export async function updateOrganisation(
  orgId: string,
  patch: Partial<Pick<Organisation, "name" | "locality" | "contact" | "status">>,
): Promise<Organisation> {
  if (USE_MOCK) {
    const org = mockOrganisationDetail[orgId];
    if (!org) throw { statusCode: 404, error: "Not Found", message: "Organisation not found" } satisfies ApiError;
    Object.assign(org, patch);
    return delay({ ...org });
  }
  const res = await fetch(`${API_BASE}/platform/organisations/${orgId}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(patch),
  });
  return handleResponse(res);
}

/** GET /platform/organisations/:orgId/invitations */
export async function listInvitations(
  orgId: string,
  params?: { cursor?: string; limit?: number },
): Promise<PaginatedList<InvitationItem>> {
  if (USE_MOCK) {
    return delay(mockInvitations[orgId] ?? { items: [], nextCursor: null });
  }
  const url = new URL(`${API_BASE}/platform/organisations/${orgId}/invitations`);
  if (params?.cursor) url.searchParams.set("cursor", params.cursor);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), { headers: await authHeaders() });
  return handleResponse(res);
}

/** POST /platform/organisations/:orgId/invitations */
export async function createInvitation(
  orgId: string,
  body: { name: string; email: string },
): Promise<{ id: string; status: "pending" }> {
  if (USE_MOCK) {
    const inv: InvitationItem = { id: `inv_${crypto.randomUUID().slice(0, 8)}`, ...body, status: "pending" };
    if (!mockInvitations[orgId]) mockInvitations[orgId] = { items: [], nextCursor: null };
    mockInvitations[orgId].items.unshift(inv);
    return delay({ id: inv.id, status: "pending" as const });
  }
  const res = await fetch(`${API_BASE}/platform/organisations/${orgId}/invitations`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

/** POST /platform/organisations/:orgId/invitations/:id/revoke */
export async function revokeInvitation(
  orgId: string,
  invitationId: string,
): Promise<InvitationItem> {
  if (USE_MOCK) {
    const list = mockInvitations[orgId];
    const inv = list?.items.find((i) => i.id === invitationId);
    if (!inv) throw { statusCode: 404, error: "Not Found", message: "Invitation not found" } satisfies ApiError;
    inv.status = "revoked";
    return delay({ ...inv });
  }
  const res = await fetch(
    `${API_BASE}/platform/organisations/${orgId}/invitations/${invitationId}/revoke`,
    { method: "POST", headers: await authHeaders() },
  );
  return handleResponse(res);
}

/** GET /platform/organisations/:orgId/features */
export async function getOrgFeatures(orgId: string): Promise<OrgFeatures> {
  if (USE_MOCK) return delay(mockOrgFeatures[orgId] ?? { enabledFeatures: [] });
  const res = await fetch(`${API_BASE}/platform/organisations/${orgId}/features`, {
    headers: await authHeaders(),
  });
  return handleResponse(res);
}

/** PATCH /platform/organisations/:orgId/features */
export async function updateOrgFeatures(
  orgId: string,
  enabledFeatures: FeatureKey[],
): Promise<OrgFeatures> {
  if (USE_MOCK) {
    const updated = { enabledFeatures };
    mockOrgFeatures[orgId] = updated;
    return delay(updated);
  }
  const res = await fetch(`${API_BASE}/platform/organisations/${orgId}/features`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ enabledFeatures }),
  });
  return handleResponse(res);
}

// ─── Committee Admin — Programme endpoints ─────────────────────────────────────

/** GET /organisations/:orgId/programmes */
export async function listProgrammes(
  orgId: string,
  params?: { cursor?: string; limit?: number },
): Promise<PaginatedList<Programme>> {
  if (USE_MOCK) return delay(mockProgrammesList[orgId] ?? { items: [], nextCursor: null });
  const url = new URL(`${API_BASE}/organisations/${orgId}/programmes`);
  if (params?.cursor) url.searchParams.set("cursor", params.cursor);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.toString(), { headers: await authHeaders() });
  return handleResponse(res);
}

/** GET /organisations/:orgId/programmes/:programmeId */
export async function getProgramme(orgId: string, programmeId: string): Promise<Programme> {
  if (USE_MOCK) {
    const prog = mockProgrammeDetail[programmeId];
    if (!prog) throw { statusCode: 404, error: "Not Found", message: "Programme not found" } satisfies ApiError;
    return delay(prog);
  }
  const res = await fetch(`${API_BASE}/organisations/${orgId}/programmes/${programmeId}`, {
    headers: await authHeaders(),
  });
  return handleResponse(res);
}

/** POST /organisations/:orgId/programmes */
export async function createProgramme(
  orgId: string,
  body: { year: number; title: string },
): Promise<Programme> {
  if (USE_MOCK) {
    // Simulate 409 if year already exists in that org
    const existing = mockProgrammesList[orgId];
    if (existing?.items.some((p) => p.year === body.year)) {
      throw {
        statusCode: 409,
        error: "Conflict",
        message: "A programme already exists for this year",
        code: "PROGRAMME_YEAR_EXISTS",
      } satisfies ApiError;
    }
    const newProg: Programme = {
      id: `prog_${orgId}_${body.year}`,
      organisationId: orgId,
      ...body,
      status: "draft",
      description: null,
      guidelines: null,
      publicContact: null,
      registrationOpensAt: null,
      registrationClosesAt: null,
      registrationLimit: null,
      price: { amountMinor: 0, currency: "INR" },
    };
    if (!mockProgrammesList[orgId]) mockProgrammesList[orgId] = { items: [], nextCursor: null };
    mockProgrammesList[orgId].items.unshift(newProg);
    mockProgrammeDetail[newProg.id] = newProg;
    return delay(newProg);
  }
  const res = await fetch(`${API_BASE}/organisations/${orgId}/programmes`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

/** PATCH /organisations/:orgId/programmes/:programmeId */
export async function updateProgramme(
  orgId: string,
  programmeId: string,
  patch: Partial<
    Pick<
      Programme,
      | "title"
      | "description"
      | "guidelines"
      | "publicContact"
      | "registrationOpensAt"
      | "registrationClosesAt"
      | "registrationLimit"
      | "price"
    >
  >,
): Promise<Programme> {
  if (USE_MOCK) {
    const prog = mockProgrammeDetail[programmeId];
    if (!prog) throw { statusCode: 404, error: "Not Found", message: "Programme not found" } satisfies ApiError;
    Object.assign(prog, patch);
    return delay({ ...prog });
  }
  const res = await fetch(`${API_BASE}/organisations/${orgId}/programmes/${programmeId}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(patch),
  });
  return handleResponse(res);
}

/** POST /organisations/:orgId/programmes/:programmeId/publish */
export async function publishProgramme(orgId: string, programmeId: string): Promise<Programme> {
  if (USE_MOCK) {
    const prog = mockProgrammeDetail[programmeId];
    if (!prog) throw { statusCode: 404, error: "Not Found", message: "Programme not found" } satisfies ApiError;
    // Simulate server validation — required fields for publish
    const missing: string[] = [];
    if (!prog.description) missing.push("description must not be empty");
    if (!prog.guidelines) missing.push("guidelines must not be empty");
    if (!prog.publicContact?.email) missing.push("publicContact.email must be a valid email");
    if (!prog.registrationOpensAt) missing.push("registrationOpensAt is required");
    if (!prog.registrationClosesAt) missing.push("registrationClosesAt is required");
    if (!prog.registrationLimit) missing.push("registrationLimit must be a positive integer");
    if (prog.price.amountMinor <= 0) missing.push("price.amountMinor must be greater than 0");
    if (missing.length > 0) {
      throw { statusCode: 400, error: "Bad Request", message: missing } satisfies ApiError;
    }
    prog.status = "published";
    return delay({ ...prog });
  }
  const res = await fetch(
    `${API_BASE}/organisations/${orgId}/programmes/${programmeId}/publish`,
    { method: "POST", headers: await authHeaders() },
  );
  return handleResponse(res);
}

// ─── Public endpoints (anonymous) ─────────────────────────────────────────────

/** GET /public/organisations/:orgId/programmes/:year */
export async function getPublicProgramme(orgId: string, year: number): Promise<PublicProgramme> {
  if (USE_MOCK) {
    const prog = mockPublicProgrammes[orgId]?.[year];
    if (!prog)
      throw { statusCode: 404, error: "Not Found", message: "Programme not found or not published" } satisfies ApiError;
    return delay(prog);
  }
  const res = await fetch(`${API_BASE}/public/organisations/${orgId}/programmes/${year}`);
  return handleResponse(res);
}

/** POST /public/organisations/:orgId/programmes/:year/enquiries */
export async function submitEnquiry(
  orgId: string,
  year: number,
  body: { name: string; replyEmail: string; message: string },
): Promise<{ id: string }> {
  if (USE_MOCK) {
    return delay({ id: `enq_${crypto.randomUUID().slice(0, 8)}` });
  }
  const res = await fetch(
    `${API_BASE}/public/organisations/${orgId}/programmes/${year}/enquiries`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return handleResponse(res);
}
