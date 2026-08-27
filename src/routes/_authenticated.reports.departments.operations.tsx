import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import {
  useClientRequests,
  useClientRequestPipelineSummary,
  useLostBreakdown,
  useClientRequestTimeInStage,
  CLIENT_REQUEST_STAGE_LABELS,
  CLIENT_REQUEST_STAGE_STYLES,
  type ClientRequestStage,
} from "@/features/client-requests/use-client-requests";
import { FunnelChart } from "@/components/funnel-chart";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/features/finance/finance";

export const Route = createFileRoute("/_authenticated/reports/departments/operations")({
  head: () => ({ meta: [{ title: "Operations Report — AIMS" }] }),
  component: OperationsReport,
});

const FUNNEL_STAGES: ClientRequestStage[] = [
  "new",
  "assigned",
  "engaging",
  "proposal",
  "won",
  "lost",
  "withdrawn",
];
const FUNNEL_COLORS: Record<string, string> = {
  new: "#8C8C8C",
  assigned: "#085599",
  engaging: "#F5821F",
  proposal: "#6B5490",
  won: "#2E9E4F",
  lost: "#D64545",
  withdrawn: "#94a3b8",
};

// Exported so the Operations department hub can embed this same report as a "Reports" tab.
export function OperationsReport() {
  return (
    <RequireRole
      roles={["operations"]}
      message="The Operations report is restricted to the Operations team, CEO and System Administrator."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Operations</div>
            <div className="text-xs text-muted-foreground">
              Client request intake funnel — conversion rate, where requests stall, recent activity.
            </div>
          </div>
          <Link to="/operations" className="text-xs text-primary hover:underline">
            Open Operations workspace
          </Link>
        </div>
        <PipelineSummary />
        <TimeInStage />
        <RecentRequests />
      </div>
    </RequireRole>
  );
}

function PipelineSummary() {
  const summaryQ = useClientRequestPipelineSummary();
  const lostBreakdownQ = useLostBreakdown();
  const summary = summaryQ.data ?? [];
  const total = summary.reduce((sum, s) => sum + s.count, 0);
  const wonCount = summary.find((s) => s.stage === "won")?.count ?? 0;
  const lostCount = summary.find((s) => s.stage === "lost")?.count ?? 0;
  const withdrawnCount = summary.find((s) => s.stage === "withdrawn")?.count ?? 0;
  const resolved = wonCount + lostCount + withdrawnCount;
  const conversionRate = resolved > 0 ? wonCount / resolved : null;
  const pipelineValue = summary
    .filter((s) => !["won", "lost", "withdrawn"].includes(s.stage))
    .reduce((sum, s) => sum + s.total_value, 0);

  const funnelData = FUNNEL_STAGES.map((s) => ({
    stage: CLIENT_REQUEST_STAGE_LABELS[s],
    value: summary.find((r) => r.stage === s)?.count ?? 0,
    color: FUNNEL_COLORS[s],
  }));

  const lostBreakdown = lostBreakdownQ.data ?? [];
  const lostBreakdownTotal = lostBreakdown.reduce((s, r) => s + r.count, 0);

  return (
    <div className="rounded-lg border bg-card p-4">
      {summaryQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : total === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">
          No client requests recorded yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 min-w-0 overflow-hidden">
            <FunnelChart stages={funnelData} formatValue={(v) => v.toLocaleString()} />
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Active pipeline value
              </div>
              <div className="text-xl font-semibold tabular-nums">
                {formatCurrency(pipelineValue)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Conversion rate
              </div>
              <div className="text-xl font-semibold tabular-nums">
                {conversionRate != null ? `${(conversionRate * 100).toFixed(0)}%` : "—"}
              </div>
            </div>
            {lostBreakdownTotal > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Where requests fail
                </div>
                <ul className="space-y-1">
                  {lostBreakdown
                    .slice()
                    .sort((a, b) => b.count - a.count)
                    .map((r) => (
                      <li key={r.stage} className="flex items-center justify-between text-xs">
                        <span>{CLIENT_REQUEST_STAGE_LABELS[r.stage]}</span>
                        <span className="text-muted-foreground tabular-nums">{r.count}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TimeInStage() {
  const timeInStageQ = useClientRequestTimeInStage();
  const rows = timeInStageQ.data ?? [];
  const stuck = rows.filter((r) => r.stuck_count > 0);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm font-semibold mb-1">Where requests are stuck today</div>
      <p className="text-xs text-muted-foreground mb-3">
        Average days per stage, and the oldest request still waiting in each.
      </p>
      {timeInStageQ.isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : rows.every((r) => r.sample_size === 0) ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          Not enough history yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {rows.map((r) => (
            <div key={r.stage} className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">
                {CLIENT_REQUEST_STAGE_LABELS[r.stage]}
              </div>
              <div className="text-lg font-semibold tabular-nums mt-1">
                {r.avg_days != null ? `${r.avg_days}d` : "—"}
              </div>
              <div className="text-[0.6875rem] text-muted-foreground mt-0.5">avg time in stage</div>
              {r.oldest_stuck && (
                <div
                  className="text-[0.6875rem] text-warning mt-1.5 truncate"
                  title={r.oldest_stuck.title}
                >
                  Oldest stuck: {r.oldest_stuck.days}d — {r.oldest_stuck.title}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {stuck.length === 0 && !timeInStageQ.isLoading && (
        <p className="text-xs text-success mt-3">
          Nothing stuck — every open request has moved recently.
        </p>
      )}
    </div>
  );
}

function RecentRequests() {
  const requestsQ = useClientRequests();
  const rows = (requestsQ.data ?? []).slice(0, 5);

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-sm font-semibold mb-2">Recent requests</div>
      {requestsQ.isLoading ? (
        <div className="py-4 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">No client requests yet.</div>
      ) : (
        <div className="divide-y">
          {rows.map((r) => (
            <Link
              key={r.id}
              to="/requests/$requestId"
              params={{ requestId: r.id }}
              className="flex items-center gap-2 py-2 hover:bg-secondary/50 rounded px-1"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.title}</div>
                <div className="text-[0.6875rem] text-muted-foreground">
                  {r.department_name ?? "Unrouted"}
                  {(r.client_name ?? r.prospect_client_name) &&
                    ` · ${r.client_name ?? r.prospect_client_name}`}
                </div>
              </div>
              <Badge className={CLIENT_REQUEST_STAGE_STYLES[r.stage]} variant="secondary">
                {CLIENT_REQUEST_STAGE_LABELS[r.stage]}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
