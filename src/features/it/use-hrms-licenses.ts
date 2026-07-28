import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type HrmsLicenseTier = "starter" | "growth" | "enterprise";
export type HrmsLicenseStatus = "active" | "trial" | "suspended" | "cancelled";

export const HRMS_LICENSE_TIER_LABELS: Record<HrmsLicenseTier, string> = {
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

export const HRMS_LICENSE_STATUS_LABELS: Record<HrmsLicenseStatus, string> = {
  active: "Active",
  trial: "Trial",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

export const HRMS_LICENSE_STATUS_STYLES: Record<HrmsLicenseStatus, string> = {
  active: "bg-success/15 text-success",
  trial: "bg-primary/10 text-primary",
  suspended: "bg-warning/15 text-warning",
  cancelled: "bg-destructive/15 text-destructive",
};

export interface HrmsLicenseRow {
  id: string;
  clientId: string;
  tier: HrmsLicenseTier;
  status: HrmsLicenseStatus;
  activeUsers: number | null;
  renewalDate: string | null;
  notes: string | null;
  client: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

/* ---------- Queries ---------- */

export function useHrmsLicenses() {
  return useQuery({
    queryKey: ["hrms-licenses"],
    queryFn: () => apiJson<HrmsLicenseRow[]>("/hrms-licenses"),
  });
}

/* ---------- Mutations ---------- */

export function useSaveHrmsLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      clientId?: string;
      tier?: HrmsLicenseTier;
      status?: HrmsLicenseStatus;
      activeUsers?: number;
      renewalDate?: string;
      notes?: string;
    }) => {
      const body = {
        clientId: input.clientId,
        tier: input.tier,
        status: input.status,
        activeUsers: input.activeUsers,
        renewalDate: input.renewalDate || undefined,
        notes: input.notes || undefined,
      };
      if (input.id) {
        await apiJson(`/hrms-licenses/${input.id}`, { method: "PATCH", body: JSON.stringify(body) });
        return input.id;
      }
      const created = await apiJson<HrmsLicenseRow>("/hrms-licenses", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return created.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hrms-licenses"] }),
  });
}

export function useDeleteHrmsLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/hrms-licenses/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hrms-licenses"] }),
  });
}
