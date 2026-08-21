import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Send, Trash2, X } from "lucide-react";
import {
  useTaskComments,
  useCreateComment,
  useDeleteComment,
  useUpdateTask,
  useDeleteTask,
  useAddTaskDependency,
  useRemoveTaskDependency,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_COLUMNS,
  useTimelineExtensions,
  EXTENSION_ATTRIBUTION_LABELS,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type ExtensionAttribution,
} from "@/features/projects/use-projects";
import { ExtensionPrompt, isExtension } from "@/features/projects/extension-prompt";
import { useProfilesLite } from "@/features/clients/use-clients-contracts";
import { useAuth } from "@/lib/auth";
import { confirmDialog } from "@/components/confirm-dialog";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {task && (
          <TaskDetailBody
            task={task}
            onClose={onClose}
            canManageDocuments={canManageDocuments}
            projectTasks={projectTasks}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailBody({
  task,
  onClose,
  canManageDocuments,
  projectTasks,
}: {
  task: Task;
  onClose: () => void;
  canManageDocuments: boolean;
  projectTasks?: Task[];
}) {
  const { profile } = useAuth();
  const commentsQ = useTaskComments(task.id);
  const createComment = useCreateComment(task.id);
  const deleteComment = useDeleteComment(task.id);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const addDependency = useAddTaskDependency();
  const removeDependency = useRemoveTaskDependency();
  const profilesQ = useProfilesLite();
  const [body, setBody] = useState("");
  const [depToAdd, setDepToAdd] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Matches the backend's own access rule (TasksService.assertTaskAccess): the assignee can
  // always manage their own task, on top of the department-level access already computed by
  // the caller — same combined condition the attachments panel below already used, just now
  // shared by the edit/delete controls too.
  const canManageTask = canManageDocuments || task.assignee_id === profile?.id;

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

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: `Delete "${task.title}"?`,
      description: "This removes the task, its comments and its attachments. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast.success("Task deleted");
        onClose();
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between gap-2 pr-6">
          <DialogTitle className="text-left">{task.title}</DialogTitle>
          {canManageTask && !isEditing && (
            <div className="flex gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                disabled={deleteTask.isPending}
                onClick={handleDelete}
              >
                {deleteTask.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogHeader>

      {isEditing ? (
        <EditTaskForm
          task={task}
          profiles={profilesQ.data ?? []}
          onDone={() => setIsEditing(false)}
        />
      ) : (
        <>
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

          {task.assignee_id && (
            <div className="text-xs text-muted-foreground">
              Assigned to{" "}
              {(profilesQ.data ?? []).find((p) => p.id === task.assignee_id)?.full_name ??
                (profilesQ.data ?? []).find((p) => p.id === task.assignee_id)?.email ??
                "—"}
            </div>
          )}

          <TaskExtensionsIndicator taskId={task.id} />

          {task.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
          )}
        </>
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
                      {
                        onError: (err) =>
                          toast.error(err instanceof Error ? err.message : "Failed to remove"),
                      },
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
                      onError: (err) =>
                        toast.error(err instanceof Error ? err.message : "Failed to add"),
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

function EditTaskForm({
  task,
  profiles,
  onDone,
}: {
  task: Task;
  profiles: { id: string; full_name: string | null; email: string }[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? "");
  const [phase, setPhase] = useState(task.phase ?? "");
  const [dueDate, setDueDate] = useState(task.due_date?.slice(0, 10) ?? "");
  const [estimatedHours, setEstimatedHours] = useState(
    task.estimated_hours != null ? String(task.estimated_hours) : "",
  );
  const [extensionReason, setExtensionReason] = useState("");
  const [extensionAttribution, setExtensionAttribution] = useState<ExtensionAttribution>("client");
  const update = useUpdateTask();
  const extending = isExtension(task.due_date, dueDate);

  const submit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (extending && !extensionReason.trim()) {
      toast.error("Add a reason for the extension before saving");
      return;
    }
    update.mutate(
      {
        id: task.id,
        title: title.trim(),
        description: description || undefined,
        priority,
        assigneeId: assigneeId || undefined,
        phase: phase || undefined,
        dueDate: dueDate || undefined,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
        extensionReason: extending ? extensionReason.trim() : undefined,
        extensionAttribution: extending ? extensionAttribution : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Task updated");
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TASK_PRIORITY_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Assignee</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name ?? p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Phase</Label>
          <Input value={phase} onChange={(e) => setPhase(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <Label>Due date</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <Label>Est. hours</Label>
          <Input
            type="number"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
          />
        </div>
      </div>
      {extending && (
        <ExtensionPrompt
          reason={extensionReason}
          onReasonChange={setExtensionReason}
          attribution={extensionAttribution}
          onAttributionChange={setExtensionAttribution}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={update.isPending}>
          {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

// Compact "Extended Nx" indicator with an expandable list — same underlying data as the
// project's Timeline Extensions panel, scoped to just this task.
function TaskExtensionsIndicator({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const extensionsQ = useTimelineExtensions("task", taskId);
  const extensions = extensionsQ.data ?? [];
  if (extensions.length === 0) return null;

  return (
    <div className="text-xs">
      <button type="button" onClick={() => setOpen(!open)} className="text-warning hover:underline">
        Extended {extensions.length}x
      </button>
      {open && (
        <div className="mt-1 space-y-1.5 border-l-2 border-warning/30 pl-2">
          {extensions.map((e) => (
            <div key={e.id}>
              <div className="text-muted-foreground">
                {e.previous_date} → {e.new_date} · {EXTENSION_ATTRIBUTION_LABELS[e.attributed_to]}
              </div>
              <div>{e.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
