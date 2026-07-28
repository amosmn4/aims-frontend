import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type EngagementAnchorType = "request" | "tender" | "project" | "contract";

export interface EngagementChainLead {
  id: string;
  name: string;
}
export interface EngagementChainRequest {
  id: string;
  title: string;
  referenceNumber: string | null;
}
export interface EngagementChainTender {
  id: string;
  title: string;
  referenceNumber: string | null;
}
export interface EngagementChainContract {
  id: string;
  title: string;
  contractNumber: string;
}
export interface EngagementChainProject {
  id: string;
  name: string;
}

export interface EngagementChain {
  lead: EngagementChainLead | null;
  request: EngagementChainRequest | null;
  tender: EngagementChainTender | null;
  contract: EngagementChainContract | null;
  projects: EngagementChainProject[];
}

export interface EngagementActivity {
  id: string;
  source: "lead" | "request" | "tender" | "project";
  type: string;
  summary: string;
  occurredAt: string;
  createdByName: string | null;
}

export interface EngagementResolution {
  chain: EngagementChain;
  activities: EngagementActivity[];
}

export function useEngagement(type: EngagementAnchorType, id: string | undefined) {
  return useQuery({
    queryKey: ["engagements", "resolve", type, id],
    enabled: !!id,
    queryFn: async () =>
      apiJson<EngagementResolution>(`/engagements/resolve?type=${type}&id=${id}`),
  });
}
