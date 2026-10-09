import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

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
  access: "lead" | "member" | "viewer";
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
  access?: "lead" | "member" | "viewer";
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
    access: m.access ?? "member",
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
      access?: "member" | "viewer";
      allocationPercent?: number;
      hoursLogged?: number;
    }) => apiJson(`/projects/${projectId}/team`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-team", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
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
