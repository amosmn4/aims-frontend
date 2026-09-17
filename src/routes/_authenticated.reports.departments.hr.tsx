import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import * as XLSX from "xlsx";
import { Download, Loader2 } from "lucide-react";
import { RequireDepartmentAccess } from "@/components/require-role";
import { useTenders } from "@/features/tender/use-tender";
import { useClientRequests } from "@/features/client-requests/use-client-requests";
import { useHrDepartment, useHrWork, isOpenProject } from "@/features/hr/use-hr";
import { useRecruitmentEngagements, FUNNEL_STAGE_LABELS } from "@/features/hr/use-recruitment";
import { FUNNEL_STAGES } from "@/features/hr/recruitment-funnel-panel";
import { formatCurrency } from "@/features/finance/finance";
import { Button } from "@/components/ui/button";
import { DepartmentReportsPanel } from "@/features/reports/department-reports-panel";
import { ReportHeader } from "@/features/reports/report-header";
import { LoadError } from "@/components/load-error";

export const Route = createFileRoute("/_authenticated/reports/departments/hr")({
  head: () => ({ meta: [{ title: "HR Report — AIMS" }] }),
  component: HrReport,
});

const TENDER_TERMINAL = new Set(["won", "lost", "withdrawn", "cancelled"]);
const REQUEST_TERMINAL = new Set(["won", "lost", "withdrawn"]);

// Exported so the HR hub can show the same report under /hr/reports.
export function HrReport() {
  return (
    <RequireDepartmentAccess
      code="hr"
      message="The HR report is for the HR team, people granted HR access and the CEO."
    >
      <HrReportContent />
    </RequireDepartmentAccess>
  );
}

