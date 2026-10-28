import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useDepartments, useEligibleDepartments } from "@/features/clients/use-clients-contracts";
import {
  isTaskOverdue,
  useTasks,
  useUpdateTask,
  type TaskStatus,
} from "@/features/projects/use-projects";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/kanban-board";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { TaskDetailDialog } from "@/features/projects/task-detail-dialog";
import { NewTaskDialog } from "./_authenticated.projects.$projectId";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/projects/department")({
  component: DepartmentBoard,
});

function DepartmentBoard() {
  const { profile } = useAuth();
  const eligibleDepartmentsQ = useEligibleDepartments();
  const [departmentId, setDepartmentId] = useState(profile?.departmentId ?? "");

  // Default to the viewer's own department once their profile loads.
  useEffect(() => {
    if (!departmentId && profile?.departmentId) setDepartmentId(profile.departmentId);
  }, [departmentId, profile?.departmentId]);

  return (
    <div className="space-y-4">
      <div className="w-full sm:w-56">
        <Label htmlFor="board-department" className="text-xs">
          Department
        </Label>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger id="board-department">
            <SelectValue placeholder="Choose a department" />
          </SelectTrigger>
          <SelectContent>
            {(eligibleDepartmentsQ.data ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {eligibleDepartmentsQ.isError ? (
        <LoadError
          what="departments"
          error={eligibleDepartmentsQ.error}
          onRetry={() => eligibleDepartmentsQ.refetch()}
        />
      ) : departmentId ? (
        <DepartmentTaskBoard departmentId={departmentId} showHeader={false} />
      ) : (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          Choose a department to see its tasks.
        </div>
      )}
    </div>
  );
}

// Shared "Tasks" board for every department hub, with the department fixed.
export function DepartmentTaskBoard({
  departmentId,
  overdueOnly = false,
  onShowAllTasks,
  showHeader = true,
}: {
  departmentId: string;
  /** Only overdue tasks across the whole department, e.g. from a dashboard link. */
  overdueOnly?: boolean;
  onShowAllTasks?: () => void;
  /** Off when the host page already has its own title. */
  showHeader?: boolean;
}) {
  const { profile, canWriteDepartment } = useAuth();
  const departmentsQ = useDepartments();
  const department = departmentsQ.data?.find((d) => d.id === departmentId);
  const canManage = !!department && canWriteDepartment(department.code);
  const [scope, setScope] = useState<"department" | "mine" | null>(null);
  const tasksQ = useTasks({ departmentId });
  const all = tasksQ.data ?? [];
  const mine = all.filter((t) => t.assignee_id === profile?.id);
  // Your own tasks first, when you have any.
  const effectiveScope = scope ?? (mine.length > 0 ? "mine" : "department");
  const tasks = overdueOnly
    ? all.filter((t) => isTaskOverdue(t))
    : effectiveScope === "mine"
      ? mine
      : all;
  const updateTask = useUpdateTask();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = all.find((t) => t.id === selectedTaskId) ?? null;
  const deptName = department?.name ?? "this department";

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    const task = all.find((t) => t.id === taskId);
    if (!canManage && task?.assignee_id !== profile?.id) {
      toast.error(`Only ${deptName} staff or the person assigned can move this task.`);
      return;
    }
    updateTask.mutate(
      { id: taskId, status },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
    );
  };

  const newTask = canManage ? <NewTaskDialog departmentId={departmentId} /> : null;

  return (
    <>
      {showHeader && (
        <PageHeader
          title="Tasks"
          description={`Every task on ${deptName} projects. Open a task to update it or change its status.`}
          actions={newTask}
        />
      )}
      {department && !canManage && (
        <ViewOnlyBanner
          area={`${department.name} tasks`}
          action="add tasks or change ones not assigned to you"
          className="mb-3"
        />
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {overdueOnly ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">
              Overdue tasks across the whole department ({tasks.length})
            </span>
            {onShowAllTasks && (
              <Button size="sm" variant="outline" onClick={onShowAllTasks}>
                Show all tasks
              </Button>
            )}
          </div>
        ) : (
          <div
            className="inline-flex rounded-md border bg-card p-0.5 text-xs"
            role="radiogroup"
            aria-label="Whose tasks"
          >
            {(["mine", "department"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={effectiveScope === s}
                onClick={() => setScope(s)}
                className={cn(
                  "px-3 py-1.5 rounded-[5px] font-medium",
                  effectiveScope === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "department" ? `Whole department (${all.length})` : `Mine (${mine.length})`}
              </button>
            ))}
          </div>
        )}
        {!showHeader && newTask}
      </div>
      {tasksQ.isError ? (
        <LoadError what="tasks" error={tasksQ.error} onRetry={() => tasksQ.refetch()} />
      ) : !tasksQ.isLoading && tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          {overdueOnly ? (
            <>
              <p className="font-medium text-foreground">Nothing is overdue</p>
              {onShowAllTasks && (
                <Button size="sm" variant="outline" onClick={onShowAllTasks}>
                  Show all tasks
                </Button>
              )}
            </>
          ) : effectiveScope === "mine" && all.length > 0 ? (
            <>
              <p className="font-medium text-foreground">No tasks assigned to you</p>
              <Button size="sm" variant="outline" onClick={() => setScope("department")}>
                Show whole department
              </Button>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">No tasks yet</p>
              {newTask}
            </>
          )}
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            Use “Move to” on a card, drag it to another column, or open the task.
          </p>
          <KanbanBoard
            tasks={tasks}
            loading={tasksQ.isLoading}
            showProject
            onStatusChange={handleStatusChange}
            onTaskClick={(t) => setSelectedTaskId(t.id)}
          />
        </>
      )}
      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
        canManageDocuments={canManage}
      />
    </>
  );
}
