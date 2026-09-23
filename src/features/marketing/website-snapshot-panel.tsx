import { Link } from "@tanstack/react-router";
import { Loader2, PlugZap } from "lucide-react";
import { useWebsiteAnalytics } from "@/features/marketing/use-website-analytics";
import { LoadError } from "@/components/load-error";
import { formatDate } from "@/lib/format-date";

/** Headline website numbers for the last reporting period, straight from analytics. */
export function WebsiteSnapshotPanel() {
  const analyticsQ = useWebsiteAnalytics();
  const snapshot = analyticsQ.data?.snapshot ?? null;
  const configured = analyticsQ.data?.configured ?? false;
  const sources = snapshot?.top_sources ?? [];
  const sourceMax = Math.max(...sources.map((s) => s.sessions), 1);

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="website-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="website-heading" className="text-sm font-semibold">
          Website visits
        </h2>
        <Link
          to="/marketing/website-analytics"
          className="text-xs font-medium text-primary hover:underline"
        >
          Full website report
        </Link>
      </div>

      {analyticsQ.isError ? (
        <div className="p-4">
          <LoadError
            what="website analytics"
            error={analyticsQ.error}
            onRetry={() => analyticsQ.refetch()}
          />
        </div>
      ) : analyticsQ.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !configured ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
            <PlugZap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium">Website analytics isn&apos;t connected yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            IT sets this up once, then visitor numbers appear here on their own.
          </p>
          <Link
            to="/marketing/website-analytics"
            className="text-xs font-medium text-primary hover:underline"
          >
            What this needs
          </Link>
        </div>
      ) : !snapshot ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Connected, but no figures have come through yet. They arrive with the next sync.
        </p>
      ) : (
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">
            {formatDate(snapshot.period_start)} to {formatDate(snapshot.period_end)}
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {[
              { label: "People", value: snapshot.visitors },
              { label: "Pages opened", value: snapshot.page_views },
              { label: "Blog reads", value: snapshot.blog_page_views ?? 0 },
            ].map((s) => (
              <li key={s.label}>
                <Link
                  to="/marketing/website-analytics"
                  className="block rounded-lg border px-3 py-2 hover:border-primary/50"
                >
                  <span className="block text-xs text-muted-foreground">{s.label}</span>
                  <span className="block text-lg font-semibold tabular-nums">
                    {s.value.toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
              How people found us
            </h3>
            {sources.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sources came through this period.</p>
            ) : (
              <ul className="space-y-2">
                {sources.slice(0, 4).map((s) => (
                  <li key={s.source}>
                    <span className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate">{s.source}</span>
                      <span className="tabular-nums font-semibold">
                        {s.sessions.toLocaleString()}
                      </span>
                    </span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${(s.sessions / sourceMax) * 100}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
