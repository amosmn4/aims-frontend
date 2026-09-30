import { useMemo } from "react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useServiceLines } from "@/features/finance/use-finance-data";
import {
  isTaskOverdue,
  useProjects,
  useTasks,
  type Project,
  type ProjectStatus,
  type Task,
} from "@/features/projects/use-projects";

export const OPEN_PROJECT_STATUSES: ProjectStatus[] = ["planning", "active", "on_hold"];
export const isOpenProject = (p: Pick<Project, "status">) =>
  OPEN_PROJECT_STATUSES.includes(p.status);

/** The HR department record and its active service lines, in display order. */
export function useHrDepartment() {
  const departmentsQ = useDepartments();
  const serviceLinesQ = useServiceLines();
  const department = departmentsQ.data?.find((d) => d.code === "hr");
  const lines = useMemo(
    () =>
      (serviceLinesQ.data ?? [])
        .filter((l) => department && l.department_id === department.id && l.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [serviceLinesQ.data, department],
  );
  return {
    department,
    lines,
    isLoading: departmentsQ.isLoading || serviceLinesQ.isLoading,
    missing: departmentsQ.isSuccess && !department,
    loadFailed: departmentsQ.isError,
    error: departmentsQ.error,
    retry: () => departmentsQ.refetch(),
  };
}

export interface ProjectTaskStats {
  total: number;
  done: number;
  overdue: number;
}

/** HR projects plus per-project task stats, loaded once for dashboard-style pages. */
export function useHrWork(departmentId: string | undefined) {
  const projectsQ = useProjects({ departmentId, enabled: !!departmentId });
  const tasksQ = useTasks({ departmentId, enabled: !!departmentId });
  const tasks = useMemo(
    () => (departmentId ? (tasksQ.data ?? []) : []),
    [tasksQ.data, departmentId],
  );
  const statsByProject = useMemo(() => {
    const map = new Map<string, ProjectTaskStats>();
    for (const t of tasks) {
      const s = map.get(t.project_id) ?? { total: 0, done: 0, overdue: 0 };
      s.total += 1;
      if (t.status === "completed") s.done += 1;
      if (isTaskOverdue(t)) s.overdue += 1;
      map.set(t.project_id, s);
    }
    return map;
  }, [tasks]);
  return {
    projects: projectsQ.data ?? [],
    tasks: tasks as Task[],
    statsByProject,
    isLoading: !departmentId || projectsQ.isLoading || tasksQ.isLoading,
    isError: projectsQ.isError || tasksQ.isError,
    error: projectsQ.error ?? tasksQ.error,
    retry: () => {
      if (projectsQ.isError) projectsQ.refetch();
      if (tasksQ.isError) tasksQ.refetch();
    },
  };
}
