import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export const FUNNEL_STAGE_LABELS = {
  applications_received: "Applications Received",
  screened: "Screened",
  interviewed: "Interviewed",
  offered: "Offered",
  placed: "Placed",
} as const;

export type FunnelStageKey = keyof typeof FUNNEL_STAGE_LABELS;

export interface RecruitmentFunnelRow {
  applications_received: number;
  screened: number;
  interviewed: number;
  offered: number;
  placed: number;
  notes: string | null;
  updated_at: string | null;
}

export interface RecruitmentEngagementRow {
  project_id: string;
  project_name: string;
  client_name: string | null;
  funnel: RecruitmentFunnelRow | null;
}

type BackendFunnel = {
  applicationsReceived: number;
  screened: number;
  interviewed: number;
  offered: number;
  placed: number;
  notes: string | null;
  updatedAt: string;
};

type BackendEngagement = {
  id: string;
  name: string;
  client?: { name: string } | null;
  recruitmentFunnel: BackendFunnel | null;
};

function mapFunnel(f: BackendFunnel): RecruitmentFunnelRow {
  return {
    applications_received: f.applicationsReceived,
    screened: f.screened,
    interviewed: f.interviewed,
    offered: f.offered,
    placed: f.placed,
    notes: f.notes,
    updated_at: f.updatedAt,
  };
}

function mapEngagement(p: BackendEngagement): RecruitmentEngagementRow {
  return {
    project_id: p.id,
    project_name: p.name,
    client_name: p.client?.name ?? null,
    funnel: p.recruitmentFunnel ? mapFunnel(p.recruitmentFunnel) : null,
  };
}

/** One row per HR project, each with its recruitment funnel if tracking has started. */
export function useRecruitmentEngagements() {
  return useQuery({
    queryKey: ["recruitment-funnels"],
    queryFn: async () =>
      (await apiJson<BackendEngagement[]>("/recruitment-funnels")).map(mapEngagement),
  });
}

export function useSaveRecruitmentFunnel(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      applicationsReceived: number;
      screened: number;
      interviewed: number;
      offered: number;
      placed: number;
      notes?: string;
    }) =>
      apiJson(`/recruitment-funnels/${projectId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-funnels"] }),
  });
}
