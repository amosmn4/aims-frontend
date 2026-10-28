import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export const FUNNEL_STAGE_LABELS = {
  applications_received: "Applications received",
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

export const RECRUITMENT_SERVICE_LINE = "RECRUITMENT";

export function useRecruitmentFunnel(projectId: string | undefined) {
  return useQuery({
    queryKey: ["recruitment-funnels", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const raw = await apiJson<BackendFunnel | null>(`/recruitment-funnels/${projectId}`);
      return raw ? mapFunnel(raw) : null;
    },
  });
}

/** Returns an error message when a later stage exceeds the one before it. */
export function funnelError(values: Record<FunnelStageKey, number>): string | null {
  const order: FunnelStageKey[] = [
    "applications_received",
    "screened",
    "interviewed",
    "offered",
    "placed",
  ];
  for (let i = 1; i < order.length; i++) {
    if (values[order[i]] > values[order[i - 1]]) {
      return `${FUNNEL_STAGE_LABELS[order[i]]} can't be more than ${FUNNEL_STAGE_LABELS[order[i - 1]].toLowerCase()}`;
    }
  }
  return null;
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
