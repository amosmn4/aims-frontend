import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { AppRole } from "@/lib/auth";

export type PermissionAction = "read" | "write";
export type PermissionSource = "role" | "override";

export interface DepartmentCapabilitiesStaffRow {
  user_id: string;
  full_name: string | null;
  email: string;
  roles: AppRole[];
  capabilities: Record<PermissionAction, { effective: boolean; source: PermissionSource }>;
}

export interface DepartmentCapabilities {
  department: { id: string; code: string; name: string };
  staff: DepartmentCapabilitiesStaffRow[];
}

type BackendCapabilities = {
  department: { id: string; code: string; name: string };
  staff: {
    userId: string;
    fullName: string | null;
    email: string;
    roles: AppRole[];
    capabilities: Record<PermissionAction, { effective: boolean; source: PermissionSource }>;
  }[];
};

export function useDepartmentCapabilities(departmentId: string | undefined) {
  return useQuery({
    queryKey: ["permissions", "capabilities", departmentId],
    queryFn: async () => {
      const raw = await apiJson<BackendCapabilities>(
        `/permissions/capabilities?departmentId=${departmentId}`,
      );
      return {
        department: raw.department,
        staff: raw.staff.map((s) => ({
          user_id: s.userId,
          full_name: s.fullName,
          email: s.email,
          roles: s.roles,
          capabilities: s.capabilities,
        })),
      } satisfies DepartmentCapabilities;
    },
    enabled: !!departmentId,
  });
}

export function useSetPermissionOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      departmentId: string;
      action: PermissionAction;
      effect: "grant" | "deny" | "clear";
    }) => apiJson("/permissions/overrides", { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["permissions", "capabilities"] }),
  });
}
