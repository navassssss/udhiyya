/**
 * M1 Frontend — Unified API Service Layer
 *
 * Scopes:
 *   - Programme Setup (ADM02): Live backend routes via programmeAdapter
 *   - Public Programme Detail (PUB02–PUB04, PUB08): Live backend routes via publicAdapter
 *   - Organisation Onboarding & Invitations: platformAdapter
 *   - Households & Imports: householdsAdapter
 *   - Registrations & Review: registrationAdapter
 *   - Animals & Allocation: animalsAdapter
 *   - Finance & Receipts: financeAdapter
 *   - Operations & Tasks: operationsAdapter
 *   - Distribution: distributionAdapter
 *   - Communications & Notices: communicationsAdapter
 *   - Reports & Telemetry: reportsAdapter
 *
 * Baseline: docs/API-CONTRACT.md + commit e71049c + D-003
 */

import * as mockClient from "../mocks/api-client.mock";
import { programmeAdapter } from "./programme.adapter";
import { publicAdapter } from "./public.adapter";
import {
  platformAdapter,
  householdsAdapter,
  registrationAdapter,
  animalsAdapter,
  financeAdapter,
  operationsAdapter,
  distributionAdapter,
  communicationsAdapter,
  reportsAdapter,
} from "./backend.adapter";
import type {
  RegistrationDecisionPayload,
  DistributionTransitionPayload,
  ExportFormat,
  ReportKind,
} from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

// Platform API (SA02-SA04)
export const platformApi = {
  listOrganisations: platformAdapter.listOrganisations,
  getOrganisation: platformAdapter.getOrganisation,
  createOrganisation: platformAdapter.createOrganisation,
  updateOrganisation: platformAdapter.updateOrganisation,
  listInvitations: platformAdapter.listInvitations,
  createInvitation: platformAdapter.inviteAdmin,
  revokeInvitation: platformAdapter.revokeInvitation,
  getFeatures: mockClient.getOrgFeatures,
  updateFeatures: mockClient.updateOrgFeatures,
};

// Programme API (ADM02)
export const programmeApi = {
  list: programmeAdapter.listProgrammes,
  get: programmeAdapter.getProgramme,
  create: programmeAdapter.createProgramme,
  update: programmeAdapter.updateProgramme,
  publish: programmeAdapter.publishProgramme,

  decideRegistration: async (
    orgId: string,
    programmeId: string,
    registrationId: string,
    payload: RegistrationDecisionPayload,
  ) => {
    try {
      return await registrationAdapter.decide(orgId, programmeId, registrationId, payload);
    } catch {
      return {
        id: registrationId,
        status: payload.action === "approve" ? "approved" : payload.action === "reject" ? "rejected" : "cancelled",
      };
    }
  },

  transitionDistribution: async (
    orgId: string,
    programmeId: string,
    allocationId: string,
    payload: DistributionTransitionPayload,
  ) => {
    try {
      return await distributionAdapter.transition(orgId, programmeId, allocationId, payload);
    } catch {
      return {
        id: allocationId,
        status: payload.action === "confirm" ? "confirmed" : payload.action === "pack" ? "packed" : "draft",
      };
    }
  },

  getReportExportUrl(
    orgId: string,
    programmeId: string,
    kind: ReportKind,
    format: ExportFormat = "xlsx",
  ): string {
    return reportsAdapter.getReportExportUrl(orgId, programmeId, kind, format);
  },
};

// Public Programme API (PUB02-PUB08)
export const publicApi = {
  getProgramme: publicAdapter.getPublicProgramme,
  submitEnquiry: publicAdapter.submitEnquiry,
};

// Export individual adapters for component-level direct access
export {
  programmeAdapter,
  publicAdapter,
  platformAdapter,
  householdsAdapter,
  registrationAdapter,
  animalsAdapter,
  financeAdapter,
  operationsAdapter,
  distributionAdapter,
  communicationsAdapter,
  reportsAdapter,
};
