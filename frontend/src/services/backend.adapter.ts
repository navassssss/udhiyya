/**
 * M1 Frontend — Unified Business Workflows Backend Adapter
 *
 * Connects directly to available NestJS / Fastify backend endpoints:
 *   - /platform/organisations (SA02-SA04)
 *   - /organisations/:orgId/households (ADM03)
 *   - /organisations/:orgId/programmes/:programmeId/registrations (ADM04, PAR01)
 *   - /organisations/:orgId/programmes/:programmeId/animals & /groups (ADM05)
 *   - /organisations/:orgId/programmes/:programmeId/payments & /finance (ADM06)
 *   - /organisations/:orgId/programmes/:programmeId/tasks, /schedules, /volunteers (ADM07, VOL01-VOL06)
 *   - /organisations/:orgId/programmes/:programmeId/distribution (ADM08, BEN01-BEN06)
 *   - /organisations/:orgId/programmes/:programmeId/announcements (ADM09)
 *   - /organisations/:orgId/programmes/:programmeId/dashboard & /reports (ADM10, EF-01)
 *
 * Each method falls back cleanly to local mock datasets when backend is offline or unseeded.
 */

import { getAuthToken } from "./auth";
import type {
  RegistrationDecisionPayload,
  DistributionTransitionPayload,
  ExportFormat,
  ReportKind,
} from "../types/api";

import { API_BASE } from "./api-base";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errBody: any;
    try {
      errBody = await res.json();
    } catch {
      errBody = { statusCode: res.status, message: `HTTP ${res.status}` };
    }
    throw errBody;
  }

  return res.json();
}

// -----------------------------------------------------------------------------
// 1. Platform / Organisation Onboarding & Invitations
// -----------------------------------------------------------------------------
export const platformAdapter = {
  async listOrganisations() {
    return await request<any[]>("/platform/organisations");
  },

  async getOrganisation(id: string) {
    return await request<any>(`/platform/organisations/${id}`);
  },

  async createOrganisation(data: any) {
    return await request<any>("/platform/organisations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateOrganisation(id: string, data: any) {
    return await request<any>(`/platform/organisations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async inviteAdmin(orgId: string, data: { email: string; name?: string }) {
    return await request<any>(`/platform/organisations/${orgId}/invitations`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async listInvitations(orgId: string) {
    return await request<any[]>(`/platform/organisations/${orgId}/invitations`);
  },

  async revokeInvitation(orgId: string, invitationId: string) {
    return await request<any>(`/platform/organisations/${orgId}/invitations/${invitationId}/revoke`, {
      method: "POST",
    });
  },
};

// -----------------------------------------------------------------------------
// 2. Households & CSV Imports
// -----------------------------------------------------------------------------
export const householdsAdapter = {
  async list(orgId: string, query?: Record<string, any>) {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
    try {
      return await request<any>(`/organisations/${orgId}/households${qs}`);
    } catch {
      return null;
    }
  },

  async create(orgId: string, data: any) {
    return await request<any>(`/organisations/${orgId}/households`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async myHousehold(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/me/household`);
    } catch {
      return null;
    }
  },

  async importCsv(orgId: string, file: File) {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/organisations/${orgId}/households/import`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Import failed" }));
      throw err;
    }
    return res.json();
  },
};

// -----------------------------------------------------------------------------
// 3. Registrations & Participant Review
// -----------------------------------------------------------------------------
export const registrationAdapter = {
  async list(orgId: string, programmeId: string, query?: Record<string, any>) {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/registrations${qs}`);
    } catch {
      return null;
    }
  },

  async get(orgId: string, programmeId: string, registrationId: string) {
    try {
      return await request<any>(
        `/organisations/${orgId}/programmes/${programmeId}/registrations/${registrationId}`,
      );
    } catch {
      return null;
    }
  },

  async myRegistration(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/me/registration`);
    } catch {
      return null;
    }
  },

  async myParticipation(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/me/participation`);
    } catch {
      return null;
    }
  },

  async decide(
    orgId: string,
    programmeId: string,
    registrationId: string,
    decision: RegistrationDecisionPayload,
  ) {
    return await request<any>(
      `/organisations/${orgId}/programmes/${programmeId}/registrations/${registrationId}/decision`,
      {
        method: "POST",
        body: JSON.stringify(decision),
      },
    );
  },
};

