import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LEAD_SOURCE_LABELS } from "@/features/marketing/use-leads";
import { useLeadInsights } from "@/features/marketing/lead-insights";
import { CHART_BLUE } from "@/components/chart-colors";
import { LoadError } from "@/components/load-error";

/** How many new leads arrive each month, and which channels bring them in. */
export function LeadTrendPanel() {
  const { query, leads, monthly, bySource, addedThisMonth, addedLastMonth } = useLeadInsights();
  const change = addedThisMonth - addedLastMonth;
  const sourceMax = Math.max(...bySource.map(([, count]) => count), 1);

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="lead-trend-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="lead-trend-heading" className="text-sm font-semibold">
          New leads each month
        </h2>
        <Link to="/marketing/leads" className="text-xs font-medium text-primary hover:underline">
          Open the leads board
        </Link>
      </div>

      {query.isError ? (
        <div className="p-4">
          <LoadError what="leads" error={query.error} onRetry={() => query.refetch()} />
        </div>
      ) : query.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : leads.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          This chart fills in once leads are added.
        </p>
      ) : (
        <div className="space-y-4 p-4">
          <p className="text-xs text-muted-foreground">
            <span className="text-base font-semibold tabular-nums text-foreground">
              {addedThisMonth}
            </span>{" "}
            so far this month ·{" "}
            {change === 0
              ? "same as last month"
              : `${Math.abs(change)} ${change > 0 ? "more" : "fewer"} than last month (${addedLastMonth})`}
          </p>

          <div className="h-44">
            <ResponsiveContainer>
              <BarChart data={monthly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [v, "Leads added"]}
                />
                <Bar dataKey="added" name="Leads added" fill={CHART_BLUE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
              Where leads come from
            </h3>
            <ul className="space-y-2">
              {bySource.slice(0, 5).map(([source, count]) => (
                <li key={source}>
                  <Link
                    to="/marketing/leads"
                    className="block rounded px-1 py-0.5 -mx-1 hover:bg-secondary/40"
                  >
                    <span className="mb-1 flex items-center justify-between text-sm">
                      <span>{LEAD_SOURCE_LABELS[source]}</span>
                      <span className="tabular-nums font-semibold">{count}</span>
                    </span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${(count / sourceMax) * 100}%` }}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
