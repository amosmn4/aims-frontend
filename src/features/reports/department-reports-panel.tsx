import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/load-error";
import { cn } from "@/lib/utils";
import { DepartmentReportForm } from "./department-report-form";
import {
  REPORT_STATUS_LABEL,
  formatPeriod,
  useDepartmentReports,
  type ReportStatus,
} from "./use-department-reports";

export const STATUS_TONE: Record<ReportStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  submitted: "bg-primary/10 text-primary",
  changes_requested: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
};

export function ReportStatusPill({ status }: { status: ReportStatus }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_TONE[status],
      )}
    >
      {REPORT_STATUS_LABEL[status]}
    </span>
  );
}

/** A department's own reports to the CEO: prepare, track and reply. */
export function DepartmentReportsPanel({ departmentCode }: { departmentCode: string }) {
  const { isCeo } = useAuth();
  const { canSubmitReports } = usePermissions();
  const departmentsQ = useDepartments();
  const department = departmentsQ.data?.find((d) => d.code === departmentCode);
  const reportsQ = useDepartmentReports(department?.id ?? "");
  const [creating, setCreating] = useState(false);
  const canPrepare = !isCeo && canSubmitReports(departmentCode);
  const reports = reportsQ.data ?? [];
  const needsAction = reports.filter((r) => r.status === "changes_requested").length;

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="dept-reports-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 id="dept-reports-heading" className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-primary" aria-hidden="true" /> Reports to the CEO
          </h3>
          <p className="text-xs text-muted-foreground">
            {needsAction > 0
              ? `${needsAction} report${needsAction > 1 ? "s need" : " needs"} changes — open ${needsAction > 1 ? "them" : "it"} to see the CEO's note.`
              : "Prepare your report, send it to the CEO and keep the conversation in one place."}
          </p>
          {!isCeo && !canPrepare && (
            <p className="text-xs text-muted-foreground">
              You can read these reports, but your role can't send them. Ask the CEO if you need to.
            </p>
          )}
        </div>
        {canPrepare && department && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-4 w-4" /> New report for the CEO
          </Button>
        )}
      </div>

      {departmentsQ.isError || reportsQ.isError ? (
        <LoadError
          what="this department's reports"
          error={departmentsQ.error ?? reportsQ.error}
          onRetry={() => {
            if (departmentsQ.isError) void departmentsQ.refetch();
            if (reportsQ.isError) void reportsQ.refetch();
          }}
          className="m-4"
        />
      ) : reportsQ.isLoading || departmentsQ.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : reports.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium">No reports yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            {canPrepare
              ? "Start your first report. AIMS fills in the figures from your department's work — you add a short summary and send it."
              : "Reports this department sends to the CEO will appear here."}
          </p>
          {canPrepare && department && (
            <Button size="sm" className="mt-3" onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-4 w-4" /> New report for the CEO
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Report</th>
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-4 py-2 font-medium">Latest message</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-t hover:bg-secondary/30">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/department-reports/$reportId"
                      params={{ reportId: r.id }}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {r.title}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      by {r.creator.fullName || r.creator.email}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    {formatPeriod(r.periodStart, r.periodEnd)}
                  </td>
                  <td className="max-w-xs px-4 py-2.5 text-xs text-muted-foreground">
                    {r.lastMessage ? (
                      <span className="line-clamp-2">
                        <b className="font-medium text-foreground">
                          {r.lastMessage.author.fullName || "AIMS"}:
                        </b>{" "}
                        {r.lastMessage.body}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <ReportStatusPill status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && department && (
        <DepartmentReportForm department={department} onClose={() => setCreating(false)} />
      )}
    </section>
  );
}
