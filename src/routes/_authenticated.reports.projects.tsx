import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { FolderKanban, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/load-error";
import {
  useProjects,
  PROJECT_HEALTH_LABELS,
  PROJECT_STATUS_LABELS,
  type Project,
} from "@/features/projects/use-projects";
import { ReportHeader } from "@/features/reports/report-header";
import { ReportStatusPill } from "@/features/reports/department-reports-panel";
import { formatReportPeriod, personName } from "@/features/reports/report-format";
import { latestBySubject, monthOf, samePeriod, startFailure } from "@/features/reports/report-rows";
import {
  useReports,
  useReportsDue,
  useStartReport,
  type ReportRow,
  type ReportTemplate,
} from "@/features/reports/use-reports";

export const Route = createFileRoute("/_authenticated/reports/projects")({
  head: () => ({ meta: [{ title: "Project reports — AIMS" }] }),
  component: ProjectReports,
});

/** A completion report covers the whole life of the project, not one month. */
function lifeOfProject(p: Project) {
  const periodStart = p.start_date ?? p.created_at;
  const today = new Date().toISOString().slice(0, 10);
  const periodEnd = p.end_date && p.end_date >= periodStart ? p.end_date : today;
  return { periodStart, periodEnd };
}

function ProjectReports() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { canManageProject } = usePermissions();
  const departmentId = profile?.departmentId ?? undefined;
  const projectsQ = useProjects({ departmentId });
  const reportsQ = useReports({ kind: "project", departmentId });
  const dueQ = useReportsDue();
  const startReport = useStartReport();
  const [starting, setStarting] = useState("");

  const projects = (projectsQ.data ?? []).filter((p) => p.status !== "cancelled");
  const latest = latestBySubject(reportsQ.data ?? []);
  const period = dueQ.data?.period;

  const start = async (project: Project, template: ReportTemplate) => {
    setStarting(`${project.id}-${template}`);
    try {
      const dates =
        template === "project_completion"
          ? lifeOfProject(project)
          : { periodStart: period?.start, periodEnd: period?.end };
      const created = await startReport.mutateAsync({
        kind: "project",
        template,
        subjectId: project.id,
        ...dates,
      });
      navigate({ to: "/reports/$reportId", params: { reportId: created.id } });
    } catch (error) {
      toast.error(startFailure(error));
    } finally {
      setStarting("");
    }
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title="Project reports"
        description="A progress report goes to your department head. A completion report closes the project and goes to the CEO."
      />

      <section className="rounded-lg border bg-card" aria-labelledby="project-reports-heading">
        <h2
          id="project-reports-heading"
          className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold"
        >
          <FolderKanban className="h-4 w-4 text-primary" aria-hidden="true" /> Your department's
          projects
        </h2>

        {projectsQ.isError || reportsQ.isError ? (
          <LoadError
            what="project reports"
            error={projectsQ.error ?? reportsQ.error}
            onRetry={() => {
              if (projectsQ.isError) void projectsQ.refetch();
              if (reportsQ.isError) void reportsQ.refetch();
            }}
            className="m-4"
          />
        ) : projectsQ.isLoading || reportsQ.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium">No projects to report on</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Once your department has a project, you can report on how it is going here.
            </p>
            <Link
              to="/projects"
              className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
            >
              Open Projects
            </Link>
          </div>
        ) : (
          <ul className="divide-y">
            {projects.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                report={latest.get(p.id) ?? null}
                canStart={canManageProject(p)}
                currentPeriodStart={period?.start}
                startingKey={starting}
                onStart={start}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProjectRow({
  project,
  report,
  canStart,
  currentPeriodStart,
  startingKey,
  onStart,
}: {
  project: Project;
  report: ReportRow | null;
  canStart: boolean;
  currentPeriodStart?: string;
  startingKey: string;
  onStart: (project: Project, template: ReportTemplate) => Promise<void>;
}) {
  const done = project.status === "completed";
  const thisPeriodDone =
    !!report &&
    report.template === "project_progress" &&
    samePeriod(report.periodStart, currentPeriodStart);
  const busy = startingKey.startsWith(project.id);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-56 flex-1">
        <Link
          to="/projects/$projectId"
          params={{ projectId: project.id }}
          className="text-sm font-medium text-foreground hover:text-primary hover:underline"
        >
          {project.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {project.client_name ?? "No client"} · {PROJECT_STATUS_LABELS[project.status]} ·{" "}
          {PROJECT_HEALTH_LABELS[project.health]}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {report ? (
            <>
              <Link
                to="/reports/$reportId"
                params={{ reportId: report.id }}
                className="font-medium text-primary hover:underline"
              >
                {formatReportPeriod(report.periodStart, report.periodEnd)} report
              </Link>
              <ReportStatusPill status={report.status} />
              <span>by {personName(report.creator)}</span>
            </>
          ) : (
            <span>No report on this project yet</span>
          )}
        </p>
      </div>

      {canStart && (
        <div className="flex flex-wrap gap-2">
          {!done &&
            (thisPeriodDone ? (
              <span className="text-xs text-muted-foreground">
                {currentPeriodStart ? `${monthOf(currentPeriodStart)} already started` : "Started"}
              </span>
            ) : (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void onStart(project, "project_progress")}
              >
                Start a progress report
              </Button>
            ))}
          {done &&
            (report?.template === "project_completion" ? (
              <span className="text-xs text-muted-foreground">Completion report written</span>
            ) : (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void onStart(project, "project_completion")}
              >
                Start a completion report
              </Button>
            ))}
        </div>
      )}
    </li>
  );
}
