import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import {
  useProject,
  useUpdateTask,
  useDeleteTask,
  useAddTaskDependency,
  useRemoveTaskDependency,
  tracksDeliveryMetrics,
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
import { StaffSelect, useStaffOptions } from "@/features/projects/staff-picker";
import { useAuth } from "@/lib/auth";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { TaskComments } from "@/features/activity/task-comments";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  /** Department-level access to the task's project; the assignee always gets it too. */
  canManageDocuments?: boolean;
  /** Sibling tasks in the same project, for the dependency editor. Omit to hide that section. */
  projectTasks?: Task[];
}) {
  const [editDirty, setEditDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(!!task && editDirty);

  useEffect(() => {
    if (!task) setEditDirty(false);
  }, [task]);

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && guardClose(onClose)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {task && (
          <TaskDetailBody
            key={task.id}
            task={task}
            onClose={onClose}
            canManageDocuments={canManageDocuments}
            projectTasks={projectTasks}
            onEditDirtyChange={setEditDirty}
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
  onEditDirtyChange,
}: {
  task: Task;
  onClose: () => void;
  canManageDocuments: boolean;
  projectTasks?: Task[];
  onEditDirtyChange: (dirty: boolean) => void;
}) {
  const { profile } = useAuth();
  const projectQ = useProject(task.project_id);
  const detailed = tracksDeliveryMetrics(projectQ.data?.department_code);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const addDependency = useAddTaskDependency();
  const removeDependency = useRemoveTaskDependency();
  const { nameOf } = useStaffOptions();
  const [depToAdd, setDepToAdd] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Mirrors the backend rule: department access, or the task's own assignee.
  const canManageTask = canManageDocuments || task.assignee_id === profile?.id;

  const dependencyCandidates = (projectTasks ?? []).filter(
    (t) => t.id !== task.id && !task.depends_on.some((d) => d.id === t.id),
  );

  const stopEditing = () => {
    onEditDirtyChange(false);
    setIsEditing(false);
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
      confirmLabel: "Delete task",
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

  const assignee = nameOf(task.assignee_id);

  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between gap-2 pr-6">
          <DialogTitle className="text-left">{isEditing ? "Edit task" : task.title}</DialogTitle>
          {canManageTask && !isEditing && (
            <div className="flex gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setIsEditing(true)}
                aria-label={`Edit task ${task.title}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                disabled={deleteTask.isPending}
                onClick={handleDelete}
                aria-label={`Delete task ${task.title}`}
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
        {!isEditing && task.project_name && (
          <DialogDescription className="text-left">{task.project_name}</DialogDescription>
        )}
      </DialogHeader>

      {isEditing ? (
        <EditTaskForm
          task={task}
          detailed={detailed}
          onDirtyChange={onEditDirtyChange}
          onDone={stopEditing}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Select
              value={task.status}
              onValueChange={(v) => changeStatus(v as TaskStatus)}
              disabled={!canManageTask}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Task status">
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
            {task.due_date && <Badge variant="outline">Due {formatDate(task.due_date)}</Badge>}
            {detailed && task.phase && <Badge variant="outline">Phase: {task.phase}</Badge>}
            {detailed && task.estimated_hours != null && (
              <Badge variant="outline">
                Estimated {task.estimated_hours}h · spent {task.actual_hours}h
              </Badge>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            {task.assignee_id
              ? `Assigned to ${assignee ?? "a former staff member"}`
              : "Not assigned"}
          </div>
          {!canManageTask && (
            <p className="text-xs text-muted-foreground">
              Only the person assigned or staff who manage this project can change this task.
            </p>
          )}

          <TaskExtensionsIndicator taskId={task.id} />

          {task.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
          )}
        </>
      )}

      {projectTasks && !isEditing && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-muted-foreground">Waits on</div>
          <div className="flex flex-wrap gap-1.5">
            {task.depends_on.length === 0 && (
              <span className="text-xs text-muted-foreground">Nothing — it can start any time</span>
            )}
            {task.depends_on.map((d) => (
              <Badge key={d.id} variant="secondary" className="gap-1 pr-1">
                {d.title}
                {canManageTask && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirmDialog({
                        title: "Remove this link?",
                        description: `"${task.title}" will no longer wait on "${d.title}".`,
                        confirmLabel: "Remove link",
                        destructive: true,
                      });
                      if (!ok) return;
                      removeDependency.mutate(
                        { taskId: task.id, dependsOnId: d.id },
                        {
                          onError: (err) =>
                            toast.error(err instanceof Error ? err.message : "Failed to remove"),
                        },
                      );
                    }}
                    className="hover:text-destructive"
                    aria-label={`Stop waiting on ${d.title}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          {canManageTask && dependencyCandidates.length > 0 && (
            <div className="flex gap-2">
              <Select value={depToAdd} onValueChange={setDepToAdd}>
                <SelectTrigger className="h-8 flex-1 text-xs" aria-label="Task this one waits on">
                  <SelectValue placeholder="Choose a task this waits on…" />
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
                Add waits-on task
              </Button>
            </div>
          )}
        </div>
      )}

      <Separator />

      <TaskComments taskId={task.id} />

      <Separator />

      <AttachmentsPanel
        resourceType="task"
        resourceId={task.id}
        canManage={canManageDocuments || task.assignee_id === profile?.id}
      />
    </>
  );
}

type EditTaskErrors = Partial<Record<"title" | "hours" | "extensionReason", string>>;

function EditTaskForm({
  task,
  detailed,
  onDirtyChange,
  onDone,
}: {
  task: Task;
  detailed: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onDone: () => void;
}) {
  const initial = {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    assigneeId: task.assignee_id ?? "",
    phase: task.phase ?? "",
    dueDate: task.due_date?.slice(0, 10) ?? "",
    estimatedHours: task.estimated_hours != null ? String(task.estimated_hours) : "",
  };
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [priority, setPriority] = useState<TaskPriority>(initial.priority);
  const [assigneeId, setAssigneeId] = useState(initial.assigneeId);
  const [phase, setPhase] = useState(initial.phase);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [estimatedHours, setEstimatedHours] = useState(initial.estimatedHours);
  const [extensionReason, setExtensionReason] = useState("");
  const [extensionAttribution, setExtensionAttribution] = useState<ExtensionAttribution>("client");
  const [errors, setErrors] = useState<EditTaskErrors>({});
  const update = useUpdateTask();
  const extending = isExtension(task.due_date, dueDate);

  const dirty =
    title !== initial.title ||
    description !== initial.description ||
    priority !== initial.priority ||
    assigneeId !== initial.assigneeId ||
    phase !== initial.phase ||
    dueDate !== initial.dueDate ||
    estimatedHours !== initial.estimatedHours;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const cancel = async () => {
    if (dirty) {
      const ok = await confirmDialog({
        title: "Discard your changes?",
        description: "What you changed in this task hasn't been saved.",
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        destructive: true,
      });
      if (!ok) return;
    }
    onDone();
  };

  const submit = () => {
    const found: EditTaskErrors = {};
    if (!title.trim()) found.title = "The task needs a title.";
    if (detailed && estimatedHours && Number(estimatedHours) < 0)
      found.hours = "Hours can't be negative.";
    if (extending && !extensionReason.trim())
      found.extensionReason = "Say why the due date is moving.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    update.mutate(
      {
        id: task.id,
        title: title.trim(),
        description: description || undefined,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate || undefined,
        ...(detailed
          ? {
              phase: phase.trim() || null,
              estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
            }
          : {}),
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
    <form
      noValidate
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <RequiredNote />
      <FormField id="edit-task-title" label="Title" required error={errors.title}>
        <Input
          id="edit-task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={!!errors.title}
        />
      </FormField>
      <FormField id="edit-task-description" label="Description">
        <Textarea
          id="edit-task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </FormField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="edit-task-assignee" label="Assign to">
          <StaffSelect id="edit-task-assignee" value={assigneeId} onChange={setAssigneeId} />
        </FormField>
        <FormField id="edit-task-due" label="Due date">
          <Input
            id="edit-task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </FormField>
        <FormField id="edit-task-priority" label="Priority">
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
            <SelectTrigger id="edit-task-priority">
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
        </FormField>
        {detailed && (
          <>
            <FormField id="edit-task-phase" label="Phase" hint="Groups tasks on the Timeline.">
              <Input
                id="edit-task-phase"
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                placeholder="e.g. Testing"
              />
            </FormField>
            <FormField id="edit-task-hours" label="Estimated hours" error={errors.hours}>
              <Input
                id="edit-task-hours"
                type="number"
                min={0}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                aria-invalid={!!errors.hours}
              />
            </FormField>
          </>
        )}
      </div>
      {extending && (
        <ExtensionPrompt
          reason={extensionReason}
          onReasonChange={setExtensionReason}
          attribution={extensionAttribution}
          onAttributionChange={setExtensionAttribution}
          reasonError={errors.extensionReason}
          idPrefix={`task-${task.id}`}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={cancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={update.isPending}>
          {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save task
        </Button>
      </div>
    </form>
  );
}

// "Due date moved N times", with the list of changes on request.
function TaskExtensionsIndicator({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const extensionsQ = useTimelineExtensions("task", taskId);
  const extensions = extensionsQ.data ?? [];
  if (extensions.length === 0) return null;

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-warning hover:underline"
        aria-expanded={open}
      >
        Due date moved {extensions.length} {extensions.length === 1 ? "time" : "times"}
      </button>
      {open && (
        <div className="mt-1 space-y-1.5 border-l-2 border-warning/30 pl-2">
          {extensions.map((e) => (
            <div key={e.id}>
              <div className="text-muted-foreground">
                {formatDate(e.previous_date)} → {formatDate(e.new_date)} · Delay caused by:{" "}
                {EXTENSION_ATTRIBUTION_LABELS[e.attributed_to]}
              </div>
              <div>{e.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
