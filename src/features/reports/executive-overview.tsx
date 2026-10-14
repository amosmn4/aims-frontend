import { ExecutiveOverviewCharts, type ExecutiveCharts } from "./executive-overview-charts";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import type { DepartmentCode } from "@/lib/auth";

interface Overview {
  generatedAt: string;
  charts: ExecutiveCharts;
  period: { start: string; end: string; dueDate: string };
  totals: {
    openProjects: number;
    completedInPeriod: number;
    overdueTasks: number;
    atRisk: number;
    lateProjects: number;
    waitingOnCeo: number;
    closingBids: number;
  };
  departments: {
    id: string;
    code: DepartmentCode;
    name: string;
    openProjects: number;
    atRisk: number;
    lateProjects: number;
    report: { id: string; status: string } | null;
  }[];
  reviews: { id: string; title: string; submittedAt: string | null; path: string }[];
  risks: {
    id: string;
    name: string;
    health: string;
    endDate: string | null;
    late: boolean;
    blockedTasks: number;
    scope: string;
    department: { name: string } | null;
  }[];
  updates: {
    id: string;
    projectId: string;
    summary: string;
    occurredAt: string;
    project: { name: string; department: { name: string } | null };
    creator: { fullName: string | null } | null;
  }[];
}

const REPORT_LABELS: Record<string, string> = {
  not_sent: "Not sent",
  submitted: "Awaiting your review",
  approved: "Approved",
  changes_requested: "Changes requested",
  shared: "Shared",
};

export function ExecutiveOverview() {
  const query = useQuery({
    queryKey: ["executive-overview"],
    queryFn: () => apiJson<Overview>("/executive-overview"),
    staleTime: 30_000,
  });
  const data = query.data;
  const reportMonth = data
    ? new Date(data.period.start).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "last month";
  const reportLate =
    !!data && new Date() > new Date(`${data.period.dueDate.slice(0, 10)}T23:59:59+03:00`);
  return (
    <div className="space-y-5">
      <PageHeader
        title="CEO dashboard"
        description="Company delivery, department progress and decisions awaiting you."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/reports">Review reports</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard" search={{ view: "revenue" }}>
                Financial analytics
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard" search={{ view: "projects" }}>
                Project analytics
              </Link>
            </Button>
          </div>
        }
      />
      {query.isError ? (
        <LoadError what="the CEO overview" error={query.error} onRetry={() => query.refetch()} />
      ) : !data ? (
        <p role="status" className="py-8 text-center text-sm text-muted-foreground">
          Loading the company overview...
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Waiting on your decision",
                value: data.totals.waitingOnCeo,
                to: "/reports",
                hint: "Team, department and financial reports",
              },
              {
                label: "Open projects",
                value: data.totals.openProjects,
                to: "/projects",
                hint: "Department and company work",
              },
              {
                label: `Completed in ${reportMonth}`,
                value: data.totals.completedInPeriod,
                to: "/projects",
                hint: "Projects with a recorded completion date",
              },
              {
                label: "Overdue tasks",
                value: data.totals.overdueTasks,
                to: "/projects/department",
                hint: `${data.totals.atRisk} projects at risk, ${data.totals.lateProjects} late`,
              },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="rounded-lg border bg-card p-4 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
              </Link>
            ))}
          </div>
          <ExecutiveOverviewCharts charts={data.charts} reportMonth={reportMonth} />
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border bg-card p-4" aria-labelledby="ceo-decisions">
              <div className="flex items-center justify-between gap-2">
                <h2 id="ceo-decisions" className="font-semibold">
                  Reports awaiting your decision
                </h2>
                <Link to="/reports" className="text-sm text-primary hover:underline">
                  Open inbox
                </Link>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Oldest submissions first.</p>
              {data.reviews.length === 0 ? (
                <p className="py-5 text-sm text-muted-foreground">No reports are waiting on you.</p>
              ) : (
                <ul className="mt-3 divide-y">
                  {data.reviews.map((r) => (
                    <li key={r.path}>
                      <Link
                        to={r.path}
                        className="flex items-center justify-between gap-3 py-3 text-sm hover:text-primary"
                      >
                        <span className="min-w-0 break-words">
                          {r.title}
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Sent {formatDate(r.submittedAt)}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium text-primary">Review</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-lg border bg-card p-4" aria-labelledby="ceo-risks">
              <div className="flex items-center justify-between gap-2">
                <h2 id="ceo-risks" className="font-semibold">
                  Delivery needs attention
                </h2>
                <Link to="/projects" className="text-sm text-primary hover:underline">
                  All projects
                </Link>
              </div>
              {data.risks.length === 0 ? (
                <p className="py-5 text-sm text-muted-foreground">
                  No projects are marked at risk, late or blocked.
                </p>
              ) : (
                <ul className="mt-3 divide-y">
                  {data.risks.map((p) => (
                    <li key={p.id}>
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: p.id }}
                        className="block py-3 hover:text-primary"
                      >
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {p.department?.name ?? "Company project"}
                        </p>
                        <p className="mt-1 text-xs text-warning">
                          {[
                            p.health === "red"
                              ? "Off track"
                              : p.health === "amber"
                                ? "At risk"
                                : null,
                            p.late ? `Finish was ${formatDate(p.endDate)}` : null,
                            p.blockedTasks
                              ? `${p.blockedTasks} blocked task${p.blockedTasks === 1 ? "" : "s"}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <details className="rounded-lg border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Department reports and delivery details
            </summary>
            <section className="mt-4" aria-labelledby="ceo-departments">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="ceo-departments" className="font-semibold">
                  Department progress and reporting
                </h2>
                <Link to="/departments" className="text-sm text-primary hover:underline">
                  Open departments
                </Link>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Monthly work reports for {reportMonth}, due {formatDate(data.period.dueDate)}.
                Financial snapshots and personal reports are tracked separately.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.departments.map((d) => {
                  const missing = !d.report || d.report.status === "not_sent";
                  return (
                    <Link
                      key={d.id}
                      to={`/reports/departments/${d.code}`}
                      className="rounded-md border p-3 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="text-sm font-semibold">{d.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {d.openProjects} open projects · {d.atRisk} at risk · {d.lateProjects} late
                      </p>
                      <p
                        className={`mt-2 text-xs font-medium ${missing || d.report?.status === "changes_requested" ? "text-warning" : "text-primary"}`}
                      >
                        {missing
                          ? reportLate
                            ? "Monthly report overdue"
                            : "Monthly report not sent yet"
                          : (REPORT_LABELS[d.report!.status] ?? d.report!.status)}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          </details>
          <section className="rounded-lg border bg-card p-4" aria-labelledby="ceo-updates">
            <h2 id="ceo-updates" className="font-semibold">
              Recent work from the teams
            </h2>
            {data.updates.length === 0 ? (
              <p className="py-5 text-sm text-muted-foreground">
                No project work updates have been recorded yet.
              </p>
            ) : (
              <ul className="mt-3 divide-y">
                {data.updates.map((a) => (
                  <li key={a.id}>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: a.projectId }}
                      search={{ view: "discussions" }}
                      className="block py-3 hover:bg-secondary/30"
                    >
                      <p className="text-sm font-medium">{a.project.name}</p>
                      <p className="mt-1 whitespace-pre-line break-words text-sm">{a.summary}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.project.department?.name ?? "Company project"} ·{" "}
                        {a.creator?.fullName ?? "Team member"} · {formatDate(a.occurredAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-xs text-muted-foreground">
            Updated{" "}
            {new Date(data.generatedAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            .{" "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              {query.isFetching ? "Refreshing..." : "Refresh overview"}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
