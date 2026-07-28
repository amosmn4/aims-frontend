import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { useLeads, LEAD_STAGE_LABELS, type LeadStage } from "@/features/marketing/use-leads";
import { useWebsiteAnalytics } from "@/features/marketing/use-website-analytics";
import { useBlogPosts } from "@/features/marketing/use-blog";

export const Route = createFileRoute("/_authenticated/reports/departments/marketing")({
  head: () => ({ meta: [{ title: "Marketing Report — AIMS" }] }),
  component: MarketingReport,
});

const ACTIVE_STAGES: LeadStage[] = ["new", "contacted", "qualified", "nurturing"];

function MarketingReport() {
  return (
    <RequireRole
      roles={["marketing"]}
      message="The Marketing report is restricted to the Marketing team, CEO and System Administrator."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Marketing</div>
            <div className="text-xs text-muted-foreground">
              Leads pipeline, website performance and blog reach.
            </div>
          </div>
          <Link to="/marketing" className="text-xs text-primary hover:underline">
            Open Marketing workspace
          </Link>
        </div>
        <LeadsSummary />
        <WebsiteSummary />
        <BlogSummary />
      </div>
    </RequireRole>
  );
}

function LeadsSummary() {
  const leadsQ = useLeads();
  const leads = leadsQ.data ?? [];

  const stats = useMemo(() => {
    const active = leads.filter((l) => ACTIVE_STAGES.includes(l.stage));
    const converted = leads.filter((l) => l.stage === "converted");
    const closed = leads.filter((l) => l.stage === "converted" || l.stage === "lost");
    const conversionRate = closed.length > 0 ? Math.round((converted.length / closed.length) * 100) : null;
    const byStage = new Map<LeadStage, number>();
    for (const l of leads) byStage.set(l.stage, (byStage.get(l.stage) ?? 0) + 1);
    return { total: leads.length, active: active.length, conversionRate, byStage };
  }, [leads]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold">Leads</div>
        <Link to="/marketing/leads" className="text-xs text-primary hover:underline">
          Open Leads board
        </Link>
      </div>
      {leadsQ.isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : stats.total === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">No leads yet.</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4 mt-3">
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Active</div>
              <div className="text-xl font-semibold tabular-nums mt-1">{stats.active}</div>
            </div>
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-xl font-semibold tabular-nums mt-1">{stats.total}</div>
            </div>
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Conversion rate</div>
              <div className="text-xl font-semibold tabular-nums mt-1">
                {stats.conversionRate != null ? `${stats.conversionRate}%` : "—"}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {(Object.keys(LEAD_STAGE_LABELS) as LeadStage[]).map((stage) => {
              const count = stats.byStage.get(stage) ?? 0;
              const max = Math.max(...Array.from(stats.byStage.values()), 1);
              const pct = (count / max) * 100;
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{LEAD_STAGE_LABELS[stage]}</span>
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function WebsiteSummary() {
  const analyticsQ = useWebsiteAnalytics();
  const snapshot = analyticsQ.data?.snapshot ?? null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold">Website Analytics</div>
        <Link to="/marketing/website-analytics" className="text-xs text-primary hover:underline">
          Open Website Analytics
        </Link>
      </div>
      {analyticsQ.isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !analyticsQ.data?.configured ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          Not connected — GA4 credentials haven't been configured yet.
        </div>
      ) : !snapshot ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          GA4 is connected but no sync has run yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-md border p-3 text-center">
            <div className="text-xs text-muted-foreground">Visitors (30d)</div>
            <div className="text-xl font-semibold tabular-nums mt-1">{snapshot.visitors.toLocaleString()}</div>
          </div>
          <div className="rounded-md border p-3 text-center">
            <div className="text-xs text-muted-foreground">Page views (30d)</div>
            <div className="text-xl font-semibold tabular-nums mt-1">{snapshot.page_views.toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function BlogSummary() {
  const postsQ = useBlogPosts();
  const posts = postsQ.data ?? [];

  const stats = useMemo(() => {
    const published = posts.filter((p) => p.status === "published");
    const draft = posts.filter((p) => p.status === "draft");
    const totalViews = published.reduce((s, p) => s + p.views, 0);
    const totalLikes = published.reduce((s, p) => s + p.likes, 0);
    const topPosts = [...published].sort((a, b) => b.views - a.views).slice(0, 5);
    return { published: published.length, draft: draft.length, totalViews, totalLikes, topPosts };
  }, [posts]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold">Blog</div>
        <Link to="/marketing/blog" className="text-xs text-primary hover:underline">
          Open Blog
        </Link>
      </div>
      {postsQ.isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">No posts yet.</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4 mt-3">
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Published</div>
              <div className="text-xl font-semibold tabular-nums mt-1">{stats.published}</div>
            </div>
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Drafts</div>
              <div className="text-xl font-semibold tabular-nums mt-1">{stats.draft}</div>
            </div>
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Total views</div>
              <div className="text-xl font-semibold tabular-nums mt-1">{stats.totalViews.toLocaleString()}</div>
            </div>
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Total likes</div>
              <div className="text-xl font-semibold tabular-nums mt-1">{stats.totalLikes.toLocaleString()}</div>
            </div>
          </div>
          {stats.topPosts.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">Top posts by views</div>
              <div className="divide-y">
                {stats.topPosts.map((p) => (
                  <Link
                    key={p.id}
                    to="/marketing/blog/$postId"
                    params={{ postId: p.id }}
                    className="flex items-center justify-between py-2 text-sm hover:bg-secondary/40 -mx-1 px-1 rounded"
                  >
                    <span className="font-medium truncate">{p.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                      {p.views.toLocaleString()} views
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
