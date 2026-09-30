import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { AppRole, Capability } from "@/lib/auth";

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

export interface RoleCapabilities {
  capabilities: { key: Capability; label: string }[];
  roles: { role: AppRole; capabilities: Partial<Record<Capability, boolean>> }[];
}

type RoleCapabilityInput = { role: AppRole; capability: Capability; allowed: boolean };

const ROLES_KEY = ["permissions", "roles"];

export function useRoleCapabilities(enabled = true) {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: () => apiJson<RoleCapabilities>("/permissions/roles"),
    enabled,
  });
}

function withCell(data: RoleCapabilities, input: RoleCapabilityInput): RoleCapabilities {
  return {
    ...data,
    roles: data.roles.map((r) =>
      r.role === input.role
        ? { ...r, capabilities: { ...r.capabilities, [input.capability]: input.allowed } }
        : r,
    ),
  };
}

/** Saves one matrix cell straight away; the cell flips back if the save fails. */
export function useSetRoleCapability() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ROLES_KEY,
    mutationFn: (input: RoleCapabilityInput) =>
      apiJson<RoleCapabilities>("/permissions/roles", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ROLES_KEY });
      qc.setQueryData<RoleCapabilities>(ROLES_KEY, (d) => d && withCell(d, input));
    },
    onError: (_err, input) => {
      qc.setQueryData<RoleCapabilities>(
        ROLES_KEY,
        (d) => d && withCell(d, { ...input, allowed: !input.allowed }),
      );
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ROLES_KEY }) <= 1) {
        qc.invalidateQueries({ queryKey: ROLES_KEY });
      }
      qc.invalidateQueries({ queryKey: ["permissions", "capabilities"] });
    },
  });
}
