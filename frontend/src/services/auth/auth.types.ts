export type UserRole = "super_admin" | "committee_admin" | "volunteer" | "participant";

export interface AuthUserProfile {
  id: string;
  email: string;
  role: UserRole;
  orgId?: string;
  name: string;
}

export interface NestJsUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role?: {
    id: number;
    name: string;
    slug?: string;
  };
  status?: {
    id: number;
    name: string;
  };
  activeOrganizationId?: string;
}

export interface NestJsJwtSession {
  token: string;
  refreshToken: string;
  tokenExpires: number; // Unix timestamp in milliseconds
  user: NestJsUser;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  orgId?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthProviderInterface {
  signIn: (email: string, password?: string) => Promise<{ error: Error | null; profile?: AuthUserProfile }>;
  signUp: (payload: RegisterPayload) => Promise<{ error: Error | null; user?: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string, token?: string) => Promise<{ error: Error | null }>;
  getAccessToken: () => Promise<string>;
  refreshToken: () => Promise<string | null>;
  getMe: () => Promise<AuthUserProfile | null>;
}
