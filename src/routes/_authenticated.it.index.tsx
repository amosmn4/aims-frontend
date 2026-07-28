import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Briefcase, ListChecks, Server, ShieldAlert } from "lucide-react";
import { useProjects, useTasks, PROJECT_STATUS_LABELS } from "@/features/projects/use-projects";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useItSystems, IT_SYSTEM_STATUS_LABELS, type ItSystemStatus } from "@/features/it/use-it-systems";

export const Route = createFileRoute("/_authenticated/it/")({
  head: () => ({ meta: [{ title: "IT Overview — AIMS" }] }),
  component: ItOverview,
});

const PROJECT_ACTIVE = new Set(["planning", "active"]);

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ItOverview() {
  const departmentsQ = useDepartments();
  const itDept = departmentsQ.data?.find((d) => d.code === "it");
  const departmentId = itDept?.id;

  const projectsQ = useProjects({ departmentId });
  const tasksQ = useTasks({ departmentId });
  const systemsQ = useItSystems();

  const loading = departmentsQ.isLoading || projectsQ.isLoading || tasksQ.isLoading || systemsQ.isLoading;

  const stats = useMemo(() => {
    const projects = projectsQ.data ?? [];
    const tasks = tasksQ.data ?? [];
    const systems = systemsQ.data ?? [];

    const activeProjects = projects.filter((p) => PROJECT_ACTIVE.has(p.status));
    const openTasks = tasks.filter((t) => t.status !== "completed");
    const deprecated = systems.filter((s) => s.status === "deprecated");

    const byStatus = new Map<ItSystemStatus, number>();
    for (const s of systems) byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);

    const recent = [...projects].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);

    return {
      activeProjects: activeProjects.length,
      openTasks: openTasks.length,
      systemsCount: systems.length,
      deprecatedCount: deprecated.length,
      byStatus,
      recent,
    };
  }, [projectsQ.data, tasksQ.data, systemsQ.data]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Projects" value={String(stats.activeProjects)} hint="Website & systems work" icon={Briefcase} />
        <StatCard label="Open Tasks" value={String(stats.openTasks)} hint="Across active projects" icon={ListChecks} />
        <StatCard label="Systems & Sites" value={String(stats.systemsCount)} hint="Registered" icon={Server} />
        <StatCard label="Deprecated" value={String(stats.deprecatedCount)} hint="Flagged for retirement" icon={ShieldAlert} />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">Systems & Sites by status</h2>
        {stats.systemsCount === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nothing registered yet. <Link to="/it/systems-sites" className="text-primary hover:underline">Add one →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {(Object.keys(IT_SYSTEM_STATUS_LABELS) as ItSystemStatus[]).map((status) => {
              const count = stats.byStatus.get(status) ?? 0;
              const max = Math.max(...Array.from(stats.byStatus.values()), 1);
              const pct = (count / max) * 100;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{IT_SYSTEM_STATUS_LABELS[status]}</span>
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">Recent projects</h2>
        {stats.recent.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Nothing logged for IT yet.</div>
        ) : (
          <div className="divide-y">
            {stats.recent.map((p) => (
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                className="flex items-center justify-between py-2.5 text-sm hover:bg-secondary/40 -mx-2 px-2 rounded"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{PROJECT_STATUS_LABELS[p.status]}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
