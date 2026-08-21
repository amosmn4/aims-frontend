import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/lib/auth";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useTasks, useUpdateTask, type TaskStatus } from "@/features/projects/use-projects";
import { KanbanBoard } from "@/components/kanban-board";
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
  const departmentsQ = useDepartments();
  const [departmentId, setDepartmentId] = useState(profile?.departmentId ?? "");

  // Once departments/profile load, default to the user's own department if nothing picked yet.
  useEffect(() => {
    if (!departmentId && profile?.departmentId) setDepartmentId(profile.departmentId);
  }, [departmentId, profile?.departmentId]);

  return (
    <div className="space-y-4">
      <div className="w-56">
        <Label className="text-xs">Department</Label>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger>
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            {(departmentsQ.data ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {departmentId ? (
        <DepartmentTaskBoard departmentId={departmentId} />
      ) : (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          Select a department to see its task board.
        </div>
      )}
    </div>
  );
}

// Exported so every department hub can embed this same task board as a "Tasks" tab, with the
// department id already fixed (no picker) instead of the standalone `/projects/department` page's
// "choose a department" flow above.
export function DepartmentTaskBoard({ departmentId }: { departmentId: string }) {
  const { profile, isAdminOrCeo, hasRole } = useAuth();
  const departmentsQ = useDepartments();
  const departmentCode = departmentsQ.data?.find((d) => d.id === departmentId)?.code;
  const canManage = isAdminOrCeo || (!!departmentCode && hasRole(departmentCode as AppRole));
  const [scope, setScope] = useState<"department" | "mine">("department");
  const tasksQ = useTasks({
    departmentId,
    assigneeId: scope === "mine" ? profile?.id : undefined,
  });
  const updateTask = useUpdateTask();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = (tasksQ.data ?? []).find((t) => t.id === selectedTaskId) ?? null;

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    updateTask.mutate(
      { id: taskId, status },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
    );
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-md border bg-card p-0.5 text-xs">
          {(["department", "mine"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                "px-3 py-1.5 rounded-[5px] font-medium",
                scope === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "department" ? "Whole department" : "Just me"}
            </button>
          ))}
        </div>
        {canManage && <NewTaskDialog departmentId={departmentId} />}
      </div>
      <KanbanBoard
        tasks={tasksQ.data ?? []}
        loading={tasksQ.isLoading}
        showProject
        onStatusChange={handleStatusChange}
        onTaskClick={(t) => setSelectedTaskId(t.id)}
      />
      <TaskDetailDialog task={selectedTask} onClose={() => setSelectedTaskId(null)} />
    </>
  );
}
