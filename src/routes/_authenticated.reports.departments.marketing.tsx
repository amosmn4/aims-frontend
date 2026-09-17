import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { LoadError } from "@/components/load-error";
import { useLeads, LEAD_STAGE_LABELS, type LeadStage } from "@/features/marketing/use-leads";
import { useWebsiteAnalytics } from "@/features/marketing/use-website-analytics";
import { useBlogPosts } from "@/features/marketing/use-blog";
import { DepartmentReportsPanel } from "@/features/reports/department-reports-panel";
import { ReportHeader } from "@/features/reports/report-header";

export const Route = createFileRoute("/_authenticated/reports/departments/marketing")({
  head: () => ({ meta: [{ title: "Marketing report — AIMS" }] }),
  component: MarketingReport,
});

const ACTIVE_STAGES: LeadStage[] = ["new", "contacted", "qualified", "nurturing"];

function Spinner() {
  return (
    <div className="flex justify-center py-6">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// Exported so the Marketing department hub can embed this same report as a "Reports" tab.
export function MarketingReport() {
  return (
    <RequireRole
      roles={["marketing"]}
      message="The Marketing report is for the Marketing team and the CEO."
    >
      <div className="space-y-4">
        <ReportHeader
          title="Marketing report"
          description="Leads by stage, website visits and how far blog posts reach."
          actions={
            <Link to="/marketing" className="text-xs text-primary hover:underline">
              Open Marketing
            </Link>
          }
        />
        <DepartmentReportsPanel departmentCode="marketing" />
        <LeadsSummary />
        <WebsiteSummary />
        <BlogSummary />
      </div>
    </RequireRole>
  );
}

function SectionTitle({
  id,
  title,
  to,
  linkLabel,
}: {
  id: string;
  title: string;
  to: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <h3 id={id} className="text-sm font-semibold">
        {title}
      </h3>
      <Link to={to} className="text-xs text-primary hover:underline">
        {linkLabel}
      </Link>
    </div>
  );
}

function LeadsSummary() {
  const leadsQ = useLeads();

  const stats = useMemo(() => {
    const leads = leadsQ.data ?? [];
    const active = leads.filter((l) => ACTIVE_STAGES.includes(l.stage));
    const converted = leads.filter((l) => l.stage === "converted");
    const closed = leads.filter((l) => l.stage === "converted" || l.stage === "lost");
    const conversionRate =
      closed.length > 0 ? Math.round((converted.length / closed.length) * 100) : null;
    const byStage = new Map<LeadStage, number>();
    for (const l of leads) byStage.set(l.stage, (byStage.get(l.stage) ?? 0) + 1);
    return { total: leads.length, active: active.length, conversionRate, byStage };
  }, [leadsQ.data]);
  const max = Math.max(...Array.from(stats.byStage.values()), 1);

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="mkt-leads-heading">
      <SectionTitle
        id="mkt-leads-heading"
        title="Leads"
        to="/marketing/leads"
        linkLabel="Open Leads"
      />
      {leadsQ.isError ? (
        <LoadError what="leads" error={leadsQ.error} onRetry={() => leadsQ.refetch()} />
      ) : leadsQ.isLoading ? (
        <Spinner />
      ) : stats.total === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No leads yet.</p>
      ) : (
        <>
          <div className="mb-4 mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Open" value={stats.active} />
            <Stat label="Total" value={stats.total} />
            <Stat
              label="Conversion rate"
              value={stats.conversionRate != null ? `${stats.conversionRate}%` : "—"}
            />
          </div>
          <div className="space-y-2">
            {(Object.keys(LEAD_STAGE_LABELS) as LeadStage[]).map((stage) => {
              const count = stats.byStage.get(stage) ?? 0;
              return (
                <div key={stage}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{LEAD_STAGE_LABELS[stage]}</span>
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function WebsiteSummary() {
  const analyticsQ = useWebsiteAnalytics();
  const snapshot = analyticsQ.data?.snapshot ?? null;

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="mkt-web-heading">
      <SectionTitle
        id="mkt-web-heading"
        title="Website analytics"
        to="/marketing/website-analytics"
        linkLabel="Open Website analytics"
      />
      {analyticsQ.isError ? (
        <LoadError
          what="website analytics"
          error={analyticsQ.error}
          onRetry={() => analyticsQ.refetch()}
        />
      ) : analyticsQ.isLoading ? (
        <Spinner />
      ) : !analyticsQ.data?.configured ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Website analytics isn't connected yet. IT will set this up.
        </p>
      ) : !snapshot ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Website analytics is connected but hasn't been synced yet.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat label="Visitors (last 30 days)" value={snapshot.visitors.toLocaleString()} />
          <Stat label="Page views (last 30 days)" value={snapshot.page_views.toLocaleString()} />
        </div>
      )}
    </section>
  );
}

function BlogSummary() {
  const postsQ = useBlogPosts();

  const stats = useMemo(() => {
    const posts = postsQ.data ?? [];
    const published = posts.filter((p) => p.status === "published");
    const draft = posts.filter((p) => p.status === "draft");
    const totalViews = published.reduce((s, p) => s + p.views, 0);
    const totalLikes = published.reduce((s, p) => s + p.likes, 0);
    const topPosts = [...published].sort((a, b) => b.views - a.views).slice(0, 5);
    return {
      count: posts.length,
      published: published.length,
      draft: draft.length,
      totalViews,
      totalLikes,
      topPosts,
    };
  }, [postsQ.data]);

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="mkt-blog-heading">
      <SectionTitle id="mkt-blog-heading" title="Blog" to="/marketing/blog" linkLabel="Open Blog" />
      {postsQ.isError ? (
        <LoadError what="blog posts" error={postsQ.error} onRetry={() => postsQ.refetch()} />
      ) : postsQ.isLoading ? (
        <Spinner />
      ) : stats.count === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No posts yet.</p>
      ) : (
        <>
          <div className="mb-4 mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Published" value={stats.published} />
            <Stat label="Drafts" value={stats.draft} />
            <Stat label="Total views" value={stats.totalViews.toLocaleString()} />
            <Stat label="Total likes" value={stats.totalLikes.toLocaleString()} />
          </div>
          {stats.topPosts.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
                Most viewed posts
              </h4>
              <ul className="divide-y">
                {stats.topPosts.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/marketing/blog/$postId"
                      params={{ postId: p.id }}
                      className="-mx-1 flex items-center justify-between rounded px-1 py-2 text-sm hover:bg-secondary/40"
                    >
                      <span className="truncate font-medium">{p.title}</span>
                      <span className="ml-2 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {p.views.toLocaleString()} views
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
