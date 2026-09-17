import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import { LoadError } from "@/components/load-error";
import {
  useTasks,
  useUpdateTask,
  isTaskOverdue,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  type TaskStatus,
} from "@/features/projects/use-projects";
import { KanbanBoard } from "@/components/kanban-board";
import { TaskDetailDialog } from "@/features/projects/task-detail-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const searchSchema = z.object({
  view: z.union([z.literal("board"), z.literal("list")]).catch("list"),
});

export const Route = createFileRoute("/_authenticated/projects/mine")({
  head: () => ({ meta: [{ title: "My tasks — AIMS" }, { name: "robots", content: "noindex" }] }),
  validateSearch: searchSchema,
  component: MyTasks,
});

function MyTasks() {
  const { user } = useAuth();
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const tasksQ = useTasks({ assigneeId: user?.id });
  const updateTask = useUpdateTask();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // Derived from live data so changes made in the dialog show immediately.
  const selectedTask = (tasksQ.data ?? []).find((t) => t.id === selectedTaskId) ?? null;
  // Open work first, soonest due date first.
  const tasks = [...(tasksQ.data ?? [])].sort((a, b) => {
    const done = Number(a.status === "completed") - Number(b.status === "completed");
    if (done !== 0) return done;
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  });

  const setView = (v: "board" | "list") => navigate({ search: { view: v }, replace: true });

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    updateTask.mutate(
      { id: taskId, status },
      {
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't update the task. Try again."),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Show tasks as"
        className="inline-flex rounded-md border overflow-hidden"
      >
        <button
          type="button"
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
          className={`px-3 py-1 text-xs ${view === "list" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}
        >
          List
        </button>
        <button
          type="button"
          aria-pressed={view === "board"}
          onClick={() => setView("board")}
          className={`px-3 py-1 text-xs ${view === "board" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}
        >
          Board
        </button>
      </div>

      {tasksQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : tasksQ.isError ? (
        <LoadError what="your tasks" error={tasksQ.error} onRetry={() => tasksQ.refetch()} />
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 px-6 text-center">
          <p className="text-sm font-medium">No tasks assigned to you yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            When someone gives you a task on a project, it shows up here.
          </p>
        </div>
      ) : view === "board" ? (
        <KanbanBoard
          tasks={tasks}
          showProject
          onStatusChange={handleStatusChange}
          onTaskClick={(t) => setSelectedTaskId(t.id)}
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open task: ${t.title}`}
                  className="cursor-pointer hover:bg-secondary/50 focus-visible:outline-none focus-visible:bg-secondary/60"
                  onClick={() => setSelectedTaskId(t.id)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedTaskId(t.id);
                    }
                  }}
                >
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell className="text-xs">
                    {t.project_name ? (
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: t.project_id }}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t.project_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TASK_STATUS_LABELS[t.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{TASK_PRIORITY_LABELS[t.priority]}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDate(t.due_date)}
                    {isTaskOverdue(t) && (
                      <span className="ml-1.5 font-medium text-destructive">Overdue</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskDetailDialog task={selectedTask} onClose={() => setSelectedTaskId(null)} />
    </div>
  );
}
