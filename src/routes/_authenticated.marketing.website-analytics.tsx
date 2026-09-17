import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, FileText, Loader2, PlugZap, RefreshCw, Users } from "lucide-react";
import {
  useWebsiteAnalytics,
  useSyncWebsiteAnalyticsNow,
} from "@/features/marketing/use-website-analytics";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useAuth } from "@/lib/auth";
import { formatDate, formatRelative } from "@/lib/format-date";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/marketing/website-analytics")({
  head: () => ({ meta: [{ title: "Website analytics — AIMS" }] }),
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

function TopList({
  title,
  rows,
  unit,
}: {
  title: string;
  rows: { key: string; value: number }[];
  unit: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No data for this period.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{r.key}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {r.value.toLocaleString()} {unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WebsiteAnalyticsPage() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("marketing");
  const analyticsQ = useWebsiteAnalytics();
  const sync = useSyncWebsiteAnalyticsNow();
  const data = analyticsQ.data;
  const snapshot = data?.snapshot ?? null;

  const runSync = () => {
    sync.mutate(undefined, {
      onSuccess: (res) => {
        if (!res.configured) {
          toast.error("Website analytics isn't connected yet. IT will set this up.");
        } else if (!res.synced) {
          toast.error("The sync finished but found no website data. Try again later or ask IT.");
        } else {
          toast.success("Website analytics updated");
        }
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't sync"),
    });
  };

  const syncButton = (
    <Button
      size="sm"
      variant="outline"
      onClick={runSync}
      disabled={sync.isPending || (analyticsQ.isSuccess && !data?.configured)}
    >
      {sync.isPending ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-1.5 h-4 w-4" />
      )}
      Sync website analytics
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Website analytics"
        description="Visitors, page views and where they came from on the company website, from Google Analytics."
        actions={canManage ? syncButton : undefined}
      />
      {!canManage && <ViewOnlyBanner area="website analytics" action="sync it" />}

      {analyticsQ.isError ? (
        <LoadError
          what="website analytics"
          error={analyticsQ.error}
          onRetry={() => analyticsQ.refetch()}
        />
      ) : analyticsQ.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data?.configured ? (
        <div className="rounded-lg border border-dashed bg-card px-4 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <PlugZap className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold">Not connected yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-muted-foreground">
            Website analytics isn't connected yet. IT will set this up.
          </p>
        </div>
      ) : !snapshot ? (
        <div className="rounded-lg border border-dashed bg-card px-4 py-12 text-center">
          <p className="text-sm font-medium">No figures yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {canManage
              ? "Website analytics is connected. Sync it to load the latest figures."
              : "Website analytics is connected. Ask Marketing to sync it."}
          </p>
          {canManage && <div className="mt-3">{syncButton}</div>}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {formatDate(snapshot.period_start)} to {formatDate(snapshot.period_end)} · last synced{" "}
            {formatRelative(snapshot.created_at)}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Visitors"
              value={snapshot.visitors.toLocaleString()}
              hint="Last 30 days"
              icon={Users}
            />
            <StatCard
              label="Page views"
              value={snapshot.page_views.toLocaleString()}
              hint="Last 30 days"
              icon={Eye}
            />
            <StatCard
              label="Blog page views"
              value={
                snapshot.blog_page_views != null ? snapshot.blog_page_views.toLocaleString() : "—"
              }
              hint="Last 30 days"
              icon={FileText}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TopList
              title="Top pages"
              unit="views"
              rows={snapshot.top_pages.map((p) => ({ key: p.path, value: p.views }))}
            />
            <TopList
              title="Top sources"
              unit="visits"
              rows={snapshot.top_sources.map((s) => ({ key: s.source, value: s.sessions }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
