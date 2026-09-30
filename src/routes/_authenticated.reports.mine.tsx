import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/load-error";
import { cn } from "@/lib/utils";
import { formatDate, formatMonth } from "@/lib/format-date";
import {
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
  formatReportPeriod,
} from "@/features/reports/report-format";
import {
  useReports,
  useReportsDue,
  useStartReport,
  type ReportRow,
} from "@/features/reports/use-reports";

export const Route = createFileRoute("/_authenticated/reports/mine")({
  head: () => ({ meta: [{ title: "My reports — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: MyReportsPage,
});

/** "September 2026" becomes "September", which is what a button should say. */
const monthOnly = (label: string) => label.split(" ")[0];

function rowMeta(r: ReportRow) {
  if (r.status === "approved") return `Approved ${formatDate(r.reviewedAt)}`;
  if (r.status === "changes_requested") {
    return r.lastReviewNote ? `Sent back: “${r.lastReviewNote}”` : "Sent back for changes";
  }
  if (r.status === "submitted") return `Sent ${formatDate(r.submittedAt)} · waiting to be read`;
  return "Not sent yet";
}

function MyReportsPage() {
  const navigate = useNavigate();
  const dueQ = useReportsDue();
  const reportsQ = useReports({ kind: "individual", mine: true });
  const start = useStartReport();

  const due = dueQ.data;
  const reports = reportsQ.data ?? [];
  const periodLabel = due?.period.label ?? "";

  const startReport = async () => {
    try {
      const created = await start.mutateAsync({ kind: "individual" });
      navigate({ to: "/reports/$reportId", params: { reportId: created.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start your report");
    }
  };

  const startButton =
    due && !due.own ? (
      <Button size="sm" onClick={startReport} disabled={start.isPending}>
        {start.isPending ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-1 h-4 w-4" />
        )}
        Start {monthOnly(periodLabel)}
      </Button>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">My reports</h2>
          <p className="text-xs text-muted-foreground">
            Your own account of each month: what you finished, what you are carrying, what is in
            your way.
          </p>
        </div>
        {startButton}
      </div>

      {reportsQ.isError && (
        <LoadError what="your reports" error={reportsQ.error} onRetry={() => reportsQ.refetch()} />
      )}

      {reportsQ.isLoading ? (
        <div className="flex justify-center py-10" role="status" aria-label="Loading your reports">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm font-medium">Nothing to report yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your first report will be for {periodLabel || "next month"}. AIMS fills in your figures
            from your own work — you answer the rest.
          </p>
          {startButton && <div className="mt-3 flex justify-center">{startButton}</div>}
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                to="/reports/$reportId"
                params={{ reportId: r.id }}
                className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatMonth(r.periodStart)}
                </span>
                <span className="min-w-[12rem] flex-1">
                  <span className="block text-sm font-medium">{r.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatReportPeriod(r.periodStart, r.periodEnd)} · {rowMeta(r)}
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                    REPORT_STATUS_TONE[r.status],
                  )}
                >
                  {REPORT_STATUS_LABEL[r.status]}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {due && due.own && due.own.status === "draft" && (
        <p className="text-xs text-muted-foreground">
          Your {monthOnly(periodLabel)} report is started but not sent. Open it to finish.
        </p>
      )}
    </div>
  );
}
