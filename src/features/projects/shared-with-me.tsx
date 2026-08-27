import { Link } from "@tanstack/react-router";
import { Loader2, FolderKanban } from "lucide-react";
import {
  useProjects,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/features/projects/use-projects";
import { Badge } from "@/components/ui/badge";

const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planning: "bg-secondary text-secondary-foreground",
  active: "bg-primary/10 text-primary",
  on_hold: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

// Google-Drive-style "Shared with me": projects outside your own department that you've been
// added to as a team member — kept visually separate from your department's own project list
// rather than blended into it. Exported so every department's "Projects & Tasks" nav can embed
// this same view, scoped automatically to whoever's logged in (the backend filter is relative to
// the viewer, not a departmentId param).
export function SharedProjectsView() {
  const projectsQ = useProjects({ sharedWithMe: true });
  const projects = projectsQ.data ?? [];

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">Shared with me</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Projects from other departments you've been added to as a team member.
        </p>
      </div>

      {projectsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          <FolderKanban className="mx-auto h-6 w-6 mb-2 opacity-50" />
          Nothing's been shared with you outside your own department yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="rounded-lg border bg-card p-4 flex flex-col gap-2 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-sm">{p.name}</div>
                <Badge className={PROJECT_STATUS_STYLES[p.status]} variant="secondary">
                  {PROJECT_STATUS_LABELS[p.status]}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">{p.department_name}</div>
              {p.client_name && (
                <div className="text-xs text-muted-foreground">Client: {p.client_name}</div>
              )}
              <div className="mt-auto pt-2 border-t text-xs text-muted-foreground">
                {p.task_count ?? 0} tasks
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
