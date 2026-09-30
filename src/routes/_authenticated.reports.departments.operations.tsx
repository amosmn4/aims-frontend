import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { RequireDepartmentAccess } from "@/components/require-role";
import { LoadError } from "@/components/load-error";
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
import { DepartmentReportsPanel } from "@/features/reports/department-reports-panel";
import { ReportHeader } from "@/features/reports/report-header";

export const Route = createFileRoute("/_authenticated/reports/departments/operations")({
  head: () => ({ meta: [{ title: "Operations report — AIMS" }] }),
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

function Spinner() {
  return (
    <div className="flex justify-center py-6">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );
}

// Exported so the Operations department hub can embed this same report as a "Reports" tab.
export function OperationsReport() {
  return (
    <RequireDepartmentAccess
      code="operations"
      message="The Operations report is for the Operations team, people given Operations access and the CEO."
    >
      <div className="space-y-4">
        <ReportHeader
          title="Operations report"
          description="Client requests from first contact to won or lost: how many convert, where they get stuck, and the latest ones."
          actions={
            <Link to="/operations" className="text-xs text-primary hover:underline">
              Open Operations
            </Link>
          }
        />
        <DepartmentReportsPanel departmentCode="operations" />
        <RequestsSummary />
        <TimeInStage />
        <RecentRequests />
      </div>
    </RequireDepartmentAccess>
  );
}

function RequestsSummary() {
  const summaryQ = useClientRequestPipelineSummary();
  const lostBreakdownQ = useLostBreakdown();
  const summary = summaryQ.data ?? [];
  const total = summary.reduce((sum, s) => sum + s.count, 0);
  const wonCount = summary.find((s) => s.stage === "won")?.count ?? 0;
  const lostCount = summary.find((s) => s.stage === "lost")?.count ?? 0;
  const withdrawnCount = summary.find((s) => s.stage === "withdrawn")?.count ?? 0;
  const resolved = wonCount + lostCount + withdrawnCount;
  const conversionRate = resolved > 0 ? wonCount / resolved : null;
  const openValue = summary
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
    <section className="rounded-lg border bg-card p-4" aria-labelledby="ops-summary-heading">
      <h3 id="ops-summary-heading" className="mb-2 text-sm font-semibold">
        Client requests by stage
      </h3>
      {summaryQ.isError ? (
        <LoadError
          what="client requests"
          error={summaryQ.error}
          onRetry={() => summaryQ.refetch()}
        />
      ) : summaryQ.isLoading ? (
        <Spinner />
      ) : total === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No client requests yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0 overflow-hidden lg:col-span-2">
            <FunnelChart stages={funnelData} formatValue={(v) => v.toLocaleString()} />
          </div>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-muted-foreground">Value of open client requests</dt>
              <dd className="text-xl font-semibold tabular-nums">{formatCurrency(openValue)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Conversion rate</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {conversionRate != null ? `${(conversionRate * 100).toFixed(0)}%` : "—"}
              </dd>
            </div>
            {lostBreakdownTotal > 0 && (
              <div>
                <dt className="mb-1 text-xs text-muted-foreground">Stage they were lost at</dt>
                <dd>
                  <ul className="space-y-1">
                    {lostBreakdown
                      .slice()
                      .sort((a, b) => b.count - a.count)
                      .map((r) => (
                        <li key={r.stage} className="flex items-center justify-between text-xs">
                          <span>{CLIENT_REQUEST_STAGE_LABELS[r.stage]}</span>
                          <span className="tabular-nums text-muted-foreground">{r.count}</span>
                        </li>
                      ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </section>
  );
}

function TimeInStage() {
  const timeInStageQ = useClientRequestTimeInStage();
  const rows = timeInStageQ.data ?? [];
  const stuck = rows.filter((r) => r.stuck_count > 0);

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="ops-stuck-heading">
      <h3 id="ops-stuck-heading" className="mb-1 text-sm font-semibold">
        Where client requests are stuck today
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Average days in each stage, and the oldest request still waiting there.
      </p>
      {timeInStageQ.isError ? (
        <LoadError
          what="time in each stage"
          error={timeInStageQ.error}
          onRetry={() => timeInStageQ.refetch()}
        />
      ) : timeInStageQ.isLoading ? (
        <Spinner />
      ) : rows.every((r) => r.sample_size === 0) ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Not enough history yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((r) => (
              <div key={r.stage} className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">
                  {CLIENT_REQUEST_STAGE_LABELS[r.stage]}
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {r.avg_days != null ? `${r.avg_days} days` : "—"}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">on average</div>
                {r.oldest_stuck && (
                  <div
                    className="mt-1.5 truncate text-xs text-warning"
                    title={r.oldest_stuck.title}
                  >
                    Oldest: {r.oldest_stuck.days} days — {r.oldest_stuck.title}
                  </div>
                )}
              </div>
            ))}
          </div>
          {stuck.length === 0 && (
            <p className="mt-3 text-xs text-success">
              Nothing stuck. Every open client request has moved recently.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function RecentRequests() {
  const requestsQ = useClientRequests();
  const rows = (requestsQ.data ?? []).slice(0, 5);

  return (
    <section className="rounded-lg border bg-card p-3" aria-labelledby="ops-recent-heading">
      <h3 id="ops-recent-heading" className="mb-2 text-sm font-semibold">
        Latest client requests
      </h3>
      {requestsQ.isError ? (
        <LoadError
          what="client requests"
          error={requestsQ.error}
          onRetry={() => requestsQ.refetch()}
        />
      ) : requestsQ.isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">No client requests yet.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to="/requests/$requestId"
                params={{ requestId: r.id }}
                className="flex items-center gap-2 rounded px-1 py-2 hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.department_name ?? "Not routed yet"}
                    {(r.client_name ?? r.prospect_client_name) &&
                      ` · ${r.client_name ?? r.prospect_client_name}`}
                  </div>
                </div>
                <Badge className={CLIENT_REQUEST_STAGE_STYLES[r.stage]} variant="secondary">
                  {CLIENT_REQUEST_STAGE_LABELS[r.stage]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
