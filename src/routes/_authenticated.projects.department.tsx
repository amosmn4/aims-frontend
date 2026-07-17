import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useTasks, useUpdateTask, type TaskStatus } from "@/features/projects/use-projects";
import { KanbanBoard } from "@/components/kanban-board";
import { Label } from "@/components/ui/label";
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

  const tasksQ = useTasks({ departmentId: departmentId || undefined });
  const updateTask = useUpdateTask();

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    updateTask.mutate(
      { id: taskId, status },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
    );
  };

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
        <KanbanBoard
          tasks={tasksQ.data ?? []}
          loading={tasksQ.isLoading}
          showProject
          onStatusChange={handleStatusChange}
        />
      ) : (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          Select a department to see its task board.
        </div>
      )}
    </div>
  );
}
