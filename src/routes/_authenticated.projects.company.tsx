import { useState } from "react";
import { Input } from "@/components/ui/input";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  useProjects,
  projectProgress,
  PROJECT_STATUS_LABELS,
} from "@/features/projects/use-projects";
import { PROJECT_STATUS_TONE } from "@/features/hr/hr-project-table";
import { NewCompanyProjectDialog } from "@/features/company-projects/new-company-project-dialog";
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

function CompanyProjectsPage() {
  const { isAdminOrCeo } = useAuth();
  const { canCreateCompanyProject } = usePermissions();
  const projectsQ = useProjects({ scope: "company" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("open");
  const allProjects = projectsQ.data ?? [];
  const projects = allProjects.filter(
    (p) =>
      (status === "all" ||
        (status === "open"
          ? !["completed", "cancelled"].includes(p.status)
          : p.status === status)) &&
      `${p.name} ${p.description ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Company projects"
        description={
          isAdminOrCeo
            ? "Shared work across departments, reported by each team."
            : "Shared projects with equal access for everyone on the team."
        }
        actions={canCreateCompanyProject ? <NewCompanyProjectDialog size="sm" /> : undefined}
      />

      {allProjects.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects"
            aria-label="Search company projects"
            className="w-full sm:max-w-xs"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Project status"
            className="h-9 rounded-md border bg-card px-3 text-sm"
          >
            <option value="open">Open projects</option>
            <option value="all">All projects</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <span className="text-xs text-muted-foreground">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
        </div>
      )}

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
            {allProjects.length ? "No matching projects" : "No company projects yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {allProjects.length
              ? "Try a different search or status."
              : "Create a project and add your team."}
          </p>
          {canCreateCompanyProject && allProjects.length === 0 && (
            <div className="mt-4 flex justify-center">
              <NewCompanyProjectDialog />
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const pct = projectProgress(p);
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
                  <span>
                    {p.members.length} {p.members.length === 1 ? "team member" : "team members"}
                  </span>
                  <span className="ml-auto text-primary">Open project</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