function HrReportContent() {
  const { department, lines, missing } = useHrDepartment();
  const { projects, tasks, isLoading, isError, error, retry } = useHrWork(department?.id);
  const tendersQ = useTenders({ departmentId: department?.id });
  const requestsQ = useClientRequests({ departmentId: department?.id });
  const recruitmentQ = useRecruitmentEngagements();

  const rows = useMemo(() => {
    const doneByProject = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      const s = doneByProject.get(t.project_id) ?? { total: 0, done: 0 };
      s.total += 1;
      if (t.status === "completed") s.done += 1;
      doneByProject.set(t.project_id, s);
    }
    const build = (name: string, list: typeof projects) => {
      const taskTotals = list.reduce(
        (acc, p) => {
          const s = doneByProject.get(p.id);
          return { total: acc.total + (s?.total ?? 0), done: acc.done + (s?.done ?? 0) };
        },
        { total: 0, done: 0 },
      );
      return {
        name,
        open: list.filter(isOpenProject).length,
        finished: list.filter((p) => !isOpenProject(p)).length,
        recurring: list.filter((p) => p.engagement_type === "ongoing").length,
        oneOff: list.filter((p) => p.engagement_type === "one_off").length,
        clients: new Set(list.map((p) => p.client_id).filter(Boolean)).size,
        tasksDonePct: taskTotals.total
          ? Math.round((taskTotals.done / taskTotals.total) * 100)
          : null,
        contractValue: list.reduce(
          (s, p) => s + (p.contract_status === "active" ? (p.contract_value ?? 0) : 0),
          0,
        ),
      };
    };
    const byLine = lines.map((l) =>
      build(
        l.name,
        projects.filter((p) => p.service_line_id === l.id),
      ),
    );
    const unassigned = projects.filter((p) => !p.service_line_id);
    if (unassigned.length) byLine.push(build("No service line", unassigned));
    return { byLine, total: build("All HR projects", projects) };
  }, [projects, tasks, lines]);

  const pipeline = useMemo(() => {
    const tenders = (tendersQ.data ?? []).filter((t) => !TENDER_TERMINAL.has(t.stage));
    const requests = (requestsQ.data ?? []).filter((r) => !REQUEST_TERMINAL.has(r.stage));
    return {
      tenders: tenders.length,
      requests: requests.length,
      value:
        tenders.reduce((s, t) => s + (t.estimated_value ?? 0), 0) +
        requests.reduce((s, r) => s + (r.estimated_value ?? 0), 0),
    };
  }, [tendersQ.data, requestsQ.data]);

  const funnelTotals = FUNNEL_STAGES.map((k) => ({
    stage: FUNNEL_STAGE_LABELS[k],
    count: (recruitmentQ.data ?? []).reduce((s, e) => s + (e.funnel?.[k] ?? 0), 0),
  }));

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const sheetRows = [...rows.byLine, rows.total].map((r) => ({
      "Service line": r.name,
      Open: r.open,
      Finished: r.finished,
      Recurring: r.recurring,
      "One-off": r.oneOff,
      Clients: r.clients,
      "Tasks done %": r.tasksDonePct ?? "",
      "Active contract value": r.contractValue,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), "Service lines");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        projects.map((p) => ({
          Project: p.name,
          Client: p.client_name ?? "",
          "Service line": p.service_line_name ?? "",
          Type: p.engagement_type === "ongoing" ? "Recurring" : "One-off",
          Status: p.status,
          Contract: p.contract_number ?? "",
          "Start date": p.start_date ?? "",
          "End date": p.end_date ?? "",
        })),
      ),
      "Projects",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(funnelTotals.map((f) => ({ Stage: f.stage, Candidates: f.count }))),
      "Recruitment",
    );
    XLSX.writeFile(wb, `hr-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title="HR report"
        description="Projects by service line, recurring versus one-off work, and recruitment results."
        actions={
          <>
            <Link to="/hr" className="text-xs text-primary hover:underline">
              Open HR
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={exportExcel}
              disabled={isLoading || isError}
            >
              <Download className="mr-1.5 h-4 w-4" /> Export HR report to Excel
            </Button>
          </>
        }
      />
      <DepartmentReportsPanel departmentCode="hr" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Open projects", rows.total.open],
          ["Recurring projects", rows.total.recurring],
          ["One-off projects", rows.total.oneOff],
          ["Active contract value", formatCurrency(rows.total.contractValue)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <h3 className="border-b px-4 py-3 text-sm font-semibold">By service line</h3>
        {missing ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            There's no HR department set up yet, so there's nothing to report.
          </p>
        ) : isError ? (
          <LoadError what="HR projects" error={error} onRetry={retry} className="m-4" />
        ) : isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-2.5 font-medium">Service line</th>
                  <th className="px-3 py-2.5 text-right font-medium">Open</th>
                  <th className="px-3 py-2.5 text-right font-medium">Finished</th>
                  <th className="px-3 py-2.5 text-right font-medium">Recurring</th>
                  <th className="px-3 py-2.5 text-right font-medium">One-off</th>
                  <th className="px-3 py-2.5 text-right font-medium">Clients</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tasks done</th>
                  <th className="px-4 py-2.5 text-right font-medium">Active contract value</th>
                </tr>
              </thead>
              <tbody>
                {[...rows.byLine, rows.total].map((r, i, all) => (
                  <tr
                    key={r.name}
                    className={i === all.length - 1 ? "bg-secondary/40 font-semibold" : "border-b"}
                  >
                    <td className="px-4 py-2.5">{r.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.open}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.finished}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.recurring}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.oneOff}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.clients}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.tasksDonePct != null ? `${r.tasksDonePct}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatCurrency(r.contractValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recruitment results</h3>
            <Link to="/hr/recruitment" className="text-xs text-primary hover:underline">
              By project
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {funnelTotals.map((f) => (
              <div key={f.stage} className="rounded-md border p-3 text-center">
                <div className="text-xs text-muted-foreground">{f.stage}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{f.count}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Incoming work</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Open client requests</dt>
              <dd className="tabular-nums">{pipeline.requests}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Open tenders for HR</dt>
              <dd className="tabular-nums">{pipeline.tenders}</dd>
            </div>
            <div className="flex justify-between border-t pt-2">
              <dt className="text-muted-foreground">Estimated value</dt>
              <dd className="tabular-nums">{formatCurrency(pipeline.value)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
