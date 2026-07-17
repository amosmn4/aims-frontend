import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Trash2, X } from "lucide-react";
import {
  useTaskComments,
  useCreateComment,
  useDeleteComment,
  useUpdateTask,
  useAddTaskDependency,
  useRemoveTaskDependency,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_COLUMNS,
  type Task,
  type TaskStatus,
} from "@/features/projects/use-projects";
import { useAuth } from "@/lib/auth";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TaskDetailDialog({
  task,
  onClose,
  canManageDocuments = false,
  projectTasks,
}: {
  task: Task | null;
  onClose: () => void;
  /** Whether the current user has department-level access to the task's project — the
   * uploader/assignee always additionally gets manage rights, checked inside the panel. */
  canManageDocuments?: boolean;
  /** Sibling tasks in the same project, for the dependency editor. Omit to hide that section. */
  projectTasks?: Task[];
}) {
  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {task && (
          <TaskDetailBody task={task} canManageDocuments={canManageDocuments} projectTasks={projectTasks} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailBody({
  task,
  canManageDocuments,
  projectTasks,
}: {
  task: Task;
  canManageDocuments: boolean;
  projectTasks?: Task[];
}) {
  const { profile } = useAuth();
  const commentsQ = useTaskComments(task.id);
  const createComment = useCreateComment(task.id);
  const deleteComment = useDeleteComment(task.id);
  const updateTask = useUpdateTask();
  const addDependency = useAddTaskDependency();
  const removeDependency = useRemoveTaskDependency();
  const [body, setBody] = useState("");
  const [depToAdd, setDepToAdd] = useState("");

  const dependencyCandidates = (projectTasks ?? []).filter(
    (t) => t.id !== task.id && !task.depends_on.some((d) => d.id === t.id),
  );

  const submitComment = () => {
    if (!body.trim()) return;
    createComment.mutate(body.trim(), {
      onSuccess: () => setBody(""),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to post comment"),
    });
  };

  const changeStatus = (status: TaskStatus) => {
    updateTask.mutate(
      { id: task.id, status },
      { onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed") },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{task.title}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Select value={task.status} onValueChange={(v) => changeStatus(v as TaskStatus)}>
          <SelectTrigger className="h-7 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUS_COLUMNS.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary">{TASK_PRIORITY_LABELS[task.priority]} priority</Badge>
        {task.due_date && <Badge variant="outline">Due {task.due_date}</Badge>}
        {task.phase && <Badge variant="outline">{task.phase}</Badge>}
        {task.estimated_hours != null && (
          <Badge variant="outline">
            Est {task.estimated_hours}h / Act {task.actual_hours}h
          </Badge>
        )}
      </div>

      {task.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
      )}

      {projectTasks && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-muted-foreground">Depends on</div>
          <div className="flex flex-wrap gap-1.5">
            {task.depends_on.length === 0 && (
              <span className="text-xs text-muted-foreground">No dependencies</span>
            )}
            {task.depends_on.map((d) => (
              <Badge key={d.id} variant="secondary" className="gap-1 pr-1">
                {d.title}
                <button
                  onClick={() =>
                    removeDependency.mutate(
                      { taskId: task.id, dependsOnId: d.id },
                      { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove") },
                    )
                  }
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          {dependencyCandidates.length > 0 && (
            <div className="flex gap-2">
              <Select value={depToAdd} onValueChange={setDepToAdd}>
                <SelectTrigger className="h-7 flex-1 text-xs">
                  <SelectValue placeholder="Add a dependency…" />
                </SelectTrigger>
                <SelectContent>
                  {dependencyCandidates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!depToAdd || addDependency.isPending}
                onClick={() =>
                  addDependency.mutate(
                    { taskId: task.id, dependsOnId: depToAdd },
                    {
                      onSuccess: () => setDepToAdd(""),
                      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add"),
                    },
                  )
                }
              >
                Add
              </Button>
            </div>
          )}
        </div>
      )}

      <Separator />

      <div className="text-xs font-semibold text-muted-foreground">Comments</div>
      <ScrollArea className="max-h-56">
        <div className="space-y-3 pr-3">
          {commentsQ.isLoading ? (
            <div className="py-4 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : (commentsQ.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No comments yet.</p>
          ) : (
            (commentsQ.data ?? []).map((c) => (
              <div key={c.id} className="text-xs group">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.author_name}</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{new Date(c.created_at).toLocaleString()}</span>
                    {c.author_id === profile?.id && (
                      <button
                        onClick={() => deleteComment.mutate(c.id)}
                        className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          className="min-h-[60px] text-sm"
        />
        <Button size="icon" onClick={submitComment} disabled={createComment.isPending}>
          {createComment.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Separator />

      <AttachmentsPanel
        resourceType="task"
        resourceId={task.id}
        canManage={canManageDocuments || task.assignee_id === profile?.id}
      />
    </>
  );
}
