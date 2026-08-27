import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Users, Eye, FileText, RefreshCw, PlugZap } from "lucide-react";
import { useWebsiteAnalytics, useSyncWebsiteAnalyticsNow } from "@/features/marketing/use-website-analytics";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/marketing/website-analytics")({
  head: () => ({ meta: [{ title: "Website Analytics — AIMS" }] }),
  component: WebsiteAnalyticsPage,
});

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

function WebsiteAnalyticsPage() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("marketing");
  const analyticsQ = useWebsiteAnalytics();
  const sync = useSyncWebsiteAnalyticsNow();

  if (analyticsQ.isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const data = analyticsQ.data;
  const snapshot = data?.snapshot ?? null;

  const runSync = () => {
    sync.mutate(undefined, {
      onSuccess: (res) => {
        if (!res.configured) {
          toast.error("GA4 is not connected — add GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_KEY_JSON to the backend environment first.");
        } else if (!res.synced) {
          toast.error("Sync ran but returned no data — check the backend logs.");
        } else {
          toast.success("Website analytics synced");
        }
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Sync failed"),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Website Analytics</h1>
          <p className="text-xs text-muted-foreground">
            Visitors, page views and engagement on amsol's website, from Google Analytics (GA4).
          </p>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={runSync} disabled={sync.isPending}>
            {sync.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1.5" />
            )}
            Sync now
          </Button>
        )}
      </div>

      {!data?.configured ? (
        <div className="rounded-lg border border-dashed bg-card py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <PlugZap className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-semibold">Not connected</div>
          <p className="mt-1.5 max-w-md mx-auto text-xs text-muted-foreground">
            Add <code className="rounded bg-secondary px-1 py-0.5">GA4_PROPERTY_ID</code> and{" "}
            <code className="rounded bg-secondary px-1 py-0.5">GA4_SERVICE_ACCOUNT_KEY_JSON</code> to the backend
            environment, then sync to start seeing real numbers here.
          </p>
        </div>
      ) : !snapshot ? (
        <div className="rounded-lg border border-dashed bg-card py-14 text-center text-sm text-muted-foreground">
          GA4 is connected but no sync has run yet.{" "}
          {canManage ? "Click \"Sync now\" above." : "Ask Marketing to run a sync."}
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {snapshot.period_start} → {snapshot.period_end} · last synced {new Date(snapshot.created_at).toLocaleString()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Visitors" value={snapshot.visitors.toLocaleString()} hint="Last 30 days" icon={Users} />
            <StatCard label="Page Views" value={snapshot.page_views.toLocaleString()} hint="Last 30 days" icon={Eye} />
            <StatCard
              label="Blog Page Views"
              value={snapshot.blog_page_views != null ? snapshot.blog_page_views.toLocaleString() : "—"}
              hint="Last 30 days"
              icon={FileText}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Top pages</h2>
              {snapshot.top_pages.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">No page data.</div>
              ) : (
                <div className="space-y-2">
                  {snapshot.top_pages.map((p) => (
                    <div key={p.path} className="flex items-center justify-between text-sm">
                      <span className="truncate">{p.path}</span>
                      <span className="tabular-nums text-muted-foreground shrink-0 ml-2">
                        {p.views.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Top sources</h2>
              {snapshot.top_sources.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">No source data.</div>
              ) : (
                <div className="space-y-2">
                  {snapshot.top_sources.map((s) => (
                    <div key={s.source} className="flex items-center justify-between text-sm">
                      <span className="truncate">{s.source}</span>
                      <span className="tabular-nums text-muted-foreground shrink-0 ml-2">
                        {s.sessions.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
