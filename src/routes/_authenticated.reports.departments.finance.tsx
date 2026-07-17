import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireRole } from "@/components/require-role";
import { FinancialManagementDashboard } from "@/features/finance/financial-management-dashboard";
import { useFinanceReports } from "@/features/finance/use-finance-reports";
import {
  REPORT_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/features/finance/finance-report-snapshot";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/departments/finance")({
  head: () => ({ meta: [{ title: "Finance Report — AIMS" }] }),
  component: FinanceReport,
});

function FinanceReport() {
  return (
    <RequireRole
      roles={["finance"]}
      message="The Financial Management report is restricted to the Finance team, CEO and System Administrator."
    >
      <div className="space-y-4">
        <div>
          <div className="text-base font-semibold">Financial Management</div>
          <div className="text-xs text-muted-foreground">
            Detailed finance dashboard · receivables, payables, ratios, P&L.
          </div>
        </div>
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
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> Reports submitted by Finance
        </div>
        <Link to="/finance/reports" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">No submitted reports yet.</div>
      ) : (
        <div className="divide-y">
          {rows.map((r) => (
            <Link
              key={r.id}
              to="/finance/reports/$id"
              params={{ id: r.id }}
              className="flex items-center gap-2 py-2 hover:bg-secondary/50 rounded px-1"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.title}</div>
                <div className="text-[0.6875rem] text-muted-foreground">
                  {REPORT_TYPE_LABELS[r.report_type]} · {r.period_start} → {r.period_end}
                </div>
              </div>
              <span className={`text-[0.625rem] px-1.5 py-0.5 rounded ${STATUS_STYLES[r.status]}`}>
                {STATUS_LABELS[r.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
