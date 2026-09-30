import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/load-error";
import { cn } from "@/lib/utils";
import {
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
  formatReportPeriod,
  personName,
  reviewerLabel,
} from "./report-format";
import { dayOf, monthOf, samePeriod, startFailure } from "./report-rows";
import {
  useReports,
  useReportsDue,
  useStartReport,
  type ReportRow,
  type ReportStatus,
} from "./use-reports";

export function ReportStatusPill({ status }: { status: ReportStatus }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        REPORT_STATUS_TONE[status],
      )}
    >
      {REPORT_STATUS_LABEL[status]}
    </span>
  );
}

const linkClass = "text-xs font-medium text-primary hover:underline";

/** A department's own reports to the CEO: start one, track it and reply. */
export function DepartmentReportsPanel({ departmentCode }: { departmentCode: string }) {
  const navigate = useNavigate();
  const { isCeo, user } = useAuth();
  const { canSubmitReports } = usePermissions();
  const departmentsQ = useDepartments();
  const department = departmentsQ.data?.find((d) => d.code === departmentCode);
  const reportsQ = useReports({ kind: "department", departmentId: department?.id }, !!department);
  const dueQ = useReportsDue();
  const startReport = useStartReport();

  const canPrepare = !isCeo && canSubmitReports(departmentCode);
  const reports = [...(reportsQ.data ?? [])].sort((a, b) =>
    b.periodStart.localeCompare(a.periodStart),
  );
  const period = dueQ.data?.period;
  const current = period ? reports.find((r) => samePeriod(r.periodStart, period.start)) : undefined;
  const sentBack = reports.filter((r) => r.status === "changes_requested");

  const startThisPeriod = async () => {
    if (!department || !period) return;
    try {
      const created = await startReport.mutateAsync({
        kind: "department",
        subjectId: department.id,
        periodStart: period.start,
        periodEnd: period.end,
      });
      navigate({ to: "/reports/$reportId", params: { reportId: created.id } });
    } catch (error) {
      toast.error(startFailure(error));
    }
  };

  const rowAction = (r: ReportRow) => {
    if (r.status === "draft" && r.creator.id !== user?.id) {
      return (
        <span className="text-xs text-muted-foreground">
          {personName(r.creator)} is preparing{" "}
          {samePeriod(r.periodStart, period?.start) ? "this month's report" : "this report"}
        </span>
      );
    }
    const label =
      r.status === "changes_requested"
        ? "Fix and resend"
        : r.status === "draft"
          ? "Open your draft"
          : "Read it";
    return (
      <Link to="/reports/$reportId" params={{ reportId: r.id }} className={linkClass}>
        {label}
      </Link>
    );
  };

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="dept-reports-heading">
      <div className="border-b px-4 py-3">
        <h3 id="dept-reports-heading" className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
          {department ? `${department.name} reports to the CEO` : "Reports to the CEO"}
        </h3>
        <p className="text-xs text-muted-foreground">
          One report a month for the whole department. Anyone here can write it; only one of you
          sends it.
        </p>
        {!isCeo && !canPrepare && (
          <p className="text-xs text-muted-foreground">
            You can read these reports, but your role can't send them. Ask the CEO if you need to.
          </p>
        )}
      </div>

      {sentBack.map((r) => (
        <div
          key={r.id}
          className="mx-4 mt-4 rounded-md border border-warning/30 bg-warning/10 p-3"
          role="status"
        >
          <p className="flex items-center gap-2 text-xs font-semibold text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {monthOf(r.periodStart)} was sent back
            {r.reviewedAt ? ` on ${dayOf(r.reviewedAt)}` : ""}
          </p>
          {r.lastReviewNote && (
            <p className="mt-1 text-xs leading-relaxed text-foreground">
              {reviewerLabel(r.reviewerKind, r.department?.name)} asked for changes: “
              {r.lastReviewNote}”
            </p>
          )}
          <Link
            to="/reports/$reportId"
            params={{ reportId: r.id }}
            className={cn(linkClass, "mt-1 inline-block")}
          >
            Fix and resend
          </Link>
        </div>
      ))}

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
      ) : reports.length === 0 && !period ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium">No reports yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Reports this department sends to the CEO will appear here.
          </p>
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
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {!current && period && (
                <tr className="border-t bg-secondary/20">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">Nobody has started this one</span>
                    <span className="block text-xs text-muted-foreground">
                      {canPrepare
                        ? "AIMS has the figures ready — it takes about five minutes."
                        : "Waiting for someone in the department who can send it."}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    {period.label}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">—</td>
                  <td className="px-4 py-2.5">
                    <ReportStatusPill status="draft" />
                  </td>
                  <td className="px-4 py-2.5">
                    {canPrepare && (
                      <Button
                        size="sm"
                        onClick={() => void startThisPeriod()}
                        disabled={startReport.isPending || !department}
                      >
                        Start {monthOf(period.start)} report
                      </Button>
                    )}
                  </td>
                </tr>
              )}
              {reports.map((r) => (
                <tr key={r.id} className="border-t hover:bg-secondary/30">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/reports/$reportId"
                      params={{ reportId: r.id }}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {r.title}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      by {personName(r.creator)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    {formatReportPeriod(r.periodStart, r.periodEnd)}
                  </td>
                  <td className="max-w-xs px-4 py-2.5 text-xs text-muted-foreground">
                    {r.lastMessage ? (
                      <span className="line-clamp-2">
                        <b className="font-medium text-foreground">
                          {personName(r.lastMessage.author, "AIMS")}:
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
                  <td className="whitespace-nowrap px-4 py-2.5">{rowAction(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
