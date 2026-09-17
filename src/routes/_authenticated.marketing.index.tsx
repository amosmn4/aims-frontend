import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, CheckCircle2, Eye, Loader2, PlugZap, TrendingUp, Users } from "lucide-react";
import {
  useLeads,
  LEAD_STAGE_LABELS,
  type LeadRow,
  type LeadStage,
} from "@/features/marketing/use-leads";
import { useWebsiteAnalytics } from "@/features/marketing/use-website-analytics";
import { NewLeadDialog } from "@/features/marketing/new-lead-dialog";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ActionHint } from "@/components/help-link";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useAuth } from "@/lib/auth";
import { formatRelative } from "@/lib/format-date";

import { OwnWorkPanels } from "@/features/my-work/own-work-panels";
// The department's own pages, so they're on the page as well as in the menu.
const MARKETING_PAGES = [
  { to: "/marketing/leads", label: "Leads" },
  { to: "/marketing/campaigns", label: "Campaigns" },
  { to: "/marketing/blog", label: "Blog" },
  { to: "/marketing/website-analytics", label: "Website analytics" },
] as const;

export const Route = createFileRoute("/_authenticated/marketing/")({
  head: () => ({ meta: [{ title: "Marketing — AIMS" }] }),
  component: MarketingOverview,
});

const ACTIVE_STAGES: LeadStage[] = ["new", "contacted", "qualified", "nurturing"];

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function MarketingOverview() {
  const { isAdminOrCeo, hasRole, profile } = useAuth();
  const canManage = isAdminOrCeo || hasRole("marketing");
  const navigate = useNavigate();
  const leadsQ = useLeads();
  const analyticsQ = useWebsiteAnalytics();

  const stats = useMemo(() => {
    const leads = leadsQ.data ?? [];
    const active = leads.filter((l) => ACTIVE_STAGES.includes(l.stage));
    const converted = leads.filter((l) => l.stage === "converted");
    const closed = leads.filter((l) => l.stage === "converted" || l.stage === "lost");
    const conversionRate =
      closed.length > 0 ? Math.round((converted.length / closed.length) * 100) : null;
    const byStage = new Map<LeadStage, number>();
    for (const l of leads) byStage.set(l.stage, (byStage.get(l.stage) ?? 0) + 1);
    const newest = (a: LeadRow, b: LeadRow) => b.updated_at.localeCompare(a.updated_at);
    const mine = active
      .filter((l) => l.created_by === profile?.id)
      .sort(newest)
      .slice(0, 5);
    const recent = [...leads].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);
    return { total: leads.length, active: active.length, conversionRate, byStage, mine, recent };
  }, [leadsQ.data, profile?.id]);

  const openLead = (id: string) => navigate({ to: "/marketing/leads", search: { lead: id } });
  const snapshot = analyticsQ.data?.snapshot ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketing"
        description="Find new clients: track leads, run campaigns, publish blog posts and watch website visits."
        actions={canManage ? <NewLeadDialog onCreated={openLead} /> : undefined}
      />
      {canManage ? (
        <ActionHint topic="convert lead to client request">
          When a lead is ready, use Convert to client request so Operations can route it.
        </ActionHint>
      ) : (
        <ViewOnlyBanner area="Marketing" />
      )}
      <OwnWorkPanels departmentCode="marketing" role="marketing" />
      <nav aria-label="Marketing pages" className="flex flex-wrap gap-2">
        {MARKETING_PAGES.map((p) => (
          <Link
            key={p.to}
            to={p.to}
            className="rounded-lg border bg-card px-3 py-2 text-sm hover:border-primary hover:text-primary"
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {leadsQ.isError ? (
        <LoadError what="leads" error={leadsQ.error} onRetry={() => leadsQ.refetch()} />
      ) : leadsQ.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <StatCard
              label="Open leads"
              value={String(stats.active)}
              hint={`${stats.total} leads in total`}
              icon={Users}
            />
            <StatCard
              label="Conversion rate"
              value={stats.conversionRate != null ? `${stats.conversionRate}%` : "—"}
              hint="Converted out of converted and lost"
              icon={CheckCircle2}
            />
            <StatCard
              label="Website visitors"
              value={snapshot ? snapshot.visitors.toLocaleString() : "—"}
              hint="Last 30 days"
              icon={Eye}
            />
            <StatCard
              label="Website page views"
              value={snapshot ? snapshot.page_views.toLocaleString() : "—"}
              hint="Last 30 days"
              icon={TrendingUp}
            />
          </div>

          {stats.mine.length > 0 && (
            <LeadList
              title="Your open leads"
              leads={stats.mine}
              onOpen={openLead}
              when={(l) => `Updated ${formatRelative(l.updated_at)}`}
            />
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border bg-card p-4" aria-labelledby="stage-heading">
              <h2 id="stage-heading" className="mb-3 text-sm font-semibold">
                Leads by stage
              </h2>
              {stats.total === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">No leads yet.</p>
                  {canManage && (
                    <div className="mt-3 flex justify-center">
                      <NewLeadDialog onCreated={openLead} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {(Object.keys(LEAD_STAGE_LABELS) as LeadStage[]).map((stage) => {
                    const count = stats.byStage.get(stage) ?? 0;
                    const max = Math.max(...Array.from(stats.byStage.values()), 1);
                    return (
                      <div key={stage}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium">{LEAD_STAGE_LABELS[stage]}</span>
                          <span className="tabular-nums text-muted-foreground">{count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${(count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link
                to="/marketing/leads"
                className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open Leads <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </section>

            {stats.recent.length > 0 ? (
              <LeadList
                title="Recent leads"
                leads={stats.recent}
                onOpen={openLead}
                when={(l) => `Added ${formatRelative(l.created_at)}`}
              />
            ) : (
              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">Recent leads</h2>
                <p className="py-6 text-center text-sm text-muted-foreground">No leads yet.</p>
              </section>
            )}
          </div>
        </>
      )}

      {analyticsQ.isError ? (
        <LoadError
          what="website analytics"
          error={analyticsQ.error}
          onRetry={() => analyticsQ.refetch()}
        />
      ) : (
        analyticsQ.isSuccess &&
        !analyticsQ.data.configured && (
          <div className="flex items-start gap-3 rounded-lg border border-dashed bg-card p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
              <PlugZap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold">Website analytics isn't connected yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                IT will set this up.{" "}
                <Link to="/marketing/website-analytics" className="text-primary hover:underline">
                  About website analytics
                </Link>
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function LeadList({
  title,
  leads,
  onOpen,
  when,
}: {
  title: string;
  leads: LeadRow[];
  onOpen: (id: string) => void;
  when: (l: LeadRow) => string;
}) {
  return (
    <section className="rounded-lg border bg-card p-4" aria-label={title}>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <ul className="divide-y">
        {leads.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => onOpen(l.id)}
              className="flex w-full items-center justify-between gap-3 rounded px-1 py-2.5 text-left text-sm hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {l.name}
                  {l.company && (
                    <span className="font-normal text-muted-foreground"> · {l.company}</span>
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">{when(l)}</span>
              </span>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {LEAD_STAGE_LABELS[l.stage]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
