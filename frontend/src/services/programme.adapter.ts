/**
 * M1 Frontend — Programme Setup Backend Adapter (ADM02)
 *
 * Connects directly to NestJS Programme routes:
 *   GET    /organisations/:orgId/programmes
 *   POST   /organisations/:orgId/programmes
 *   GET    /organisations/:orgId/programmes/:programmeId
 *   PATCH  /organisations/:orgId/programmes/:programmeId
 *   POST   /organisations/:orgId/programmes/:programmeId/publish
 *
 * Contract baseline: docs/API-CONTRACT.md + commit f1f261a
 */

import { getAuthToken } from "./auth";
import type {
  Programme,
  PaginatedList,
  ApiError,
  Money,
} from "../types/api";
import * as mockClient from "../mocks/api-client.mock";

import { API_BASE } from "./api-base";

export interface CreateProgrammeInput {
  year: number;
  title: string;
}

export interface UpdateProgrammeInput {
  title?: string;
  description?: string | null;
  guidelines?: string | null;
  publicContact?: { email: string } | null;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  registrationLimit?: number | null;
  price?: Money | null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errBody: any;
      try {
        errBody = await res.json();
      } catch {
        errBody = { statusCode: res.status, error: res.statusText, message: `HTTP ${res.status}` };
      }
      const error: ApiError = {
        statusCode: errBody.statusCode || res.status,
        error: errBody.error || res.statusText,
        message: errBody.message || "Request failed",
        code: errBody.code,
      };
      throw error;
    }

    return res.json();
  } catch (err: any) {
    if (err && typeof err === "object" && "statusCode" in err) {
      throw err;
    }
    // Network failure (e.g. backend server not started locally)
    const netErr: ApiError = {
      statusCode: 503,
      error: "Service Unavailable",
      message: err.message || "Failed to connect to backend server at " + API_BASE,
      code: "NETWORK_ERROR",
    };
    throw netErr;
  }
}

export const programmeAdapter = {
  /**
   * List programmes for an organisation
   * GET /organisations/:orgId/programmes?cursor=&limit=
   */
  async listProgrammes(orgId: string, query?: { cursor?: string; limit?: number }): Promise<PaginatedList<Programme>> {
    try {
      const q = new URLSearchParams();
      if (query?.cursor) q.set("cursor", query.cursor);
      if (query?.limit) q.set("limit", String(query.limit));
      const qs = q.toString() ? `?${q.toString()}` : "";
      return await request<PaginatedList<Programme>>(`/organisations/${orgId}/programmes${qs}`);
    } catch (err: any) {
      if (err.code === "NETWORK_ERROR") {
        console.warn("[programmeAdapter] Backend offline, falling back to mock fixtures:", err.message);
        return mockClient.listProgrammes(orgId, query);
      }
      throw err;
    }
  },

  /**
   * Get single programme detail
   * GET /organisations/:orgId/programmes/:programmeId
   */
  async getProgramme(orgId: string, programmeId: string): Promise<Programme> {
    try {
      return await request<Programme>(`/organisations/${orgId}/programmes/${programmeId}`);
    } catch (err: any) {
      if (err.code === "NETWORK_ERROR") {
        console.warn("[programmeAdapter] Backend offline, falling back to mock fixture:", err.message);
        return mockClient.getProgramme(orgId, programmeId);
      }
      throw err;
    }
  },

  /**
   * Create a new programme in draft status
   * POST /organisations/:orgId/programmes
   */
  async createProgramme(orgId: string, input: CreateProgrammeInput): Promise<Programme> {
    try {
      const payload = {
        year: Number(input.year),
        title: input.title.trim(),
      };
      return await request<Programme>(`/organisations/${orgId}/programmes`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      if (err.code === "NETWORK_ERROR") {
        console.warn("[programmeAdapter] Backend offline, creating in mock storage:", err.message);
        return mockClient.createProgramme(orgId, input);
      }
      throw err;
    }
  },

  /**
   * Update programme fields (draft or published)
   * PATCH /organisations/:orgId/programmes/:programmeId
   */
  async updateProgramme(
    orgId: string,
    programmeId: string,
    input: UpdateProgrammeInput,
  ): Promise<Programme> {
    try {
      const payload: Record<string, any> = {};

      if (input.title !== undefined) payload.title = input.title.trim();
      if (input.description !== undefined) payload.description = input.description;
      if (input.guidelines !== undefined) payload.guidelines = input.guidelines;

      if (input.publicContact !== undefined) {
        payload.publicContact = input.publicContact ? { email: input.publicContact.email } : null;
      }

      if (input.registrationOpensAt !== undefined) {
        payload.registrationOpensAt = input.registrationOpensAt
          ? new Date(input.registrationOpensAt).toISOString()
          : null;
      }

      if (input.registrationClosesAt !== undefined) {
        payload.registrationClosesAt = input.registrationClosesAt
          ? new Date(input.registrationClosesAt).toISOString()
          : null;
      }

      if (input.registrationLimit !== undefined) {
        payload.registrationLimit = input.registrationLimit !== null ? Number(input.registrationLimit) : null;
      }

      if (input.price !== undefined) {
        payload.price = input.price
          ? { amountMinor: Math.round(Number(input.price.amountMinor)), currency: "INR" }
          : null;
      }

      return await request<Programme>(`/organisations/${orgId}/programmes/${programmeId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      if (err.code === "NETWORK_ERROR") {
        console.warn("[programmeAdapter] Backend offline, updating in mock storage:", err.message);
        return mockClient.updateProgramme(orgId, programmeId, input as any);
      }
      throw err;
    }
  },

  /**
   * Publish a programme
   * POST /organisations/:orgId/programmes/:programmeId/publish
   */
  async publishProgramme(orgId: string, programmeId: string): Promise<Programme> {
    try {
      return await request<Programme>(`/organisations/${orgId}/programmes/${programmeId}/publish`, {
        method: "POST",
      });
    } catch (err: any) {
      if (err.code === "NETWORK_ERROR") {
        console.warn("[programmeAdapter] Backend offline, publishing in mock storage:", err.message);
        return mockClient.publishProgramme(orgId, programmeId);
      }
      throw err;
    }
  },
};
