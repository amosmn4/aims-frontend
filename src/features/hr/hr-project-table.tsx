import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { RowActions } from "@/components/row-actions";
import { usePermissions } from "@/lib/permissions";
import { EditProjectDialog, useDeleteProjectAction } from "@/features/projects/edit-project-dialog";
import { useHereHref } from "@/features/projects/project-back-link";
import { formatDate } from "@/lib/format-date";
import { AlertTriangle, Repeat, Target } from "lucide-react";
import {
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
} from "@/features/projects/use-projects";
import type { ProjectTaskStats } from "@/features/hr/use-hr";
import { cn } from "@/lib/utils";

export const PROJECT_STATUS_TONE: Record<ProjectStatus, string> = {
  planning: "bg-secondary text-secondary-foreground",
  active: "bg-primary/10 text-primary",
  on_hold: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  cancelled: "bg-muted text-muted-foreground",
};

export function EngagementBadge({ type }: { type: Project["engagement_type"] }) {
  return type === "ongoing" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[0.6875rem] font-medium text-accent">
      <Repeat className="h-3 w-3" /> Recurring
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-medium text-secondary-foreground">
      <Target className="h-3 w-3" /> One-off
    </span>
  );
}

export function TaskProgress({ stats }: { stats: ProjectTaskStats | undefined }) {
  if (!stats || stats.total === 0) {
    return <span className="text-xs text-muted-foreground">No tasks</span>;
  }
  const pct = Math.round((stats.done / stats.total) * 100);
  return (
    <div className="min-w-24">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          {stats.done}/{stats.total}
        </span>
        {stats.overdue > 0 && (
          <span className="inline-flex items-center gap-0.5 font-semibold text-destructive">
            <AlertTriangle className="h-3 w-3" /> {stats.overdue} late
          </span>
        )}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function whenLabel(p: Project) {
  if (p.engagement_type === "ongoing")
    return p.contract_end_date ? `Contract ends ${formatDate(p.contract_end_date)}` : "Ongoing";
  return p.end_date ? `Ends ${formatDate(p.end_date)}` : "No end date";
}

/** Project list that works as a table on desktop and stacked cards on phones. */
export function HrProjectTable({
  projects,
  statsByProject,
  compact = false,
}: {
  projects: Project[];
  statsByProject: Map<string, ProjectTaskStats>;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const perms = usePermissions();
  const deleteProject = useDeleteProjectAction();
  const [editing, setEditing] = useState<Project | null>(null);
  const here = useHereHref();
  const open = (id: string) =>
    navigate({ to: "/projects/$projectId", params: { projectId: id }, search: { from: here } });
  const showActions = !compact && projects.some((p) => perms.canManageProject(p));

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-2.5 font-medium">Project</th>
              <th className="px-4 py-2.5 font-medium">Service line</th>
              {!compact && <th className="px-4 py-2.5 font-medium">Type</th>}
              {!compact && <th className="px-4 py-2.5 font-medium">Contract</th>}
              <th className="px-4 py-2.5 font-medium">Tasks</th>
              <th className="px-4 py-2.5 font-medium">When</th>
              {!compact && <th className="px-4 py-2.5 font-medium">Status</th>}
              {showActions && (
                <th className="w-20">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr
                key={p.id}
                onClick={() => open(p.id)}
                className="cursor-pointer border-b last:border-0 hover:bg-secondary/40"
              >
                <td className="px-4 py-3">
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: p.id }}
                    search={{ from: here }}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {p.name}
                  </Link>
                  <div
                    className={cn(
                      "text-xs",
                      p.client_name ? "text-muted-foreground" : "text-warning",
                    )}
                  >
                    {p.client_name ?? "No client"}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.service_line_name ?? "—"}</td>
                {!compact && (
                  <td className="px-4 py-3">
                    <EngagementBadge type={p.engagement_type} />
                  </td>
                )}
                {!compact && (
                  <td className="px-4 py-3 text-xs">
                    {p.contract_number ?? <span className="text-muted-foreground">None</span>}
                  </td>
                )}
                <td className="px-4 py-3">
                  <TaskProgress stats={statsByProject.get(p.id)} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{whenLabel(p)}</td>
                {!compact && (
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[0.6875rem]",
                        PROJECT_STATUS_TONE[p.status],
                      )}
                    >
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </td>
                )}
                {showActions && (
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    {perms.canManageProject(p) && (
                      <RowActions
                        label={p.name}
                        onEdit={() => setEditing(p)}
                        onDelete={() => deleteProject(p)}
                      />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y md:hidden">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              search={{ from: here }}
              className="block px-4 py-3 hover:bg-secondary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[p.client_name ?? "No client", p.service_line_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <EngagementBadge type={p.engagement_type} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <TaskProgress stats={statsByProject.get(p.id)} />
                <span className="text-xs text-muted-foreground">{whenLabel(p)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {editing && <EditProjectDialog project={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
