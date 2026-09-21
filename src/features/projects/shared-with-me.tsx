import { Link } from "@tanstack/react-router";
import { Eye, Loader2, FolderKanban, Pencil } from "lucide-react";
import {
  useProjects,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
} from "@/features/projects/use-projects";
import { useProjectAccess } from "@/features/projects/use-project-sharing";
import { useHereHref } from "@/features/projects/project-back-link";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { Badge } from "@/components/ui/badge";

const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planning: "bg-secondary text-secondary-foreground",
  active: "bg-primary/10 text-primary",
  on_hold: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

// Projects from other departments shared with you, or whose team you were added to.
export function SharedProjectsView() {
  const projectsQ = useProjects({ sharedWithMe: true });
  const projects = projectsQ.data ?? [];
  const here = useHereHref();

  return (
    <div className="space-y-3">
      <PageHeader
        title="Shared with me"
        description="Projects from other departments that someone shared with you or your department."
      />

      {projectsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : projectsQ.isError ? (
        <LoadError
          what="shared projects"
          error={projectsQ.error}
          onRetry={() => projectsQ.refetch()}
        />
      ) : projects.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          <FolderKanban className="mx-auto h-6 w-6 mb-2 opacity-50" aria-hidden="true" />
          <p className="font-medium text-foreground">Nothing shared with you yet</p>
          <p className="mt-1">
            When another department shares a project with you, or adds you to its team, it shows up
            here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => (
            <SharedProjectCard key={p.id} project={p} here={here} />
          ))}
        </div>
      )}
    </div>
  );
}

function SharedProjectCard({ project: p, here }: { project: Project; here: string }) {
  const access = useProjectAccess(p.id, p.department_code);
  const AccessIcon = access.canEdit ? Pencil : Eye;

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: p.id }}
      search={{ from: here }}
      className="rounded-lg border bg-card p-4 flex flex-col gap-2 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm">{p.name}</div>
        <Badge className={PROJECT_STATUS_STYLES[p.status]} variant="secondary">
          {PROJECT_STATUS_LABELS[p.status]}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground">A {p.department_name} project</div>
      {p.client_name && (
        <div className="text-xs text-muted-foreground">Client: {p.client_name}</div>
      )}
      <div className="mt-auto pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          <AccessIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
          {access.label}
        </span>
        <span>
          {p.task_count ?? 0} {p.task_count === 1 ? "task" : "tasks"}
        </span>
      </div>
    </Link>
  );
}
