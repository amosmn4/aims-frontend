import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTicketInsights } from "@/features/it/ticket-insights";
import { CHART_BLUE, CHART_GREEN } from "@/components/chart-colors";
import { LoadError } from "@/components/load-error";

/** Are we fixing as fast as staff are asking? Six weeks of tickets in and out. */
export function TicketFlowChart() {
  const { query, flow } = useTicketInsights();
  const anyActivity = flow.some((w) => w.raised > 0 || w.finished > 0);

  return (
    <section className="rounded-xl border bg-card p-4" aria-labelledby="ticket-flow-heading">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 id="ticket-flow-heading" className="text-sm font-semibold">
          Are we keeping up?
        </h2>
        <Link
          to="/it/tickets"
          search={{ view: "board" }}
          className="text-xs font-medium text-primary hover:underline"
        >
          Open the ticket board
        </Link>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Tickets raised against tickets finished, week by week.
      </p>

      {query.isError ? (
        <LoadError what="tickets" error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !anyActivity ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No tickets in the last six weeks. This fills in as staff ask IT for help.
        </p>
      ) : (
        <div className="h-52">
          <ResponsiveContainer>
            <BarChart data={flow} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelFormatter={(v) => `Week of ${v}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="raised" name="Raised" fill={CHART_BLUE} radius={[4, 4, 0, 0]} />
              <Bar dataKey="finished" name="Finished" fill={CHART_GREEN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
