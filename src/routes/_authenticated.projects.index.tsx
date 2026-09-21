import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import {
  useProjects,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/features/projects/use-projects";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { ProjectCardGrid } from "@/features/projects/project-card-grid";
import {
  DepartmentProjectTabs,
  type DepartmentProjectFilters,
} from "@/features/projects/department-project-tabs";
import { useAuth } from "@/lib/auth";
import { matchesQuery } from "@/components/pipeline/board-search";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;

const searchSchema = z.object({
  dept: z.string().optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  q: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/projects/")({
  validateSearch: searchSchema,
  component: ProjectsIndex,
});

function ProjectsIndex() {
  const { isCeo } = useAuth();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const setFilters = (patch: DepartmentProjectFilters) =>
    navigate({
      search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch }),
      replace: true,
    });
  return isCeo ? (
    <DepartmentProjectTabs filters={filters} onFiltersChange={setFilters} />
  ) : (
    <AllProjects filters={filters} onFiltersChange={setFilters} />
  );
}

function AllProjects({
  filters,
  onFiltersChange,
}: {
  filters: DepartmentProjectFilters;
  onFiltersChange: (patch: DepartmentProjectFilters) => void;
}) {
  const departmentFilter = filters.dept ?? "all";
  const statusFilter = filters.status ?? "all";
  const query = filters.q ?? "";

  const departmentsQ = useDepartments();
  const projectsQ = useProjects({
    departmentId: departmentFilter === "all" ? undefined : departmentFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const loaded = projectsQ.data ?? [];
  const visible = loaded.filter((p) =>
    matchesQuery(query, p.name, p.client_name, p.department_name, p.service_line_name),
  );
  const filtered = departmentFilter !== "all" || statusFilter !== "all" || !!query.trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <Label htmlFor="projects-search" className="text-xs">
              Search
            </Label>
            <Input
              id="projects-search"
              value={query}
              onChange={(e) => onFiltersChange({ q: e.target.value || undefined })}
              placeholder="Project, client or service line"
            />
          </div>
          <div className="w-full sm:w-52">
            <Label htmlFor="projects-department" className="text-xs">
              Department
            </Label>
            <Select
              value={departmentFilter}
              onValueChange={(v) => onFiltersChange({ dept: v === "all" ? undefined : v })}
            >
              <SelectTrigger id="projects-department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {(departmentsQ.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-44">
            <Label htmlFor="projects-status" className="text-xs">
              Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                onFiltersChange({ status: v === "all" ? undefined : (v as ProjectStatus) })
              }
            >
              <SelectTrigger id="projects-status">
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
          </div>
          <Link
            to="/pipeline/projects"
            className="pb-2 text-xs font-medium text-primary hover:underline"
          >
            Board view
          </Link>
        </div>
        <NewProjectDialog />
      </div>

      {projectsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : projectsQ.isError ? (
        <LoadError what="projects" error={projectsQ.error} onRetry={() => projectsQ.refetch()} />
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          {filtered ? (
            <>
              <p>No matches</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onFiltersChange({ dept: undefined, status: undefined, q: undefined })
                }
              >
                Clear filters
              </Button>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">No projects yet</p>
              <NewProjectDialog />
            </>
          )}
        </div>
      ) : (
        <ProjectCardGrid projects={visible} showDepartment />
      )}
    </div>
  );
}
