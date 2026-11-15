import {
  createClient,
  type SupabaseClient,
  type Session,
  type User,
} from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { jwtAdapter } from "./auth/jwt.adapter";
import type { AuthUserProfile, UserRole, RegisterPayload } from "./auth/auth.types";

export type { UserRole, AuthUserProfile, RegisterPayload };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  !supabaseUrl.includes("placeholder") &&
  supabaseUrl.startsWith("http");

export const isMockMode = import.meta.env.VITE_USE_MOCK_API === "true";

// Provider selection: 'nestjs' (default active) or 'supabase'
export const AUTH_PROVIDER = (import.meta.env.VITE_AUTH_PROVIDER || "nestjs").toLowerCase();

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Returns the current Bearer token for NestJS API requests.
 * Evaluates the active authentication provider:
 * - In 'nestjs' mode: returns fresh NestJS JWT access token from jwtAdapter
 * - In 'supabase' mode: returns Supabase session access token (auto-refreshed)
 * - Fallback: returns mock Bearer token for simulation
 */
export async function getAuthToken(): Promise<string> {
  if (AUTH_PROVIDER === "nestjs") {
    const jwtToken = await jwtAdapter.getAccessToken();
    if (jwtToken) return jwtToken;
  }

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        return data.session.access_token;
      }
    } catch {
      // Fallback
    }
  }

  const stored = sessionStorage.getItem("qurbani_mock_token");
  return stored || "";
}

