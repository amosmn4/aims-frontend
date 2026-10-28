import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { NewCompanyProjectDialog } from "@/features/company-projects/new-company-project-dialog";
import { ProjectUpdateDialog } from "@/features/projects/project-update-dialog";
import {
  PROJECT_STATUS_LABELS,
  projectProgress,
  useProjects,
} from "@/features/projects/use-projects";
import { useReports, useReportsDue, useStartReport } from "@/features/reports/use-reports";
import { TeamReportDialog } from "@/features/projects/workspace/project-reports";
import { StartHerePanel } from "@/features/start-here/start-here-panel";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { useAuth, type DepartmentCode } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import { MyWorkPanel } from "./my-work-panel";

function DepartmentTeamReportButton({
  department,
}: {
  department: { id: string; code: DepartmentCode };
}) {
  const { canSubmitReports } = usePermissions();
  const due = useReportsDue();
  const reports = useReports({ kind: "department", subjectId: department.id });
  const start = useStartReport();
  const [reportId, setReportId] = useState<string | null>(null);
  const period = due.data?.period;
  const current = reports.data?.find(
    (report) =>
      report.periodStart.slice(0, 10) === period?.start.slice(0, 10) &&
      report.periodEnd.slice(0, 10) === period?.end.slice(0, 10),
  );
  const open = async () => {
    if (current) {
      setReportId(current.id);
      return;
    }
    if (!period) return;
    try {
      const report = await start.mutateAsync({
        kind: "department",
        subjectId: department.id,
        periodStart: period.start,
        periodEnd: period.end,
      });
      setReportId(report.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the team report");
    }
  };
  if (!canSubmitReports(department.code) || reports.isError || due.isError)
    return (
      <Button variant="outline" asChild>
        <Link to={`/reports/departments/${department.code}`}>Open team report</Link>
      </Button>
    );
  return (
    <>
      <Button
        variant="outline"
        onClick={() => void open()}
        disabled={start.isPending || reports.isLoading || !period}
      >
        Open team report
      </Button>
      {reportId && <TeamReportDialog reportId={reportId} onClose={() => setReportId(null)} />}
    </>
  );
}

export function DepartmentWorkPanel({ departmentCode }: { departmentCode: DepartmentCode }) {
  const { hasRole, profile, isAdminOrCeo, canWriteDepartment } = useAuth();
  const { canManageProject, canCreateCompanyProject } = usePermissions();
  const departmentsQ = useDepartments();
  const department = departmentsQ.data?.find((item) => item.code === departmentCode);
  const projectsQ = useProjects({ departmentId: department?.id, enabled: !!department });
  const companyQ = useProjects({ scope: "company" });
  const sharedQ = useProjects({ sharedWithMe: true, enabled: !isAdminOrCeo });
  const canWrite = canWriteDepartment(departmentCode);
  const ownWork =
    !isAdminOrCeo &&
    (hasRole(departmentCode) || canWrite || profile?.departmentId === department?.id);
  const projects = [
    ...(projectsQ.data ?? []),
    ...(sharedQ.data ?? []),
    ...(companyQ.data ?? []).filter((project) =>
      project.members.some((member) => member.user_id === profile?.id),
    ),
  ].filter(
    (project, index, rows) =>
      rows.findIndex((row) => row.id === project.id) === index &&
      project.status !== "completed" &&
      project.status !== "cancelled",
  );
  const writableProjects = projects.filter(canManageProject);
  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card p-4" aria-labelledby="daily-work-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="daily-work-heading" className="text-base font-semibold">
              Your team's projects
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Capture work as you go. Reports use these updates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canWrite && department ? (
              <NewProjectDialog fixedDepartmentId={department.id} />
            ) : (
              canCreateCompanyProject && <NewCompanyProjectDialog />
            )}
            {(canWrite || writableProjects.length > 0) && (
              <ProjectUpdateDialog projects={projects} />
            )}
            {department && (
              <DepartmentTeamReportButton
                department={{ id: department.id, code: departmentCode }}
              />
            )}
          </div>
        </div>
        {departmentsQ.isError || projectsQ.isError || companyQ.isError || sharedQ.isError ? (
          <LoadError
            what="your team's projects"
            error={departmentsQ.error ?? projectsQ.error ?? companyQ.error ?? sharedQ.error}
            onRetry={() => {
              void departmentsQ.refetch();
              void projectsQ.refetch();
              void companyQ.refetch();
              void sharedQ.refetch();
            }}
            className="mt-3"
          />
        ) : departmentsQ.isLoading ||
          projectsQ.isLoading ||
          companyQ.isLoading ||
          sharedQ.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            Loading your projects...
          </p>
        ) : projects.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Start a project for the work you are handling. Add tasks and log short updates as you
            go.
          </p>
        ) : (
          <ul className="mt-3 divide-y">
            {projects.slice(0, 6).map((project) => {
              const progress = projectProgress(project);
              return (
                <li key={project.id}>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="flex items-center justify-between gap-3 rounded py-3 hover:bg-secondary/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{project.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {project.scope === "company"
                          ? "Company team"
                          : (project.client_name ?? "Department work")}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {progress === null
                        ? PROJECT_STATUS_LABELS[project.status]
                        : `${progress}% done`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-primary">
          {department && (
            <Link to="/projects" search={{ dept: department.id }} className="hover:underline">
              All department projects
            </Link>
          )}
          <Link to="/projects/company" className="hover:underline">
            Company projects
          </Link>
        </div>
      </section>
      {ownWork && <MyWorkPanel departmentCode={departmentCode} />}
      {ownWork && <StartHerePanel departmentCode={departmentCode} persistent />}
    </div>
  );
}
