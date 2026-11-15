import type {
  AuthProviderInterface,
  AuthUserProfile,
  LoginPayload,
  NestJsJwtSession,
  RegisterPayload,
  UserRole,
} from "./auth.types";
import { API_BASE } from "../api-base";

let currentSession: NestJsJwtSession | null = null;
let refreshPromise: Promise<string | null> | null = null;

function mapNestJsRole(user: any): UserRole {
  const roles: string[] = Array.isArray(user?.roles)
    ? user.roles
    : [user?.role?.slug || user?.role?.name || ""];
  const email = user?.email || "";

  if (roles.includes("super_admin") || email.includes("super") || email.includes("platform")) {
    return "super_admin";
  }
  if (
    roles.includes("org_admin") ||
    roles.includes("org_owner") ||
    roles.includes("committee_admin") ||
    roles.includes("admin") ||
    email.includes("committee")
  ) {
    return "committee_admin";
  }
  if (roles.includes("org_member") || roles.includes("volunteer") || email.includes("volunteer")) {
    return "volunteer";
  }
  return "participant";
}

function userToProfile(user: any): AuthUserProfile {
  const role = mapNestJsRole(user);
  const orgId =
    user.activeOrganisationId ||
    user.activeOrganizationId ||
    user.organisation?.id ||
    user.organisations?.[0]?.id;
  return {
    id: user.id || "usr_jwt",
    email: user.email || "",
    role,
    orgId:
      orgId ||
      (role !== "super_admin"
        ? import.meta.env.VITE_PUBLIC_ORGANISATION_ID || "e775b56d-38e8-42ee-9a24-9b0e51582ca5"
        : undefined),
    name:
      user.name ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.email?.split("@")[0] ||
      "User",
  };
}

export const jwtAdapter: AuthProviderInterface & {
  loginWithGoogle: (idToken: string) => Promise<{ error: Error | null; profile?: AuthUserProfile }>;
  verifyEmail: (hash: string) => Promise<{ error: Error | null }>;
  getSession: () => NestJsJwtSession | null;
} = {
  getSession() {
    return currentSession;
  },

  async getAccessToken(): Promise<string> {
    if (!currentSession) {
      const stored = sessionStorage.getItem("qurbani_jwt_session");
      if (stored) {
        try {
          currentSession = JSON.parse(stored);
        } catch {
          // ignore error
        }
      }
    }

    if (!currentSession) return "";

    // Check if access token is about to expire within 30 seconds
    const now = Date.now();
    if (currentSession.tokenExpires && now >= currentSession.tokenExpires - 30_000) {
      const refreshed = await jwtAdapter.refreshToken();
      if (refreshed) return refreshed;
    }

    return currentSession.token;
  },

  async signIn(email: string, password = "password") {
    try {
      const res = await fetch(`${API_BASE}/auth/email/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.message || "Failed to sign in");
      }

      const data: any = await res.json();
      const token = data.accessToken || data.token;
      let userObj = data.user;

      try {
        const meRes = await fetch(`${API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          userObj = await meRes.json();
        }
      } catch {
        // Fall back to login user payload
      }

      const sessionData: NestJsJwtSession = {
        token,
        refreshToken: data.refreshToken || "",
        tokenExpires: Date.now() + 3600 * 1000,
        user: userObj,
      };
      currentSession = sessionData;
      sessionStorage.setItem("qurbani_jwt_session", JSON.stringify(sessionData));
      const profile = userToProfile(userObj);
      sessionStorage.setItem("qurbani_auth_profile", JSON.stringify(profile));
      return { error: null, profile };
    } catch (err: any) {
      return { error: err };
    }
  },

  async signUp(payload: RegisterPayload) {
    try {
      const name = [payload.firstName, payload.lastName].filter(Boolean).join(" ") || payload.email.split("@")[0];
      const res = await fetch(`${API_BASE}/auth/email/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          password: payload.password,
        }),
      });

      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.message || "Registration failed");
      }

      const data = await res.json().catch(() => ({ user: { email: payload.email, name } }));
      return { error: null, user: data.user };
    } catch (err: any) {
      return { error: err, user: null };
    }
  },

  async verifyEmail(hash: string) {
    try {
      const res = await fetch(`${API_BASE}/auth/email/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash }),
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Invalid or expired email verification link");
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  async signOut() {
    if (currentSession?.token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession.token}`,
          },
        });
      } catch {
        // ignore logout network errors
      }
    }
    currentSession = null;
    sessionStorage.removeItem("qurbani_jwt_session");
  },

  async resetPassword(email: string) {
    try {
      const res = await fetch(`${API_BASE}/auth/forgot/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Unable to send recovery email");
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  async updatePassword(password: string, token = "") {
    try {
      const res = await fetch(`${API_BASE}/auth/reset/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: token, password }),
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Password reset failed or token expired");
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  async refreshToken(): Promise<string | null> {
    if (!currentSession?.refreshToken) return null;

    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession?.refreshToken}`,
          },
        });

        if (!res.ok) {
          throw new Error("Token refresh rejected");
        }

        const data: NestJsJwtSession = await res.json();
        currentSession = data;
        sessionStorage.setItem("qurbani_jwt_session", JSON.stringify(data));
        return data.token;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  async loginWithGoogle(idToken: string) {
    try {
      const res = await fetch(`${API_BASE}/auth/google/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        throw new Error("Google authentication failed");
      }
      const data: NestJsJwtSession = await res.json();
      currentSession = data;
      sessionStorage.setItem("qurbani_jwt_session", JSON.stringify(data));
      return { error: null, profile: userToProfile(data.user) };
    } catch (err: any) {
      return { error: err };
    }
  },

  async getMe(): Promise<AuthUserProfile | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const user = await res.json();
      return userToProfile(user);
    } catch {
      return currentSession?.user ? userToProfile(currentSession.user) : null;
    }
  },
};
