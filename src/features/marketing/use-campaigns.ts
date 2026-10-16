import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type CampaignStatus = "planned" | "active" | "paused" | "completed";

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  planned: "Planned",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

export const CAMPAIGN_STATUS_STYLES: Record<CampaignStatus, string> = {
  planned: "bg-secondary text-secondary-foreground",
  active: "bg-success/15 text-success",
  paused: "bg-warning/15 text-warning",
  completed: "bg-primary/10 text-primary",
};

export interface CampaignRow {
  id: string;
  name: string;
  channel: string | null;
  status: CampaignStatus;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  leadsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRoi {
  campaignId: string;
  leadsCount: number;
  convertedCount: number;
  conversionRate: number;
  revenue: number;
  budget: number | null;
  roi: number | null;
}

type BackendCampaign = {
  id: string;
  name: string;
  channel: string | null;
  status: CampaignStatus;
  budget: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  _count: { leads: number };
  createdAt: string;
  updatedAt: string;
};

function mapCampaign(c: BackendCampaign): CampaignRow {
  return {
    id: c.id,
    name: c.name,
    channel: c.channel,
    status: c.status,
    budget: c.budget !== null ? Number(c.budget) : null,
    startDate: c.startDate,
    endDate: c.endDate,
    notes: c.notes,
    leadsCount: c._count.leads,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/* ---------- Queries ---------- */

export function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => (await apiJson<BackendCampaign[]>("/campaigns")).map(mapCampaign),
  });
}

export function useCampaignRoi(id: string | undefined) {
  return useQuery({
    queryKey: ["campaigns", id, "roi"],
    enabled: !!id,
    queryFn: () => apiJson<CampaignRoi>(`/campaigns/${id}/roi`),
  });
}

/* ---------- Mutations ---------- */

export function useSaveCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      channel?: string;
      status?: CampaignStatus;
      budget?: number;
      startDate?: string;
      endDate?: string;
      notes?: string;
    }) => {
      const body = {
        name: input.name,
        channel: input.channel || undefined,
        status: input.status || undefined,
        budget: input.budget,
        startDate: input.startDate || undefined,
        endDate: input.endDate || undefined,
        notes: input.notes || undefined,
      };
      if (input.id) {
        await apiJson(`/campaigns/${input.id}`, { method: "PATCH", body: JSON.stringify(body) });
        return input.id;
      }
      const created = await apiJson<BackendCampaign>("/campaigns", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return created.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiJson(`/campaigns/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}
