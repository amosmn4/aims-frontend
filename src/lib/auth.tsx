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
  | "water"
  | "department_head"
  | "account_manager"
  | "general_staff";

export type Capability =
  | "view_department"
  | "edit_department"
  | "onboard_clients"
  | "submit_reports"
  | "raise_invoices"
  | "manage_tenders"
  | "log_client_requests"
  | "publish_blog";

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  jobTitle: string | null;
  phone?: string | null;
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
  isSystemAdmin: boolean;
  isCeo: boolean;
  viewAs: boolean;
  /** Backend-resolved department access (roles + overrides). */
  canReadDepartment: (code: string) => boolean;
  canWriteDepartment: (code: string) => boolean;
  /** Departments (and Water) this person can work in; more than one means they can switch. */
  workspaces: WorkspaceCode[];
  /** The one whose menu and home page they see now. */
  workspace: WorkspaceCode | null;
  setWorkspace: (code: WorkspaceCode) => void;
  /** What the person's roles let them do somewhere in AIMS. */
  capabilities: Capability[];
  hasCapability: (key: Capability) => boolean;
}

/** null means every department (admin/CEO). */
export interface DepartmentAccess {
  read: string[] | null;
  write: string[] | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type MeResponse = Profile & {
  roles: AppRole[];
  departmentAccess?: DepartmentAccess;
  capabilities?: Capability[];
  viewAs?: boolean;
};

const WORKSPACE_KEY = "aims:workspace";

/** Remembers the last workspace per person, so switching survives a reload. */
function readStoredWorkspace(userId: string | null): WorkspaceCode | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(`${WORKSPACE_KEY}:${userId}`);
    return value && WORKSPACE_CODES.includes(value as WorkspaceCode)
      ? (value as WorkspaceCode)
      : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [access, setAccess] = useState<DepartmentAccess>({ read: [], write: [] });
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [viewAs, setViewAs] = useState(false);
  const [, setWorkspaceTick] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const me = await apiJson<MeResponse>("/auth/me");
    const { roles: r, departmentAccess, capabilities: caps, viewAs: v, ...p } = me;
    setUser({ id: me.id, email: me.email });
    setProfile(p);
    setRoles(r);
    setAccess(departmentAccess ?? { read: [], write: [] });
    setCapabilities(caps ?? []);
    setViewAs(!!v);
    return r;
  };

  const clear = () => {
    setUser(null);
    setProfile(null);
    setRoles([]);
    setAccess({ read: [], write: [] });
    setCapabilities([]);
    setViewAs(false);
  };

  // A session that ends mid-use must not leave the old person signed in on the sign-in page.
  useEffect(() => {
    const onExpired = () => clear();
    window.addEventListener("aims:session-expired", onExpired);
    return () => window.removeEventListener("aims:session-expired", onExpired);
  }, []);

  useEffect(() => {
    ensureSession()
      .then(async (authenticated) => {
        if (authenticated) await loadProfile();
        else clear();
      })
      .catch(clear)
      .finally(() => setLoading(false));
  }, []);

  const isAdminOrCeo = roles.includes("system_admin") || roles.includes("ceo");

  // Every department they may open, plus the Water Project when they have it.
  const workspaces: WorkspaceCode[] = isAdminOrCeo
    ? []
    : [
        ...DEPARTMENT_CODES.filter(
          (code) => roles.includes(code) || access.read === null || access.read.includes(code),
        ),
        ...(roles.includes("water") ? (["water"] as const) : []),
      ];
  const stored = readStoredWorkspace(user?.id ?? null);
  const preferred = stored && workspaces.includes(stored) ? stored : null;
  const workspace = preferred ?? workspaces[0] ?? null;

  const setWorkspace = (code: WorkspaceCode) => {
    if (!user) return;
    try {
      window.localStorage.setItem(`${WORKSPACE_KEY}:${user.id}`, code);
    } catch {
      /* a browser with storage off still switches for this page load */
    }
    setWorkspaceTick((n) => n + 1);
  };

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
    isAdminOrCeo,
    isSystemAdmin: roles.includes("system_admin"),
    isCeo: roles.includes("ceo") && !roles.includes("system_admin"),
    viewAs,
    canReadDepartment: (code) => access.read === null || access.read.includes(code),
    canWriteDepartment: (code) => access.write === null || access.write.includes(code),
    workspaces,
    workspace,
    setWorkspace,
    capabilities,
    hasCapability: (key) => isAdminOrCeo || capabilities.includes(key),
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

/** The chosen workspace's home; otherwise one department → its home, Water-only → /water. */
export function homeRouteFor(
  roles: AppRole[],
  workspace?: WorkspaceCode | null,
):
  | "/dashboard"
  | "/departments"
  | "/finance"
  | "/hr"
  | "/it"
  | "/marketing"
  | "/tender"
  | "/operations"
  | "/water" {
  if (roles.includes("ceo") || roles.includes("system_admin")) return "/dashboard";
  if (workspace) return workspace === "water" ? "/water" : DEPARTMENT_HOME[workspace]!;
  const departmentHomes = new Set(
    roles.map((r) => DEPARTMENT_HOME[r]).filter((x): x is NonNullable<typeof x> => !!x),
  );
  if (departmentHomes.size === 1) return [...departmentHomes][0];
  if (departmentHomes.size === 0 && roles.includes("water")) return "/water";
  return "/departments";
}

export type DepartmentCode = "finance" | "hr" | "it" | "marketing" | "tender" | "operations";
/** A department, or the Water Project, which has its own pages rather than a department. */
export type WorkspaceCode = DepartmentCode | "water";

const DEPARTMENT_CODES: DepartmentCode[] = [
  "finance",
  "hr",
  "it",
  "marketing",
  "tender",
  "operations",
];

const WORKSPACE_CODES: WorkspaceCode[] = [...DEPARTMENT_CODES, "water"];

export const WORKSPACE_LABELS: Record<WorkspaceCode, string> = {
  finance: "Finance",
  hr: "Human Resources",
  it: "Information Technology",
  marketing: "Marketing",
  tender: "Tender",
  operations: "Operations",
  water: "Water Project",
};

/** The single department whose menu a person sees, or null (CEO, several departments, or none). */
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
  water: "Water Project",
  department_head: "Department Head",
  account_manager: "Account Manager",
  general_staff: "General Staff",
};
