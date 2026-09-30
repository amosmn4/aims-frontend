import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
} from "@/features/projects/use-projects";
import { EditProjectDialog, useDeleteProjectAction } from "@/features/projects/edit-project-dialog";
import { useHereHref } from "@/features/projects/project-back-link";
import { usePermissions } from "@/lib/permissions";
import { RowActions } from "@/components/row-actions";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  planning: "bg-secondary text-secondary-foreground",
  active: "bg-primary/10 text-primary",
  on_hold: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

/** Project cards with Open, Edit and Delete for people who manage the project's department. */
export function ProjectCardGrid({
  projects,
  showDepartment = false,
}: {
  projects: Project[];
  showDepartment?: boolean;
}) {
  const perms = usePermissions();
  const deleteProject = useDeleteProjectAction();
  const here = useHereHref();
  const [editing, setEditing] = useState<Project | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const canManage = perms.canManageProject(p);
          return (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: p.id }}
                  search={{ from: here }}
                  className="text-sm font-semibold hover:text-primary hover:underline"
                >
                  {p.name}
                </Link>
                <Badge className={STATUS_STYLES[p.status]} variant="secondary">
                  {PROJECT_STATUS_LABELS[p.status]}
                </Badge>
              </div>
              {showDepartment && (
                <div className="text-xs text-muted-foreground">{p.department_name}</div>
              )}
              <div className="text-xs text-muted-foreground">
                {[p.client_name ? `Client: ${p.client_name}` : null, p.service_line_name]
                  .filter(Boolean)
                  .join(" · ") || "No client"}
              </div>
              <div className="mt-auto flex items-center justify-between border-t pt-2 text-xs">
                <span className="text-muted-foreground">
                  {p.task_count ?? 0} {p.task_count === 1 ? "task" : "tasks"}
                </span>
                <div className="flex items-center gap-1">
                  {canManage && (
                    <RowActions
                      label={p.name}
                      onEdit={() => setEditing(p)}
                      onDelete={() => deleteProject(p)}
                    />
                  )}
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: p.id }}
                    search={{ from: here }}
                    className="inline-flex items-center gap-1 px-1 text-primary"
                    aria-label={`Open project ${p.name}`}
                  >
                    Open project <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {editing && <EditProjectDialog project={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