interface AuthContextType {
  user: User | null;
  profile: AuthUserProfile | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  isConfigured: boolean;
  isMockMode: boolean;
  activeProvider: string;
  signIn: (email: string, password?: string) => Promise<{ error: Error | null; profile?: AuthUserProfile }>;
  signUp: (
    email: string,
    password: string,
    metadata?: { name?: string; role?: UserRole; org_id?: string },
  ) => Promise<{ error: Error | null; user?: User | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string, token?: string) => Promise<{ error: Error | null }>;
  switchMockRole: (role: UserRole, orgId?: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function mapUserToProfile(u: User): AuthUserProfile {
  const userMeta = u.user_metadata || {};
  const appMeta = u.app_metadata || {};

  const role: UserRole =
    (userMeta.role as UserRole) ||
    (appMeta.role as UserRole) ||
    (u.email?.includes("super") || u.email?.includes("platform")
      ? "super_admin"
      : u.email?.includes("volunteer")
        ? "volunteer"
        : u.email?.includes("admin") || u.email?.includes("committee")
          ? "committee_admin"
          : "participant");

  const orgId = userMeta.org_id || appMeta.org_id || (role !== "super_admin" ? "org_demo" : undefined);
  const name = userMeta.name || userMeta.full_name || u.email?.split("@")[0] || "User";

  return {
    id: u.id,
    email: u.email ?? "",
    role,
    orgId,
    name,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthUserProfile | null>(() => {
    const cached = sessionStorage.getItem("qurbani_auth_profile");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // ignore
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(AUTH_PROVIDER === "nestjs");

  useEffect(() => {
    if (AUTH_PROVIDER === "nestjs") {
      jwtAdapter
        .getMe()
        .then((p) => {
          if (p) {
            setProfile(p);
            sessionStorage.setItem("qurbani_auth_profile", JSON.stringify(p));
          } else {
            setProfile(null);
            sessionStorage.removeItem("qurbani_auth_profile");
          }
        })
        .finally(() => setLoading(false));
      return;
    }

    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const newProfile = mapUserToProfile(s.user);
        setProfile(newProfile);
        sessionStorage.setItem("qurbani_auth_profile", JSON.stringify(newProfile));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const newProfile = mapUserToProfile(s.user);
        setProfile(newProfile);
        sessionStorage.setItem("qurbani_auth_profile", JSON.stringify(newProfile));
      } else if (!isMockMode) {
        setProfile(null);
        sessionStorage.removeItem("qurbani_auth_profile");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password = "password") => {
    setLoading(true);
    try {
      if (AUTH_PROVIDER === "nestjs") {
        const res = await jwtAdapter.signIn(email, password);
        if (res.profile) {
          setProfile(res.profile);
        }
        return res;
      }

      if (supabase && isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setSession(data.session);
        setUser(data.user);
        const userProfile = mapUserToProfile(data.user);
        setProfile(userProfile);
        sessionStorage.setItem("qurbani_auth_profile", JSON.stringify(userProfile));
        return { error: null, profile: userProfile };
      }

      // Mock Sign In simulation
      let role: UserRole = "participant";
      let orgId: string | undefined = "org_demo";
      let name = "Participant";

      if (email.includes("platform") || email.includes("super")) {
        role = "super_admin";
        orgId = undefined;
        name = "Platform Super Admin";
      } else if (email.includes("office") || email.includes("committee") || email.includes("admin")) {
        role = "committee_admin";
        orgId = "org_demo";
        name = "Committee Admin";
      } else if (email.includes("volunteer")) {
        role = "volunteer";
        orgId = "org_demo";
        name = "Volunteer";
      }

      const mockProfile: AuthUserProfile = {
        id: `usr_${Math.random().toString(36).substring(7)}`,
        email,
        role,
        orgId,
        name,
      };

      setProfile(mockProfile);
      sessionStorage.setItem("qurbani_mock_token", `mock-bearer-${role}`);
      sessionStorage.setItem("qurbani_auth_profile", JSON.stringify(mockProfile));
      return { error: null, profile: mockProfile };
    } catch (err: any) {
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    metadata?: { name?: string; role?: UserRole; org_id?: string },
  ) => {
    setLoading(true);
    try {
      if (AUTH_PROVIDER === "nestjs") {
        const names = (metadata?.name || email.split("@")[0]).split(" ");
        return await jwtAdapter.signUp({
          email,
          password,
          firstName: names[0] || "User",
          lastName: names.slice(1).join(" ") || "Member",
          role: metadata?.role,
          orgId: metadata?.org_id,
        });
      }

      if (supabase && isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: metadata?.name || email.split("@")[0],
              role: metadata?.role || "participant",
              org_id: metadata?.org_id || "org_demo",
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          setSession(data.session);
          setUser(data.user);
          if (data.user) {
            const newProfile = mapUserToProfile(data.user);
            setProfile(newProfile);
            sessionStorage.setItem("qurbani_auth_profile", JSON.stringify(newProfile));
          }
        }
        return { error: null, user: data.user };
      }

      // Mock Sign Up simulation
      const mockProfile: AuthUserProfile = {
        id: `usr_${Math.random().toString(36).substring(7)}`,
        email,
        role: metadata?.role || "participant",
        orgId: metadata?.org_id || "org_demo",
        name: metadata?.name || email.split("@")[0],
      };
      setProfile(mockProfile);
      sessionStorage.setItem("qurbani_mock_token", `mock-bearer-${mockProfile.role}`);
      sessionStorage.setItem("qurbani_auth_profile", JSON.stringify(mockProfile));
      return { error: null, user: null };
    } catch (err: any) {
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (AUTH_PROVIDER === "nestjs") {
      await jwtAdapter.signOut();
    } else if (supabase && isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    setSession(null);
    setUser(null);
    setProfile(null);
    sessionStorage.removeItem("qurbani_mock_token");
    sessionStorage.removeItem("qurbani_auth_profile");
  };

  const resetPassword = async (email: string) => {
    if (AUTH_PROVIDER === "nestjs") {
      return await jwtAdapter.resetPassword(email);
    }
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error };
    }
    return { error: null };
  };

  const updatePassword = async (password: string, token = "") => {
    if (AUTH_PROVIDER === "nestjs") {
      return await jwtAdapter.updatePassword(password, token);
    }
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({ password });
      return { error };
    }
    return { error: null };
  };

  const switchMockRole = (role: UserRole, orgId = "org_demo") => {
    const newProfile: AuthUserProfile = {
      id: `usr_${role}`,
      email: `${role}@qurbanios.internal`,
      role,
      orgId: role === "super_admin" ? undefined : orgId,
      name:
        role === "super_admin"
          ? "Platform Owner"
          : role === "committee_admin"
            ? "Mahallu Admin"
            : role === "volunteer"
              ? "Operational Volunteer"
              : "Registered Participant",
    };
    setProfile(newProfile);
    sessionStorage.setItem("qurbani_mock_token", `mock-bearer-${role}`);
    sessionStorage.setItem("qurbani_auth_profile", JSON.stringify(newProfile));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        role: profile?.role || "participant",
        isConfigured: isSupabaseConfigured,
        isMockMode,
        activeProvider: AUTH_PROVIDER,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        switchMockRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { jwtAdapter };
