/**
 * M1 Frontend — Public Programme Backend Adapter (PUB02–PUB04, PUB08)
 *
 * Connects directly to NestJS Public Programme routes:
 *   GET   /public/organisations/:orgId/programmes/:year
 *   POST  /public/organisations/:orgId/programmes/:year/enquiries
 *
 * Contract baseline: docs/API-CONTRACT.md + commit f1f261a
 */

import type {
  PublicProgramme,
  EnquiryPayload,
  EnquiryResponse,
  ApiError,
} from "../types/api";
import * as mockClient from "../mocks/api-client.mock";

import { API_BASE } from "./api-base";

export const publicAdapter = {
  /**
   * Fetch public programme projection for an active organisation and year
   * Anonymous endpoint — no auth header required
   * GET /public/organisations/:orgId/programmes/:year
   */
  async getPublicProgramme(orgId: string, year: number): Promise<PublicProgramme> {
    try {
      const res = await fetch(`${API_BASE}/public/organisations/${orgId}/programmes/${year}`, {
        headers: { "Content-Type": "application/json" },
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
          message: errBody.message || "Public programme not found or not published",
          code: errBody.code,
        };
        throw error;
      }

      return await res.json();
    } catch (err: any) {
      if (err && typeof err === "object" && "statusCode" in err) {
        throw err;
      }
      console.warn("[publicAdapter] Backend offline, returning mock public projection:", err.message);
      return mockClient.getPublicProgramme(orgId, year);
    }
  },

  /**
   * Submit an enquiry regarding a programme
   * POST /public/organisations/:orgId/programmes/:year/enquiries
   */
  async submitEnquiry(
    orgId: string,
    year: number,
    payload: EnquiryPayload,
  ): Promise<EnquiryResponse> {
    try {
      const res = await fetch(
        `${API_BASE}/public/organisations/${orgId}/programmes/${year}/enquiries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

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
          message: errBody.message || "Failed to submit enquiry",
          code: errBody.code,
        };
        throw error;
      }

      return await res.json();
    } catch (err: any) {
      if (err && typeof err === "object" && "statusCode" in err) {
        throw err;
      }
      console.warn("[publicAdapter] Backend offline, recording in mock:", err.message);
      return mockClient.submitEnquiry(orgId, year, payload);
    }
  },
};
