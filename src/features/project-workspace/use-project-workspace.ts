import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

/* ---------- Cost items ---------- */

export type ProjectCostItem = {
  id: string;
  project_id: string;
  category: string;
  budgeted_amount: number;
  actual_amount: number;
  created_at: string;
};

type BackendCostItem = {
  id: string;
  projectId: string;
  category: string;
  budgetedAmount: string | number;
  actualAmount: string | number;
  createdAt: string;
};

function mapCostItem(c: BackendCostItem): ProjectCostItem {
  return {
    id: c.id,
    project_id: c.projectId,
    category: c.category,
    budgeted_amount: Number(c.budgetedAmount),
    actual_amount: Number(c.actualAmount),
    created_at: c.createdAt,
  };
}

export function useCostItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-cost-items", projectId],
    enabled: !!projectId,
    queryFn: async () =>
      (await apiJson<BackendCostItem[]>(`/projects/${projectId}/cost-items`)).map(mapCostItem),
  });
}

export function useCreateCostItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { category: string; budgetedAmount: number; actualAmount?: number }) =>
      apiJson(`/projects/${projectId}/cost-items`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-cost-items", projectId] }),
  });
}

export function useUpdateCostItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      apiJson(`/projects/cost-items/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-cost-items", projectId] }),
  });
}

export function useDeleteCostItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/projects/cost-items/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-cost-items", projectId] }),
  });
}

/* ---------- Team & Resources ---------- */

export type ProjectTeamMemberType = "internal" | "external";

export type ProjectTeamMember = {
  id: string;
  project_id: string;
  user_id: string | null;
  user_name: string | null;
  name: string;
  role: string;
  type: ProjectTeamMemberType;
  allocation_percent: number;
  hours_logged: number;
  created_at: string;
};

type BackendTeamMember = {
  id: string;
  projectId: string;
  userId: string | null;
  user?: { id: string; fullName: string | null; email: string } | null;
  name: string;
  role: string;
  type: ProjectTeamMemberType;
  allocationPercent: number;
  hoursLogged: string | number;
  createdAt: string;
};

function mapTeamMember(m: BackendTeamMember): ProjectTeamMember {
  return {
    id: m.id,
    project_id: m.projectId,
    user_id: m.userId,
    user_name: m.user?.fullName ?? m.user?.email ?? null,
    name: m.name,
    role: m.role,
    type: m.type,
    allocation_percent: m.allocationPercent,
    hours_logged: Number(m.hoursLogged),
    created_at: m.createdAt,
  };
}

export function useTeamMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-team", projectId],
    enabled: !!projectId,
    queryFn: async () =>
      (await apiJson<BackendTeamMember[]>(`/projects/${projectId}/team`)).map(mapTeamMember),
  });
}

export function useCreateTeamMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId?: string;
      name: string;
      role: string;
      type?: ProjectTeamMemberType;
      allocationPercent?: number;
      hoursLogged?: number;
    }) => apiJson(`/projects/${projectId}/team`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-team", projectId] }),
  });
}

export function useUpdateTeamMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      apiJson(`/projects/team/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-team", projectId] }),
  });
}

export function useDeleteTeamMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/projects/team/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-team", projectId] }),
  });
}

/* ---------- RACI matrix ---------- */

export type ProjectRaciEntry = {
  id: string;
  project_id: string;
  deliverable: string;
  responsible: string | null;
  accountable: string | null;
  consulted: string | null;
  informed: string | null;
  sort_order: number;
};

type BackendRaciEntry = {
  id: string;
  projectId: string;
  deliverable: string;
  responsible: string | null;
  accountable: string | null;
  consulted: string | null;
  informed: string | null;
  sortOrder: number;
};

function mapRaciEntry(r: BackendRaciEntry): ProjectRaciEntry {
  return {
    id: r.id,
    project_id: r.projectId,
    deliverable: r.deliverable,
    responsible: r.responsible,
    accountable: r.accountable,
    consulted: r.consulted,
    informed: r.informed,
    sort_order: r.sortOrder,
  };
}

export function useRaciEntries(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-raci", projectId],
    enabled: !!projectId,
    queryFn: async () =>
      (await apiJson<BackendRaciEntry[]>(`/projects/${projectId}/raci`)).map(mapRaciEntry),
  });
}

export function useCreateRaciEntry(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      deliverable: string;
      responsible?: string;
      accountable?: string;
      consulted?: string;
      informed?: string;
    }) => apiJson(`/projects/${projectId}/raci`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-raci", projectId] }),
  });
}

export function useUpdateRaciEntry(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      apiJson(`/projects/raci/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-raci", projectId] }),
  });
}

export function useDeleteRaciEntry(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/projects/raci/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-raci", projectId] }),
  });
}

/* ---------- RAID log ---------- */

export type ProjectRaidType = "risk" | "issue" | "dependency" | "assumption";
export type ProjectRaidSeverity = "low" | "medium" | "high";
export type ProjectRaidStatus = "open" | "accepted" | "closed";

export type ProjectRaidEntry = {
  id: string;
  project_id: string;
  type: ProjectRaidType;
  description: string;
  severity: ProjectRaidSeverity;
  owner: string | null;
  status: ProjectRaidStatus;
  mitigation: string | null;
  created_at: string;
  updated_at: string;
};

type BackendRaidEntry = {
  id: string;
  projectId: string;
  type: ProjectRaidType;
  description: string;
  severity: ProjectRaidSeverity;
  owner: string | null;
  status: ProjectRaidStatus;
  mitigation: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRaidEntry(r: BackendRaidEntry): ProjectRaidEntry {
  return {
    id: r.id,
    project_id: r.projectId,
    type: r.type,
    description: r.description,
    severity: r.severity,
    owner: r.owner,
    status: r.status,
    mitigation: r.mitigation,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export function useRaidEntries(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-raid", projectId],
    enabled: !!projectId,
    queryFn: async () =>
      (await apiJson<BackendRaidEntry[]>(`/projects/${projectId}/raid`)).map(mapRaidEntry),
  });
}

export function useCreateRaidEntry(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type: ProjectRaidType;
      description: string;
      severity?: ProjectRaidSeverity;
      owner?: string;
      status?: ProjectRaidStatus;
      mitigation?: string;
    }) => apiJson(`/projects/${projectId}/raid`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-raid", projectId] }),
  });
}

export function useUpdateRaidEntry(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      apiJson(`/projects/raid/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-raid", projectId] }),
  });
}

export function useDeleteRaidEntry(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/projects/raid/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-raid", projectId] }),
  });
}
