import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { LoadError } from "@/components/load-error";
import { cn } from "@/lib/utils";
import { ReportHeader } from "@/features/reports/report-header";
import { ReportStatusPill } from "@/features/reports/department-reports-panel";
import { formatFigure, formatReportPeriod, personName } from "@/features/reports/report-format";
import { actionNeeded, dayOf, headlineFigure } from "@/features/reports/report-rows";
import { useReports, type ReportRow } from "@/features/reports/use-reports";

export const Route = createFileRoute("/_authenticated/reports/team")({
  head: () => ({ meta: [{ title: "Team reports — AIMS" }] }),
  component: TeamReports,
});

type Tab = "waiting" | "not_sent" | "done" | "projects";

const TABS: { id: Tab; label: string }[] = [
  { id: "waiting", label: "Waiting on you" },
  { id: "not_sent", label: "Not sent yet" },
  { id: "done", label: "Done" },
  { id: "projects", label: "Projects" },
];

const EMPTY: Record<Tab, string> = {
  waiting: "Nothing is waiting on you — you have read everything your team sent.",
  not_sent: "Everyone who started a report has sent it.",
  done: "You haven't approved any reports yet.",
  projects: "No project reports yet. Your team can start one from Project reports.",
};

const byNewest = (a: ReportRow, b: ReportRow) => b.updatedAt.localeCompare(a.updatedAt);

/** The head's page: their people's reports, and their department's project reports. */
function TeamReports() {
  const { hasRole, isAdminOrCeo, loading, profile } = useAuth();
  const allowed = isAdminOrCeo || hasRole("department_head");
  const departmentId = profile?.departmentId ?? undefined;
  const [tab, setTab] = useState<Tab>("waiting");

  const peopleQ = useReports({ kind: "individual", departmentId }, allowed);
  const projectsQ = useReports({ kind: "project", departmentId }, allowed);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-sm font-semibold">This page is for department heads</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your own report is on{" "}
          <Link to="/reports/mine" className="text-primary hover:underline">
            My report
          </Link>
          .
        </p>
      </section>
    );
  }

  const people = [...(peopleQ.data ?? [])].sort(byNewest);
  const projects = [...(projectsQ.data ?? [])].sort(byNewest);
  const rowsFor = (id: Tab) => {
    if (id === "projects") return projects;
    if (id === "waiting") return people.filter((r) => r.status === "submitted");
    if (id === "done") return people.filter((r) => r.status === "approved");
    return people.filter((r) => r.status === "draft" || r.status === "changes_requested");
  };
  const rows = rowsFor(tab);
  const failed = peopleQ.isError || projectsQ.isError;
  const loadingRows = peopleQ.isLoading || projectsQ.isLoading;

  return (
    <div className="space-y-4">
      <ReportHeader
        title="Team reports"
        description="What your people said about their month, and the projects your department is running."
      />

      <section className="rounded-lg border bg-card" aria-labelledby="team-reports-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 pt-3">
          <h2
            id="team-reports-heading"
            className="flex items-center gap-2 pb-2 text-sm font-semibold"
          >
            <Users className="h-4 w-4 text-primary" aria-hidden="true" /> Your team
          </h2>
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter reports">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-xs text-muted-foreground">
                  {rowsFor(t.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {failed ? (
          <LoadError
            what="your team's reports"
            error={peopleQ.error ?? projectsQ.error}
            onRetry={() => {
              if (peopleQ.isError) void peopleQ.refetch();
              if (projectsQ.isError) void projectsQ.refetch();
            }}
            className="m-4"
          />
        ) : loadingRows ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{EMPTY[tab]}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <TeamReportRow key={r.id} report={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TeamReportRow({ report }: { report: ReportRow }) {
  const who =
    report.kind === "project" ? report.title : personName(report.subjectUser ?? report.creator);
  const figure = headlineFigure(report);
  const needed = actionNeeded(report);

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-48 flex-1">
        <p className="text-sm font-medium">{who}</p>
        <p className="text-xs text-muted-foreground">
          <When report={report} />
          {figure && ` · ${formatFigure(figure)} ${figure.label.toLowerCase()}`}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-foreground">
          {needed ? needed : <span className="text-muted-foreground">Nothing flagged</span>}
        </p>
      </div>
      <ReportStatusPill status={report.status} />
      <Link
        to="/reports/$reportId"
        params={{ reportId: report.id }}
        className="text-xs font-medium text-primary hover:underline"
      >
        {report.status === "submitted" ? "Read it" : "Open"}
      </Link>
    </li>
  );
}

/** Says where this report has got to, in the words of what happened to it. */
function When({ report }: { report: ReportRow }) {
  const period = formatReportPeriod(report.periodStart, report.periodEnd);
  if (report.status === "submitted") {
    return <>{`${period} · sent ${dayOf(report.submittedAt)}`}</>;
  }
  if (report.status === "changes_requested") {
    return <>{`${period} · you sent it back on ${dayOf(report.reviewedAt)}`}</>;
  }
  if (report.status === "approved") {
    return <>{`${period} · approved ${dayOf(report.reviewedAt)}`}</>;
  }
  return <>{`${period} · started, not sent yet`}</>;
}
