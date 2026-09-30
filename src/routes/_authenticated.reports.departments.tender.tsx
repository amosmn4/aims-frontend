import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { LoadError } from "@/components/load-error";
import {
  useTenders,
  useTenderPipelineSummary,
  TENDER_STAGE_LABELS,
  TENDER_STAGE_STYLES,
  type TenderStage,
} from "@/features/tender/use-tender";
import { formatCurrency } from "@/features/finance/finance";
import { FunnelChart } from "@/components/funnel-chart";
import { Badge } from "@/components/ui/badge";
import { DepartmentReportsPanel } from "@/features/reports/department-reports-panel";
import { ReportHeader } from "@/features/reports/report-header";

export const Route = createFileRoute("/_authenticated/reports/departments/tender")({
  head: () => ({ meta: [{ title: "Tender report — AIMS" }] }),
  component: TenderReport,
});

const FUNNEL_STAGES: TenderStage[] = [
  "identified",
  "applying",
  "submitted",
  "won",
  "lost",
  "withdrawn",
  "cancelled",
];
const FUNNEL_COLORS: Record<string, string> = {
  identified: "#8C8C8C",
  applying: "#085599",
  submitted: "#F5821F",
  won: "#2E9E4F",
  lost: "#D64545",
  withdrawn: "#94a3b8",
  cancelled: "#6B5490",
};

function Spinner() {
  return (
    <div className="flex justify-center py-6">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );
}

// Exported so the Tender department hub can embed this report as a tab.
export function TenderReport() {
  return (
    <RequireRole roles={["tender"]} message="The Tender report is for the Tender team and the CEO.">
      <div className="space-y-4">
        <ReportHeader
          title="Tender report"
          description="Tenders at each stage, the value still open, win rate and the latest tenders."
          actions={
            <Link to="/tender" className="text-xs text-primary hover:underline">
              Open Tenders
            </Link>
          }
        />
        <DepartmentReportsPanel departmentCode="tender" />
        <TendersSummary />
        <RecentTenders />
      </div>
    </RequireRole>
  );
}

function TendersSummary() {
  const summaryQ = useTenderPipelineSummary();
  const summary = summaryQ.data ?? [];
  const totalTenders = summary.reduce((sum, s) => sum + s.count, 0);
  const wonCount = summary.find((s) => s.stage === "won")?.count ?? 0;
  const lostCount = summary.find((s) => s.stage === "lost")?.count ?? 0;
  const winRate = wonCount + lostCount > 0 ? wonCount / (wonCount + lostCount) : null;
  const openValue = summary
    .filter((s) => s.stage === "identified" || s.stage === "applying" || s.stage === "submitted")
    .reduce((sum, s) => sum + s.total_value, 0);

  // Counts every tender that reached each stage, not just those sitting in it now.
  const funnelData = FUNNEL_STAGES.map((s) => ({
    stage: TENDER_STAGE_LABELS[s],
    value: summary.find((r) => r.stage === s)?.cumulative_count ?? 0,
    color: FUNNEL_COLORS[s],
  }));

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="tender-summary-heading">
      <h3 id="tender-summary-heading" className="mb-2 text-sm font-semibold">
        Tenders by stage
      </h3>
      {summaryQ.isError ? (
        <LoadError what="tenders" error={summaryQ.error} onRetry={() => summaryQ.refetch()} />
      ) : summaryQ.isLoading ? (
        <Spinner />
      ) : totalTenders === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No tenders yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0 overflow-hidden lg:col-span-2">
            <FunnelChart stages={funnelData} formatValue={(v) => v.toLocaleString()} />
          </div>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-muted-foreground">Value of open tenders</dt>
              <dd className="text-xl font-semibold tabular-nums">{formatCurrency(openValue)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Win rate</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {winRate != null ? `${(winRate * 100).toFixed(0)}%` : "—"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}

function RecentTenders() {
  const tendersQ = useTenders();
  const rows = (tendersQ.data ?? []).slice(0, 5);

  return (
    <section className="rounded-lg border bg-card p-3" aria-labelledby="tender-recent-heading">
      <h3 id="tender-recent-heading" className="mb-2 text-sm font-semibold">
        Latest tenders
      </h3>
      {tendersQ.isError ? (
        <LoadError what="tenders" error={tendersQ.error} onRetry={() => tendersQ.refetch()} />
      ) : tendersQ.isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">No tenders yet.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((t) => (
            <li key={t.id}>
              <Link
                to="/tender/$tenderId"
                params={{ tenderId: t.id }}
                className="flex items-center gap-2 rounded px-1 py-2 hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.department_name}
                    {(t.client_name ?? t.prospect_client_name) &&
                      ` · ${t.client_name ?? t.prospect_client_name}`}
                  </div>
                </div>
                <Badge className={TENDER_STAGE_STYLES[t.stage]} variant="secondary">
                  {TENDER_STAGE_LABELS[t.stage]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
