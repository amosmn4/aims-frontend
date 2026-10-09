import { Link } from "@tanstack/react-router";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { ProjectUpdateDialog } from "@/features/projects/project-update-dialog";
import { projectProgress, useProjects } from "@/features/projects/use-projects";
import { StartHerePanel } from "@/features/start-here/start-here-panel";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { useAuth, type DepartmentCode } from "@/lib/auth";
import { MyWorkPanel } from "./my-work-panel";

export function DepartmentWorkPanel({ departmentCode }: { departmentCode: DepartmentCode }) {
  const { hasRole, profile, isAdminOrCeo, canWriteDepartment } = useAuth();
  const departmentsQ = useDepartments();
  const department = departmentsQ.data?.find((item) => item.code === departmentCode);
  const projectsQ = useProjects({ departmentId: department?.id, enabled: !!department });
  const canWrite = canWriteDepartment(departmentCode);
  const ownWork =
    !isAdminOrCeo &&
    (hasRole(departmentCode) ||
      canWrite ||
      (!!department && profile?.departmentId === department.id));
  const projects = (projectsQ.data ?? []).filter(
    (project) => project.status !== "completed" && project.status !== "cancelled",
  );

  return (
    <>
      {ownWork && <MyWorkPanel departmentCode={departmentCode} />}
      <section className="rounded-xl border bg-card p-4" aria-labelledby="daily-work-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="daily-work-heading" className="text-base font-semibold">
              Department projects
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Track progress and send a report to the CEO.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canWrite && department && <NewProjectDialog fixedDepartmentId={department.id} />}
            {canWrite && <ProjectUpdateDialog projects={projects} />}
            <Button variant="outline" asChild>
              <Link to={`/reports/departments/${departmentCode}`}>Reports to the CEO</Link>
            </Button>
          </div>
        </div>
        {departmentsQ.isError || projectsQ.isError ? (
          <LoadError
            what="department projects"
            error={departmentsQ.error ?? projectsQ.error}
            onRetry={() => {
              if (departmentsQ.isError) void departmentsQ.refetch();
              if (projectsQ.isError) void projectsQ.refetch();
            }}
            className="mt-3"
          />
        ) : departmentsQ.isLoading || projectsQ.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            Loading your projects...
          </p>
        ) : !department ? (
          <p className="mt-3 text-sm text-muted-foreground">
            This department has not been set up yet. Ask the CEO to add it.
          </p>
        ) : projects.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {canWrite
              ? "Start a project for the work you are handling. You can add tasks and dated updates as you go."
              : "No open projects are visible to you yet."}
          </p>
        ) : (
          <ul className="mt-3 divide-y">
            {projects.slice(0, 5).map((project) => {
              const progress = projectProgress(project);
              return (
                <li key={project.id}>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="flex items-center justify-between gap-3 rounded py-2 hover:bg-secondary/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{project.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {project.client_name ?? "Department work"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {progress === null ? "No tasks or outcomes yet" : `${progress}% done`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-primary">
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
      {ownWork && <StartHerePanel departmentCode={departmentCode} persistent />}
    </>
  );
}
