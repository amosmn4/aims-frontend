import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  useTasks,
  useUpdateTask,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  type TaskStatus,
} from "@/features/projects/use-projects";
import { KanbanBoard } from "@/components/kanban-board";
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
  validateSearch: searchSchema,
  component: MyTasks,
});

function MyTasks() {
  const { user } = useAuth();
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const tasksQ = useTasks({ assigneeId: user?.id });
  const updateTask = useUpdateTask();

  const setView = (v: "board" | "list") => navigate({ search: { view: v }, replace: true });

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    updateTask.mutate(
      { id: taskId, status },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
    );
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border overflow-hidden">
        <button
          onClick={() => setView("list")}
          className={`px-3 py-1 text-xs ${view === "list" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}
        >
          List
        </button>
        <button
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
      ) : (tasksQ.data ?? []).length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          No tasks assigned to you yet.
        </div>
      ) : view === "board" ? (
        <KanbanBoard tasks={tasksQ.data ?? []} showProject onStatusChange={handleStatusChange} />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
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
              {(tasksQ.data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell className="text-xs">
                    {t.project_name ? (
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: t.project_id }}
                        className="text-primary hover:underline"
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
                  <TableCell className="text-xs">{t.due_date ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
