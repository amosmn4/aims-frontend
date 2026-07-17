import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, apiJson, ensureSession, resetSession, setAccessToken } from "@/lib/api-client";

export type AppRole =
  | "ceo"
  | "system_admin"
  | "finance"
  | "hr"
  | "it"
  | "marketing_ops"
  | "tender"
  | "department_head"
  | "account_manager"
  | "general_staff";

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  departmentId: string | null;
  officeId: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  session: AuthUser | null;
  user: AuthUser | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  login: (email: string, password: string) => Promise<AppRole[]>;
  demoLogin: (role: "system_admin" | "ceo" | "finance") => Promise<AppRole[]>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (role: AppRole | AppRole[]) => boolean;
  isAdminOrCeo: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type MeResponse = Profile & { roles: AppRole[] };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const me = await apiJson<MeResponse>("/auth/me");
    const { roles: r, ...p } = me;
    setUser({ id: me.id, email: me.email });
    setProfile(p);
    setRoles(r);
    return r;
  };

  const clear = () => {
    setUser(null);
    setProfile(null);
    setRoles([]);
  };

  useEffect(() => {
    ensureSession()
      .then(async (authenticated) => {
        if (authenticated) await loadProfile();
        else clear();
      })
      .catch(clear)
      .finally(() => setLoading(false));
  }, []);

  const value: AuthContextValue = {
    session: user,
    user,
    profile,
    roles,
    loading,
    login: async (email, password) => {
      const body = await apiJson<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(body.accessToken);
      return loadProfile();
    },
    demoLogin: async (role) => {
      const body = await apiJson<{ accessToken: string }>("/auth/demo-login", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      setAccessToken(body.accessToken);
      return loadProfile();
    },
    signOut: async () => {
      await apiFetch("/auth/logout", { method: "POST" });
      resetSession();
      clear();
    },
    refresh: async () => {
      if (user) await loadProfile();
    },
    hasRole: (role) => {
      const list = Array.isArray(role) ? role : [role];
      return roles.some((r) => list.includes(r));
    },
    isAdminOrCeo: roles.includes("system_admin") || roles.includes("ceo"),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** The CEO Executive Dashboard is admin/CEO-only; everyone else lands on the Departments overview. */
export function homeRouteFor(roles: AppRole[]): "/dashboard" | "/departments" {
  return roles.includes("ceo") || roles.includes("system_admin") ? "/dashboard" : "/departments";
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  ceo: "Chief Executive Officer",
  system_admin: "System Administrator",
  finance: "Finance",
  hr: "Human Resources",
  it: "Information Technology",
  marketing_ops: "Marketing & Operations",
  tender: "Tender",
  department_head: "Department Head",
  account_manager: "Account Manager",
  general_staff: "General Staff",
};
