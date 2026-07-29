import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { RequireRole } from "@/components/require-role";
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

export const Route = createFileRoute("/_authenticated/reports/departments/it")({
  head: () => ({ meta: [{ title: "IT Report — AIMS" }] }),
  component: ItReport,
});

const PROJECT_ACTIVE = new Set(["planning", "active"]);

// Exported so the IT department hub can embed this same report as a "Reports" tab.
export function ItReport() {
  return (
    <RequireRole
      roles={["it"]}
      message="The IT report is restricted to the IT team, CEO and System Administrator."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Information Technology</div>
            <div className="text-xs text-muted-foreground">
              Project delivery, the Systems &amp; Sites registry, and system-development work in
              flight.
            </div>
          </div>
          <Link to="/it" className="text-xs text-primary hover:underline">
            Open IT workspace
          </Link>
        </div>
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

  const stats = useMemo(() => {
    const projects = projectsQ.data ?? [];
    const tasks = tasksQ.data ?? [];
    const active = projects.filter((p) => PROJECT_ACTIVE.has(p.status));
    const openTasks = tasks.filter((t) => t.status !== "completed");
    const sdlcProjects = projects.filter((p) => p.methodology === SYSTEM_DEVELOPMENT_METHODOLOGY);
    return { activeCount: active.length, openTaskCount: openTasks.length, sdlcProjects };
  }, [projectsQ.data, tasksQ.data]);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm font-semibold mb-3">Projects</div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-md border p-3 text-center">
          <div className="text-xs text-muted-foreground">Active projects</div>
          <div className="text-xl font-semibold tabular-nums mt-1">{stats.activeCount}</div>
        </div>
        <div className="rounded-md border p-3 text-center">
          <div className="text-xs text-muted-foreground">Open tasks</div>
          <div className="text-xl font-semibold tabular-nums mt-1">{stats.openTaskCount}</div>
        </div>
      </div>

      <div className="text-sm font-semibold mb-2 pt-2 border-t">System Development</div>
      {stats.sdlcProjects.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          No projects are currently tracked as system-development work.
        </div>
      ) : (
        <div className="divide-y">
          {stats.sdlcProjects.map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="flex items-center justify-between py-2 text-sm hover:bg-secondary/40 -mx-1 px-1 rounded"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">
                {p.sdlc_stage ? SDLC_STAGE_LABELS[p.sdlc_stage as SdlcStage] : "—"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
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

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold">Systems &amp; Sites</div>
        <Link to="/it/systems-sites" className="text-xs text-primary hover:underline">
          Open registry
        </Link>
      </div>
      {systemsQ.isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : systems.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          Nothing registered yet.
        </div>
      ) : (
        <div className="space-y-2 mt-3">
          {(Object.keys(IT_SYSTEM_STATUS_LABELS) as ItSystemStatus[]).map((status) => {
            const count = byStatus.get(status) ?? 0;
            const max = Math.max(...Array.from(byStatus.values()), 1);
            const pct = (count / max) * 100;
            return (
              <div key={status}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{IT_SYSTEM_STATUS_LABELS[status]}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
