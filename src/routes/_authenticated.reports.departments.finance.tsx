import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Loader2 } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { LoadError } from "@/components/load-error";
import { FinancialManagementDashboard } from "@/features/finance/financial-management-dashboard";
import { useFinanceReports } from "@/features/finance/use-finance-reports";
import {
  REPORT_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/features/finance/finance-report-snapshot";
import { ReportHeader } from "@/features/reports/report-header";
import { formatDate } from "@/lib/format-date";

export const Route = createFileRoute("/_authenticated/reports/departments/finance")({
  head: () => ({ meta: [{ title: "Finance report — AIMS" }] }),
  component: FinanceReport,
});

function FinanceReport() {
  return (
    <RequireRole
      roles={["finance"]}
      message="The Finance report is for the Finance team and the CEO."
    >
      <div className="space-y-4">
        <ReportHeader
          title="Finance report"
          description="Who owes us and whom we owe, days to get paid, and profit and loss."
          actions={
            <Link to="/finance/reports" className="text-xs text-primary hover:underline">
              Finance reports to the CEO
            </Link>
          }
        />
        <SubmittedReports />
        <FinancialManagementDashboard />
      </div>
    </RequireRole>
  );
}

function SubmittedReports() {
  const q = useFinanceReports();
  const rows = (q.data ?? []).filter((r) => r.status !== "draft").slice(0, 5);
  return (
    <section className="rounded-lg border bg-card p-3" aria-labelledby="finance-submitted-heading">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3
          id="finance-submitted-heading"
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <FileText className="h-4 w-4" aria-hidden="true" /> Reports sent by Finance
        </h3>
        <Link to="/finance/reports" className="text-xs text-primary hover:underline">
          See all Finance reports
        </Link>
      </div>
      {q.isError ? (
        <LoadError what="Finance reports" error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">Finance hasn't sent any reports yet.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to="/finance/reports/$id"
                params={{ id: r.id }}
                className="flex items-center gap-2 rounded px-1 py-2 hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {REPORT_TYPE_LABELS[r.report_type]} · {formatDate(r.period_start)} to{" "}
                    {formatDate(r.period_end)}
                  </div>
                </div>
                <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLES[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
