import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export interface WebsiteAnalyticsTopPage {
  path: string;
  views: number;
}

export interface WebsiteAnalyticsTopSource {
  source: string;
  sessions: number;
}

export interface WebsiteAnalyticsSnapshotRow {
  id: string;
  period_start: string;
  period_end: string;
  visitors: number;
  page_views: number;
  top_pages: WebsiteAnalyticsTopPage[];
  top_sources: WebsiteAnalyticsTopSource[];
  blog_page_views: number | null;
  created_at: string;
}

export interface WebsiteAnalyticsLatest {
  configured: boolean;
  snapshot: WebsiteAnalyticsSnapshotRow | null;
}

type BackendSnapshot = {
  id: string;
  periodStart: string;
  periodEnd: string;
  visitors: number;
  pageViews: number;
  topPages: WebsiteAnalyticsTopPage[];
  topSources: WebsiteAnalyticsTopSource[];
  blogPageViews: number | null;
  createdAt: string;
};

function mapSnapshot(s: BackendSnapshot): WebsiteAnalyticsSnapshotRow {
  return {
    id: s.id,
    period_start: s.periodStart.slice(0, 10),
    period_end: s.periodEnd.slice(0, 10),
    visitors: s.visitors,
    page_views: s.pageViews,
    top_pages: s.topPages ?? [],
    top_sources: s.topSources ?? [],
    blog_page_views: s.blogPageViews,
    created_at: s.createdAt,
  };
}

export function useWebsiteAnalytics() {
  return useQuery({
    queryKey: ["website-analytics", "latest"],
    queryFn: async () => {
      const raw = await apiJson<{ configured: boolean; snapshot: BackendSnapshot | null }>(
        "/website-analytics/latest",
      );
      return {
        configured: raw.configured,
        snapshot: raw.snapshot ? mapSnapshot(raw.snapshot) : null,
      } satisfies WebsiteAnalyticsLatest;
    },
  });
}

export function useSyncWebsiteAnalyticsNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      apiJson<{ configured: boolean; synced: boolean }>("/website-analytics/sync-now", {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-analytics"] }),
  });
}
