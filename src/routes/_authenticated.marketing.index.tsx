import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Users, TrendingUp, CheckCircle2, Eye, PlugZap } from "lucide-react";
import { useLeads, LEAD_STAGE_LABELS, type LeadStage } from "@/features/marketing/use-leads";
import { useWebsiteAnalytics } from "@/features/marketing/use-website-analytics";

export const Route = createFileRoute("/_authenticated/marketing/")({
  head: () => ({ meta: [{ title: "Marketing Overview — AIMS" }] }),
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
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function MarketingOverview() {
  const leadsQ = useLeads();
  const analyticsQ = useWebsiteAnalytics();

  const loading = leadsQ.isLoading || analyticsQ.isLoading;

  const stats = useMemo(() => {
    const leads = leadsQ.data ?? [];
    const active = leads.filter((l) => ACTIVE_STAGES.includes(l.stage));
    const converted = leads.filter((l) => l.stage === "converted");
    const closed = leads.filter((l) => l.stage === "converted" || l.stage === "lost");
    const conversionRate = closed.length > 0 ? Math.round((converted.length / closed.length) * 100) : null;

    const byStage = new Map<LeadStage, number>();
    for (const l of leads) byStage.set(l.stage, (byStage.get(l.stage) ?? 0) + 1);

    const recent = [...leads].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);

    return { total: leads.length, active: active.length, conversionRate, byStage, recent };
  }, [leadsQ.data]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const snapshot = analyticsQ.data?.snapshot ?? null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Leads" value={String(stats.active)} hint={`${stats.total} total`} icon={Users} />
        <StatCard
          label="Conversion Rate"
          value={stats.conversionRate != null ? `${stats.conversionRate}%` : "—"}
          hint="Converted vs. converted + lost"
          icon={CheckCircle2}
        />
        <StatCard
          label="Website Visitors"
          value={snapshot ? snapshot.visitors.toLocaleString() : "—"}
          hint="Last 30 days"
          icon={Eye}
        />
        <StatCard
          label="Website Page Views"
          value={snapshot ? snapshot.page_views.toLocaleString() : "—"}
          hint="Last 30 days"
          icon={TrendingUp}
        />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">Leads by stage</h2>
        {stats.total === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No leads yet.</div>
        ) : (
          <div className="space-y-3">
            {(Object.keys(LEAD_STAGE_LABELS) as LeadStage[]).map((stage) => {
              const count = stats.byStage.get(stage) ?? 0;
              const max = Math.max(...Array.from(stats.byStage.values()), 1);
              const pct = (count / max) * 100;
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{LEAD_STAGE_LABELS[stage]}</span>
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4">
          <Link to="/marketing/leads" className="text-xs text-primary hover:underline">
            Open the Leads board →
          </Link>
        </div>
      </div>

      {!analyticsQ.data?.configured && (
        <div className="rounded-lg border border-dashed bg-card p-6 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
            <PlugZap className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">Website analytics not connected</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect GA4 to see visitor and page-view trends here.{" "}
              <Link to="/marketing/website-analytics" className="text-primary hover:underline">
                Set it up →
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">Recent leads</h2>
        {stats.recent.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Nothing logged for Marketing yet.</div>
        ) : (
          <div className="divide-y">
            {stats.recent.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{l.name}</span>
                  {l.company && <span className="text-muted-foreground">· {l.company}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{LEAD_STAGE_LABELS[l.stage]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
