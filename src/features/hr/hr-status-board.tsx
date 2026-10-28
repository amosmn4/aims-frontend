import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  useUpdateProject,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
} from "@/features/projects/use-projects";
import { useHereHref } from "@/features/projects/project-back-link";
import { EngagementBadge, TaskProgress, whenLabel } from "@/features/hr/hr-project-table";
import type { ProjectTaskStats } from "@/features/hr/use-hr";
import { usePermissions } from "@/lib/permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ColumnKey = "open" | "on_hold" | "finished";

const COLUMNS: { key: ColumnKey; label: string; hint: string; moveTo: ProjectStatus }[] = [
  { key: "open", label: "Open", hint: "Planning or under way", moveTo: "active" },
  { key: "on_hold", label: "On hold", hint: "Paused for now", moveTo: "on_hold" },
  { key: "finished", label: "Finished", hint: "Completed or cancelled", moveTo: "completed" },
];

const columnOf = (s: ProjectStatus): ColumnKey =>
  s === "on_hold" ? "on_hold" : s === "completed" || s === "cancelled" ? "finished" : "open";

/** HR projects grouped by status, with a "Move to" menu on each card. */
export function HrStatusBoard({
  projects,
  statsByProject,
}: {
  projects: Project[];
  statsByProject: Map<string, ProjectTaskStats>;
}) {
  const perms = usePermissions();
  const update = useUpdateProject();
  const here = useHereHref();

  const move = (p: Project, key: ColumnKey) => {
    const target = COLUMNS.find((c) => c.key === key);
    if (!target || columnOf(p.status) === key) return;
    update.mutate(
      { id: p.id, status: target.moveTo },
      {
        onSuccess: () => toast.success(`${p.name} moved to ${target.label}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Move failed"),
      },
    );
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = projects.filter((p) => columnOf(p.status) === col.key);
        return (
          <section
            key={col.key}
            aria-label={`${col.label} projects`}
            className="rounded-lg border bg-secondary/30 p-2"
          >
            <div className="flex items-baseline justify-between px-1.5 pb-2 pt-1">
              <div>
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <p className="text-xs text-muted-foreground">{col.hint}</p>
              </div>
              <span className="rounded-full bg-card px-2 text-xs tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </div>
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                No projects
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((p) => {
                  const canManage = perms.canManageProject(p);
                  const showStatus = p.status === "planning" || p.status === "cancelled";
                  return (
                    <li key={p.id} className="rounded-md border bg-card p-3 text-sm shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: p.id }}
                          search={{ from: here }}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {p.name}
                        </Link>
                        <EngagementBadge type={p.engagement_type} />
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 text-xs",
                          p.client_name ? "text-muted-foreground" : "text-warning",
                        )}
                      >
                        {[p.client_name ?? "No client", p.service_line_name]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <TaskProgress stats={statsByProject.get(p.id)} />
                        <span className="text-xs text-muted-foreground">
                          {showStatus ? PROJECT_STATUS_LABELS[p.status] : whenLabel(p)}
                        </span>
                      </div>
                      {canManage && (
                        <Select
                          value=""
                          onValueChange={(v) => move(p, v as ColumnKey)}
                          disabled={update.isPending}
                        >
                          <SelectTrigger
                            className="mt-2 h-8 text-xs"
                            aria-label={`Move ${p.name} to another status`}
                          >
                            <SelectValue placeholder="Move to…" />
                          </SelectTrigger>
                          <SelectContent>
                            {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                              <SelectItem key={c.key} value={c.key}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