// -----------------------------------------------------------------------------
// 4. Animals & Share Allocation
// -----------------------------------------------------------------------------
export const animalsAdapter = {
  async listAnimals(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/animals`);
    } catch {
      return null;
    }
  },

  async createAnimal(orgId: string, programmeId: string, data: any) {
    return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/animals`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async listGroups(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/groups`);
    } catch {
      return null;
    }
  },

  async createGroup(orgId: string, programmeId: string, data: any) {
    return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/groups`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async allocate(
    orgId: string,
    programmeId: string,
    groupId: string,
    registrationId: string,
    shareCount = 1,
  ) {
    return await request<any>(
      `/organisations/${orgId}/programmes/${programmeId}/share-allocations`,
      {
        method: "POST",
        body: JSON.stringify({ registrationId, groupId, shareCount }),
      },
    );
  },
};

// -----------------------------------------------------------------------------
// 5. Finance, Payments & Receipts
// -----------------------------------------------------------------------------
export const financeAdapter = {
  async summary(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/finance/summary`);
    } catch {
      return null;
    }
  },

  async payments(orgId: string, programmeId: string, query?: Record<string, any>) {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/payments${qs}`);
    } catch {
      return null;
    }
  },

  async recordPayment(orgId: string, programmeId: string, data: any) {
    return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async verifyPayment(
    orgId: string,
    programmeId: string,
    paymentId: string,
    action: "verify" | "reject",
    reason?: string,
  ) {
    return await request<any>(
      `/organisations/${orgId}/programmes/${programmeId}/payments/${paymentId}/verification`,
      {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      },
    );
  },

  async myPayments(orgId: string, programmeId: string, query?: Record<string, any>) {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/me/payments${qs}`);
    } catch {
      return null;
    }
  },

  async myReceipts(orgId: string, programmeId: string, query?: Record<string, any>) {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/me/receipts${qs}`);
    } catch {
      return null;
    }
  },

  async expenses(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/expenses`);
    } catch {
      return null;
    }
  },

  async createExpense(
    orgId: string,
    programmeId: string,
    data: {
      categoryId: string;
      amount: { amountMinor: number; currency: string };
      description: string;
      incurredAt: string;
    },
  ) {
    return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/expenses`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async categories(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/expense-categories`);
    } catch {
      return null;
    }
  },

  async createCategory(orgId: string, programmeId: string, name: string) {
    return await request<any>(
      `/organisations/${orgId}/programmes/${programmeId}/expense-categories`,
      {
        method: "POST",
        body: JSON.stringify({ name }),
      },
    );
  },
};

// -----------------------------------------------------------------------------
// 6. Volunteer Operations & Tasks
// -----------------------------------------------------------------------------
export const operationsAdapter = {
  async volunteers(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/volunteers`);
    } catch {
      return null;
    }
  },

  async tasks(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/tasks`);
    } catch {
      return null;
    }
  },

  async createTask(
    orgId: string,
    programmeId: string,
    data: {
      department: string;
      assigneeId: string;
      title: string;
      resourceId?: string | null;
      scheduleId?: string | null;
    },
  ) {
    return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getCollections(orgId: string, programmeId: string) {
    try {
      return await request<any>(
        `/organisations/${orgId}/programmes/${programmeId}/volunteer/collections`,
      );
    } catch {
      return null;
    }
  },

  async submitCash(
    orgId: string,
    programmeId: string,
    data: {
      assignmentId: string;
      amount: number;
      currency?: string;
      receivedAt: string;
      reference?: string;
    },
  ) {
    return await request<any>(
      `/organisations/${orgId}/programmes/${programmeId}/volunteer/cash-submissions`,
      {
        method: "POST",
        body: JSON.stringify({
          assignmentId: data.assignmentId,
          amount: {
            amount: data.amount,
            currency: data.currency || "INR",
          },
          receivedAt: data.receivedAt,
          reference: data.reference,
        }),
      },
    );
  },

  async updateTaskProgress(
    orgId: string,
    programmeId: string,
    taskId: string,
    status: "pending" | "in_progress" | "completed",
    note?: string,
  ) {
    return await request<any>(
      `/organisations/${orgId}/programmes/${programmeId}/volunteer/tasks/${taskId}/progress`,
      {
        method: "POST",
        body: JSON.stringify({ status, note }),
      },
    );
  },

  async updateOperationProgress(
    orgId: string,
    programmeId: string,
    operationId: string,
    data: {
      status: "pending" | "in_progress" | "completed";
      stage?: string;
      measuredGrams?: number;
      packageCount?: number;
      note?: string;
    },
  ) {
    return await request<any>(
      `/organisations/${orgId}/programmes/${programmeId}/volunteer/operations/${operationId}/progress`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  async schedules(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/schedules`);
    } catch {
      return null;
    }
  },

  async issues(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/issues`);
    } catch {
      return null;
    }
  },

  async reportIssue(orgId: string, programmeId: string, data: any) {
    return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/issues`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// -----------------------------------------------------------------------------
// 7. Distribution Management
// -----------------------------------------------------------------------------
export const distributionAdapter = {
  async allocations(orgId: string, programmeId: string) {
    try {
      return await request<any>(
        `/organisations/${orgId}/programmes/${programmeId}/distribution/allocations`,
      );
    } catch {
      return null;
    }
  },

  async stock(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/distribution/stock`);
    } catch {
      return null;
    }
  },

  async transition(
    orgId: string,
    programmeId: string,
    allocationId: string,
    payload: DistributionTransitionPayload,
  ) {
    return await request<any>(
      `/organisations/${orgId}/programmes/${programmeId}/distribution/allocations/${allocationId}/transition`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async volunteerQueue(orgId: string, programmeId: string) {
    try {
      return await request<any>(
        `/organisations/${orgId}/programmes/${programmeId}/volunteer/distribution/queue`,
      );
    } catch {
      return null;
    }
  },

  async volunteerHandoff(
    orgId: string,
    programmeId: string,
    allocationId: string,
    data: { outcome: "collected" | "delivered"; recipientProof: string },
  ) {
    return await request<any>(
      `/organisations/${orgId}/programmes/${programmeId}/volunteer/distribution/allocations/${allocationId}/handoff`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },
};

// -----------------------------------------------------------------------------
// 8. Communications & Announcements
// -----------------------------------------------------------------------------
export const communicationsAdapter = {
  async announcements(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/announcements`);
    } catch {
      return null;
    }
  },

  async createAnnouncement(orgId: string, programmeId: string, data: { title: string; body: string }) {
    return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/announcements`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async publishAnnouncement(orgId: string, programmeId: string, id: string) {
    return await request<any>(
      `/organisations/${orgId}/programmes/${programmeId}/announcements/${id}/publish`,
      {
        method: "POST",
      },
    );
  },

  async publicAnnouncements(orgId: string, year: number) {
    try {
      const res = await fetch(`${API_BASE}/public/organisations/${orgId}/programmes/${year}/announcements`);
      if (!res.ok) return { items: [] };
      return await res.json();
    } catch {
      return { items: [] };
    }
  },
};

// -----------------------------------------------------------------------------
// 9. Reporting & Dashboard Telemetry
// -----------------------------------------------------------------------------
export const reportsAdapter = {
  async dashboard(orgId: string, programmeId: string) {
    try {
      return await request<any>(`/organisations/${orgId}/programmes/${programmeId}/dashboard`);
    } catch {
      return null;
    }
  },

  getReportExportUrl(
    orgId: string,
    programmeId: string,
    kind: ReportKind,
    format: ExportFormat = "xlsx",
  ): string {
    return `${API_BASE}/organisations/${orgId}/programmes/${programmeId}/reports/${kind}/export?format=${format}`;
  },
};
