import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { LoadError } from "@/components/load-error";
import {
  useProjects,
  useTasks,
  SYSTEM_DEVELOPMENT_METHODOLOGY,
  SDLC_STAGE_LABELS,
  type SdlcStage,
} from "@/features/projects/use-projects";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import {
  useItSystems,
  IT_SYSTEM_STATUS_LABELS,
  type ItSystemStatus,
} from "@/features/it/use-it-systems";
import { DepartmentReportsPanel } from "@/features/reports/department-reports-panel";
import { ReportHeader } from "@/features/reports/report-header";

export const Route = createFileRoute("/_authenticated/reports/departments/it")({
  head: () => ({ meta: [{ title: "IT report — AIMS" }] }),
  component: ItReport,
});

const PROJECT_ACTIVE = new Set(["planning", "active"]);

// Exported so the IT department hub can embed this same report as a "Reports" tab.
export function ItReport() {
  return (
    <RequireRole roles={["it"]} message="The IT report is for the IT team and the CEO.">
      <div className="space-y-4">
        <ReportHeader
          title="IT report"
          description="IT projects and tasks, system development work in progress, and the systems and sites IT looks after."
          actions={
            <Link to="/it" className="text-xs text-primary hover:underline">
              Open IT
            </Link>
          }
        />
        <DepartmentReportsPanel departmentCode="it" />
        <ProjectsSummary />
        <SystemsSummary />
      </div>
    </RequireRole>
  );
}

function ProjectsSummary() {
  const departmentsQ = useDepartments();
  const itDept = departmentsQ.data?.find((d) => d.code === "it");
  const departmentId = itDept?.id;

  const projectsQ = useProjects({ departmentId });
  const tasksQ = useTasks({ departmentId });

  const loading = departmentsQ.isLoading || projectsQ.isLoading || tasksQ.isLoading;
  const failed = departmentsQ.isError || projectsQ.isError || tasksQ.isError;

  const stats = useMemo(() => {
    const projects = projectsQ.data ?? [];
    const tasks = tasksQ.data ?? [];
    const active = projects.filter((p) => PROJECT_ACTIVE.has(p.status));
    const openTasks = tasks.filter((t) => t.status !== "completed");
    const sdlcProjects = projects.filter((p) => p.methodology === SYSTEM_DEVELOPMENT_METHODOLOGY);
    return { activeCount: active.length, openTaskCount: openTasks.length, sdlcProjects };
  }, [projectsQ.data, tasksQ.data]);

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="it-projects-heading">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id="it-projects-heading" className="text-sm font-semibold">
          Projects
        </h3>
        <Link to="/projects" className="text-xs text-primary hover:underline">
          Open Projects
        </Link>
      </div>
      {failed ? (
        <LoadError
          what="IT projects"
          error={departmentsQ.error ?? projectsQ.error ?? tasksQ.error}
          onRetry={() => {
            if (departmentsQ.isError) void departmentsQ.refetch();
            if (projectsQ.isError) void projectsQ.refetch();
            if (tasksQ.isError) void tasksQ.refetch();
          }}
        />
      ) : loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Active projects</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{stats.activeCount}</div>
            </div>
            <div className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">Open tasks</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{stats.openTaskCount}</div>
            </div>
          </div>

          <h4 className="mb-2 border-t pt-2 text-sm font-semibold">System development</h4>
          {stats.sdlcProjects.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">
              No projects are tracked as system development work.
            </p>
          ) : (
            <ul className="divide-y">
              {stats.sdlcProjects.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: p.id }}
                    className="-mx-1 flex items-center justify-between gap-2 rounded px-1 py-2 text-sm hover:bg-secondary/40"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.sdlc_stage ? SDLC_STAGE_LABELS[p.sdlc_stage as SdlcStage] : "No stage set"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function SystemsSummary() {
  const systemsQ = useItSystems();
  const systems = systemsQ.data ?? [];

  const byStatus = useMemo(() => {
    const map = new Map<ItSystemStatus, number>();
    for (const s of systems) map.set(s.status, (map.get(s.status) ?? 0) + 1);
    return map;
  }, [systems]);
  const max = Math.max(...Array.from(byStatus.values()), 1);

  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="it-systems-heading">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 id="it-systems-heading" className="text-sm font-semibold">
          Systems &amp; Sites
        </h3>
        <Link to="/it/systems-sites" className="text-xs text-primary hover:underline">
          Open Systems &amp; Sites
        </Link>
      </div>
      {systemsQ.isError ? (
        <LoadError
          what="systems and sites"
          error={systemsQ.error}
          onRetry={() => systemsQ.refetch()}
        />
      ) : systemsQ.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : systems.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No systems or sites added yet.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {(Object.keys(IT_SYSTEM_STATUS_LABELS) as ItSystemStatus[]).map((status) => {
            const count = byStatus.get(status) ?? 0;
            return (
              <div key={status}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{IT_SYSTEM_STATUS_LABELS[status]}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${(count / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
