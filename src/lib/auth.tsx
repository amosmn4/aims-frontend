import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, apiJson, ensureSession, resetSession, setAccessToken } from "@/lib/api-client";

export type AppRole =
  | "ceo"
  | "system_admin"
  | "finance"
  | "hr"
  | "it"
  | "marketing"
  | "tender"
  | "operations"
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
  setPassword: (token: string, password: string) => Promise<AppRole[]>;
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
    setPassword: async (token, password) => {
      const body = await apiJson<{ accessToken: string }>("/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
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

const DEPARTMENT_HOME: Partial<
  Record<AppRole, "/finance" | "/hr" | "/it" | "/marketing" | "/tender" | "/operations">
> = {
  finance: "/finance",
  hr: "/hr",
  it: "/it",
  marketing: "/marketing",
  tender: "/tender",
  operations: "/operations",
};

/**
 * The CEO Executive Dashboard is admin/CEO-only. A user who belongs to exactly one department
 * lands straight on that department's own hub (its Overview tab is their dashboard) instead of
 * the generic Departments picker grid — the picker is for people who span multiple departments,
 * or hold no department role at all.
 */
export function homeRouteFor(
  roles: AppRole[],
):
  | "/dashboard"
  | "/departments"
  | "/finance"
  | "/hr"
  | "/it"
  | "/marketing"
  | "/tender"
  | "/operations" {
  if (roles.includes("ceo") || roles.includes("system_admin")) return "/dashboard";
  const departmentHomes = new Set(
    roles.map((r) => DEPARTMENT_HOME[r]).filter((x): x is NonNullable<typeof x> => !!x),
  );
  if (departmentHomes.size === 1) return [...departmentHomes][0];
  return "/departments";
}

export type DepartmentCode = "finance" | "hr" | "it" | "marketing" | "tender" | "operations";

const DEPARTMENT_CODES: DepartmentCode[] = [
  "finance",
  "hr",
  "it",
  "marketing",
  "tender",
  "operations",
];

/**
 * Which single department's nav a user should see, or null for the global/central nav — same
 * "exactly one department role, and not admin/CEO" rule `homeRouteFor` already uses to decide
 * where to land after login, just exposed as the department code instead of a route. Admin/CEO
 * and anyone spanning multiple departments (or none) keep the global nav in AppShell.
 */
export function departmentScopeFor(roles: AppRole[]): DepartmentCode | null {
  if (roles.includes("ceo") || roles.includes("system_admin")) return null;
  const owned = DEPARTMENT_CODES.filter((code) => roles.includes(code));
  return owned.length === 1 ? owned[0] : null;
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
  marketing: "Marketing",
  tender: "Tender",
  operations: "Operations",
  department_head: "Department Head",
  account_manager: "Account Manager",
  general_staff: "General Staff",
};
