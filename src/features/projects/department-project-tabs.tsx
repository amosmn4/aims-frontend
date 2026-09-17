import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import {
  useProjects,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
} from "@/features/projects/use-projects";
import { PROJECT_STATUS_TONE, EngagementBadge } from "@/features/hr/hr-project-table";
import { EditProjectDialog, useDeleteProjectAction } from "@/features/projects/edit-project-dialog";
import { useHereHref } from "@/features/projects/project-back-link";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { matchesQuery } from "@/components/pipeline/board-search";
import { RowActions } from "@/components/row-actions";
import { LoadError } from "@/components/load-error";
import { usePermissions } from "@/lib/permissions";
import { formatDate } from "@/lib/format-date";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DepartmentProjectFilters = {
  dept?: string;
  status?: ProjectStatus;
  q?: string;
};

/** Every project, one tab per department, as a simple list. */
export function DepartmentProjectTabs({
  filters,
  onFiltersChange,
}: {
  filters: DepartmentProjectFilters;
  onFiltersChange: (patch: DepartmentProjectFilters) => void;
}) {
  const departmentsQ = useDepartments();
  const projectsQ = useProjects();
  const perms = usePermissions();
  const deleteProject = useDeleteProjectAction();
  const here = useHereHref();
  const [editing, setEditing] = useState<Project | null>(null);

  const tab = filters.dept ?? "all";
  const status = filters.status ?? "all";
  const query = filters.q ?? "";

  const departments = departmentsQ.data ?? [];
  const projects = projectsQ.data ?? [];
  const countFor = (id: string) => projects.filter((p) => p.department_id === id).length;
  const inTab = projects.filter((p) => tab === "all" || p.department_id === tab);
  const rows = inTab.filter(
    (p) =>
      (status === "all" || p.status === status) &&
      matchesQuery(query, p.name, p.client_name, p.service_line_name, p.department_name),
  );

  const tabs = [
    { id: "all", name: "All departments", count: projects.length },
    ...departments.map((d) => ({ id: d.id, name: d.name, count: countFor(d.id) })),
  ];

  return (
    <div className="space-y-3">
      <div className="border-b flex gap-1 overflow-x-auto" role="tablist" aria-label="Department">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onFiltersChange({ dept: t.id === "all" ? undefined : t.id })}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.name}
            <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-xs text-muted-foreground">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search
            className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => onFiltersChange({ q: e.target.value || undefined })}
            placeholder="Search project, client or service line"
            aria-label="Search projects"
            className="pl-7"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) =>
            onFiltersChange({ status: v === "all" ? undefined : (v as ProjectStatus) })
          }
        >
          <SelectTrigger className="w-40" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(PROJECT_STATUS_LABELS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link to="/pipeline/projects" className="text-xs font-medium text-primary hover:underline">
          Board view
        </Link>
        <div className="ml-auto">
          <NewProjectDialog />
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        {projectsQ.isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : projectsQ.isError ? (
          <LoadError
            what="projects"
            error={projectsQ.error}
            onRetry={() => projectsQ.refetch()}
            className="m-4"
          />
        ) : rows.length === 0 ? (
          inTab.length > 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
              <p>No matches</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onFiltersChange({ q: undefined, status: undefined })}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No projects here yet.
            </div>
          )
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Project</th>
                {tab === "all" && <th className="px-4 py-2.5 font-medium">Department</th>}
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Service line</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Dates</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="w-20">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: p.id }}
                      search={{ from: here }}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  {tab === "all" && (
                    <td className="px-4 py-2.5 text-muted-foreground">{p.department_name}</td>
                  )}
                  <td className="px-4 py-2.5">{p.client_name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {p.service_line_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <EngagementBadge type={p.engagement_type} />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(p.start_date)} → {formatDate(p.end_date)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        PROJECT_STATUS_TONE[p.status],
                      )}
                    >
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    {perms.canManageProject(p) && (
                      <RowActions
                        label={p.name}
                        onEdit={() => setEditing(p)}
                        onDelete={() => deleteProject(p)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <EditProjectDialog project={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
