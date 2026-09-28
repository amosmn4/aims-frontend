import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useProjects, PROJECT_STATUS_LABELS, type Project } from "@/features/projects/use-projects";
import { PROJECT_STATUS_TONE } from "@/features/hr/hr-project-table";
import { NewCompanyProjectDialog } from "@/features/company-projects/new-company-project-dialog";
import { Initials } from "@/features/projects/workspace/initials";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { usePermissions } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/company")({
  head: () => ({ meta: [{ title: "Company projects — AIMS" }] }),
  component: CompanyProjectsPage,
});

function progress(p: Project) {
  const total = (p.task_count ?? 0) + (p.deliverable_count ?? 0);
  const done = (p.tasks_done ?? 0) + (p.deliverables_done ?? 0);
  return total === 0 ? null : Math.round((done / total) * 100);
}

function CompanyProjectsPage() {
  const { isAdminOrCeo } = useAuth();
  const { canCreateCompanyProject } = usePermissions();
  const projectsQ = useProjects({ scope: "company" });
  const projects = projectsQ.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Company projects"
        description={
          isAdminOrCeo
            ? "Projects that run across departments. Only each project's team and you can see them."
            : "Projects you are on that run across departments."
        }
        actions={canCreateCompanyProject ? <NewCompanyProjectDialog size="sm" /> : undefined}
      />

      {projectsQ.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : projectsQ.isError ? (
        <LoadError
          what="company projects"
          error={projectsQ.error}
          onRetry={() => projectsQ.refetch()}
        />
      ) : projects.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-12 text-center">
          <p className="text-sm font-medium">
            {canCreateCompanyProject
              ? "No company projects yet"
              : "You're not on a company project yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canCreateCompanyProject
              ? "Set one up for work that spans departments, like opening a new country."
              : "When someone adds you to one, it appears here and under Projects in your menu."}
          </p>
          {canCreateCompanyProject && (
            <div className="mt-4 flex justify-center">
              <NewCompanyProjectDialog />
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const pct = progress(p);
            return (
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-snug">{p.name}</h2>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      PROJECT_STATUS_TONE[p.status],
                    )}
                  >
                    {PROJECT_STATUS_LABELS[p.status]}
                  </span>
                </div>
                {p.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                )}
                <div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pct == null ? "Nothing logged yet" : `${pct}% done`}
                    {p.end_date ? ` · ends ${formatDate(p.end_date)}` : ""}
                  </p>
                </div>
                <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {p.lead_name && <Initials name={p.lead_name} />}
                  <span>
                    Lead: {p.lead_name ?? "—"} · {p.members.length}{" "}
                    {p.members.length === 1 ? "person" : "people"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
