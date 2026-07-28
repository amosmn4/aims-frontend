import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type ItSystemType = "website" | "internal_system" | "integration";
export type ItSystemStatus = "active" | "inactive" | "deprecated";

export const IT_SYSTEM_TYPE_LABELS: Record<ItSystemType, string> = {
  website: "Website",
  internal_system: "Internal System",
  integration: "Integration",
};

export const IT_SYSTEM_STATUS_LABELS: Record<ItSystemStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  deprecated: "Deprecated",
};

export const IT_SYSTEM_STATUS_STYLES: Record<ItSystemStatus, string> = {
  active: "bg-success/15 text-success",
  inactive: "bg-secondary text-secondary-foreground",
  deprecated: "bg-destructive/15 text-destructive",
};

export interface ItSystemRow {
  id: string;
  name: string;
  type: ItSystemType;
  status: ItSystemStatus;
  owner: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type BackendItSystem = {
  id: string;
  name: string;
  type: ItSystemType;
  status: ItSystemStatus;
  owner: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapItSystem(s: BackendItSystem): ItSystemRow {
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    status: s.status,
    owner: s.owner,
    notes: s.notes,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

export function useItSystems() {
  return useQuery({
    queryKey: ["it-systems"],
    queryFn: async () => (await apiJson<BackendItSystem[]>("/it-systems")).map(mapItSystem),
  });
}

export function useSaveItSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ItSystemRow> & { name: string; type: ItSystemType }) => {
      const body = {
        name: input.name,
        type: input.type,
        status: input.status || undefined,
        owner: input.owner || undefined,
        notes: input.notes || undefined,
      };
      if (input.id) {
        return mapItSystem(await apiJson<BackendItSystem>(`/it-systems/${input.id}`, { method: "PATCH", body: JSON.stringify(body) }));
      }
      return mapItSystem(await apiJson<BackendItSystem>("/it-systems", { method: "POST", body: JSON.stringify(body) }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["it-systems"] }),
  });
}

export function useDeleteItSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/it-systems/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["it-systems"] }),
  });
}
