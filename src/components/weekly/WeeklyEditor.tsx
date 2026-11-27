import { useBlocker } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import AddOutlined from "@mui/icons-material/AddOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/production/components/confirm-dialog";
import { api, isDemo } from "@/lib/api";
import { TaskDescription } from "@/components/TaskDescription";
import { TaskDelegateDialog } from "@/components/TaskDelegations";
import type { Task } from "@/lib/data";
import { documentSchema } from "@/lib/models";
import { today } from "@/lib/access";
import { loadWorkspace, perform, useWorkspace } from "@/lib/workspace";
import { uploadDocument } from "@/lib/file-storage";
import { SubmissionSchedule } from "@/components/SubmissionSchedule";
import { UploadField } from "@/components/UploadField";
import { RichTextEditor } from "@/production/features/marketing/rich-text-editor";
import {
  taskDescription,
  checklistProgress,
  checklistSummary,
  checklistStatus,
  taskOutcome,
} from "@/lib/task-content";
import { plainText, validDate } from "@/lib/text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  emptyWeeklySubmission,
  reportItems,
  planItems,
  weeklyTitle,
  reportingWeek,
  weeklyTime,
  type WeeklyDetail,
  type WeeklyItem,
  type WeeklyPhase,
  type WeeklySubmission,
} from "@/lib/weekly";

export function WeeklyEditor({
  detail,
  phase,
  onClose,
  onWeekChange,
  inline = false,
  startActions,
}: {
  inline?: boolean;
  startActions?: ReactNode;
  detail: WeeklyDetail;
  phase: WeeklyPhase;
  onClose: () => void;
  onWeekChange?: (week: string) => void;
}) {
  const entry = detail[phase];
  const client = useQueryClient();
  const { documents, tasks } = useWorkspace();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [taskBeforeEdit, setTaskBeforeEdit] = useState<WeeklyItem | null>(null);
  const [delegating, setDelegating] = useState<Task | null>(null);
  const editorRegion = useRef<HTMLDivElement>(null);
  const [clockOrigin] = useState(() => ({
    server: new Date(detail.now).getTime(),
    local: Date.now(),
  }));
  useEffect(() => {
    if (editingItemId)
      editorRegion.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [editingItemId]);
  const [version, setVersion] = useState(entry?.version ?? 0);
  const [uploading, setUploading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [schedulePending, setSchedulePending] = useState(false);
  const [lateDialogOpen, setLateDialogOpen] = useState(false);
  const [lateReason, setLateReason] = useState("");
  const [taskToAdd, setTaskToAdd] = useState("");
  const [weekInput, setWeekInput] = useState(detail.weekStart);
  const initial = useMemo(() => {
    const initial = {
      ...(entry?.submission ?? emptyWeeklySubmission()),
      title: plainText(entry?.submission.title) || weeklyTitle(phase, detail.weekStart),
      items:
        phase === "report"
          ? reportItems(detail)
          : planItems(detail).map((item) => ({
              ...item,
              due:
                item.due ??
                detail.tasks.find((task) => task.id === (item.taskId ?? item.id))?.due ??
                new Date(new Date(`${detail.weekStart}T12:00:00Z`).getTime() + 4 * 86400000)
                  .toISOString()
                  .slice(0, 10),
              priority: item.priority ?? ("Medium" as const),
            })),
    };
    initial.items = initial.items.map((item) => ({
      ...item,
      title: plainText(item.title),
      detail: taskDescription(item.detail, item.subtasks),
      outcome: plainText(item.outcome),
      subtasks: [],
    }));
    initial.summary = plainText(initial.summary);
    initial.note = plainText(initial.note);
    initial.blockers = plainText(initial.blockers);
    initial.nextWeek = plainText(initial.nextWeek);
    return initial;
  }, [entry, phase, detail]);
  const [form, setForm] = useState<WeeklySubmission>(initial);
  const knownTasks = useRef(new Set(detail.tasks.map((task) => task.id)));
  useEffect(() => {
    const incoming = new Set(
      detail.tasks.filter((task) => !knownTasks.current.has(task.id)).map((task) => task.id),
    );
    knownTasks.current = new Set(detail.tasks.map((task) => task.id));
    if (!incoming.size) return;
    const additions = (phase === "plan" ? planItems(detail) : reportItems(detail))
      .filter((item) => incoming.has(item.taskId ?? item.id))
      .map((item) => ({
        ...item,
        title: plainText(item.title),
        detail: taskDescription(item.detail, item.subtasks),
        outcome: plainText(item.outcome),
        subtasks: [],
      }));
    if (additions.length)
      setForm((current) => ({
        ...current,
        items: [
          ...current.items,
          ...additions.filter(
            (item) =>
              !current.items.some((row) => (row.taskId ?? row.id) === (item.taskId ?? item.id)),
          ),
        ],
      }));
  }, [detail, phase]);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const dirty = JSON.stringify(form) !== saved;
  const mutation = useMutation({
    mutationFn: ({ submit, reason }: { submit: boolean; reason?: string }) =>
      api<{ version: number }>(`/weekly/reports/${detail.weekStart}/${phase}`, {
        method: "PUT",
        body: JSON.stringify({
          version,
          submit,
          ...(reason ? { lateReason: reason } : {}),
          submission: form,
        }),
      }),
    onSuccess: async (result) => {
      setVersion(result.version);
      setSaved(JSON.stringify(form));
      await client.invalidateQueries({ queryKey: ["weekly"] });
      await loadWorkspace().catch(() =>
        toast.error("Saved. Reload the workspace to refresh tasks and files."),
      );
    },
  });
  const busy = mutation.isPending || uploading || schedulePending;
  useEffect(() => {
    const remoteVersion = entry?.version ?? 0;
    if (remoteVersion <= version || dirty || mutation.isPending) return;
    setVersion(remoteVersion);
    setForm(initial);
    setSaved(JSON.stringify(initial));
    setEditingItemId(null);
    setTaskBeforeEdit(null);
  }, [entry?.version, version, dirty, mutation.isPending, initial]);
  const discard = () =>
    confirmDialog({
      title: "Discard weekly changes?",
      description: "You have unsaved changes. Discard them?",
      confirmLabel: "Discard changes",
      destructive: true,
    });
  useBlocker({ shouldBlockFn: async () => dirty && !(await discard()), enableBeforeUnload: dirty });
  const requestClose = async () => {
    if (!busy && (!dirty || (await discard()))) {
      if (inline) {
        setForm(initial);
        setSaved(JSON.stringify(initial));
        setVersion(entry?.version ?? 0);
        setEditingItemId(null);
        setTaskBeforeEdit(null);
      }
      onClose();
    }
  };
  const updateItem = (id: string, value: Partial<WeeklyItem>) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...value } : item)),
    }));
  const save = async (submit: boolean, reason?: string) => {
    const saved = await perform(
      async () => {
        await mutation.mutateAsync({ submit, ...(reason ? { reason } : {}) });
      },
      submit ? "Weekly submission saved" : "Draft saved",
    );
    if (saved) onClose();
    return saved;
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || editingItemId) return;
    if (
      clockOrigin.server + Date.now() - clockOrigin.local >
      new Date(detail.deadlines[phase]).getTime()
    ) {
      setLateDialogOpen(true);
      return;
    }
    void save(true);
  };
  const reportOpen = phase !== "report" || new Date(detail.now) >= new Date(detail.reportOpensAt);
  const completed = form.items.filter((item) => item.status === "completed").length;
  const addTaskButton = (
    <Button
      type="button"
      variant="outline"
      className="btn soft sm"
      size="sm"
      disabled={busy || !!editingItemId || form.items.length >= 100}
      onClick={() => {
        const id = crypto.randomUUID();
        setEditingItemId(id);
        setTaskBeforeEdit(null);
        setForm({
          ...form,
          items: [
            ...form.items,
            {
              id,
              title: "",
              detail: "",
              ...(phase === "report" ? { outcome: "" } : {}),
              due: new Date(new Date(`${detail.weekStart}T12:00:00Z`).getTime() + 4 * 86400000)
                .toISOString()
                .slice(0, 10),
              priority: "Medium",
              status: phase === "plan" ? "planned" : "pending",
            },
          ],
        });
      }}
    >
      <AddOutlined fontSize="small" /> Add task
    </Button>
  );
  const addExistingTask = () => {
    const task = detail.tasks.find((row) => row.id === taskToAdd);
    if (!task || form.items.some((item) => (item.taskId ?? item.id) === task.id)) return;
    const defaultDue = new Date(`${detail.weekStart}T12:00:00Z`);
    defaultDue.setUTCDate(defaultDue.getUTCDate() + 4);
    const due =
      task.due >= detail.weekStart && task.due <= detail.weekEnd
        ? task.due
        : defaultDue.toISOString().slice(0, 10);
    setEditingItemId(task.id);
    setTaskBeforeEdit(null);
    setForm((current) => ({
      ...current,
      items: [
        ...current.items.filter((item) => item.id !== editingItemId),
        {
          id: task.id,
          taskId: task.id,
          title: task.title,
          detail: taskDescription(task.description, task.subtasks),
          due,
          priority: task.priority,
          status: task.status === "To do" ? "planned" : taskOutcome(task.status),
          source: task.source,
          business: task.business,
          subtasks: [],
          ...(phase === "report" ? { outcome: "" } : {}),
        },
      ],
    }));
    setTaskToAdd("");
  };
  const finishTask = () => {
    const item = form.items.find((row) => row.id === editingItemId);
    if (!item || !plainText(item.title).trim()) {
      toast.error("Enter a task title before saving the task.");
      return;
    }
    if (item.detail.length > 10000 || (phase === "plan" && item.due && !validDate(item.due))) {
      toast.error("Check the task description and due date before saving.");
      return;
    }
    updateItem(item.id, { title: plainText(item.title).trim() });
    setEditingItemId(null);
    setTaskBeforeEdit(null);
  };
  const cancelTask = () => {
    setForm((current) => ({
      ...current,
      items: taskBeforeEdit
        ? current.items.map((item) => (item.id === editingItemId ? taskBeforeEdit : item))
        : current.items.filter((item) => item.id !== editingItemId),
    }));
    setEditingItemId(null);
    setTaskBeforeEdit(null);
    setTaskToAdd("");
  };
  const content = (
    <>
      {!inline && (
        <DialogHeader>
          <DialogTitle>
            {entry?.submittedAt ? "Edit" : entry ? "Continue" : "New"} weekly {phase}
          </DialogTitle>
          <DialogDescription>
            Prepare your tasks and outcomes, then save, schedule or submit.
          </DialogDescription>
        </DialogHeader>
      )}
      <form onSubmit={submit} className="space-y-4">
        {(entry?.version ?? 0) > version && !mutation.isPending && (
          <div role="status" className="rounded-lg border bg-muted/20 p-3 text-sm">
            Saved changes are available. Your current edits are kept here.
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-3"
              disabled={busy}
              onClick={async () => {
                if (dirty && !(await discard())) return;
                setForm(initial);
                setSaved(JSON.stringify(initial));
                setVersion(entry?.version ?? 0);
                setEditingItemId(null);
                setTaskBeforeEdit(null);
              }}
            >
              Load saved version
            </Button>
          </div>
        )}
        <div className="formgrid">
          <label className="field-label">
            {phase === "plan" ? "Plan title" : "Report title"}
            <input
              aria-label={phase === "plan" ? "Plan title" : "Report title"}
              className="field-input"
              maxLength={200}
              value={form.title ?? ""}
              placeholder={weeklyTitle(phase, detail.weekStart)}
              disabled={busy}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          {onWeekChange ? (
            <label className="field-label w-fit">
              Week to prepare
              <input
                aria-label="Week to prepare"
                className="field-input"
                type="date"
                value={weekInput}
                disabled={busy}
                onChange={(event) => setWeekInput(event.target.value)}
              />
              <button
                type="button"
                className="btn secondary sm"
                disabled={busy || !validDate(weekInput)}
                onClick={async () => {
                  if (!dirty || (await discard()))
                    onWeekChange(reportingWeek(new Date(`${weekInput}T12:00:00Z`)));
                }}
              >
                Apply week
              </button>
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">Week of {detail.weekStart}</p>
          )}
        </div>
        <label className="field-label">
          {phase === "plan" ? "Weekly objective" : "Executive summary"}
          <textarea
            className="field-input min-h-20"
            maxLength={5000}
            value={form.summary}
            disabled={busy}
            onChange={(event) => setForm({ ...form, summary: event.target.value })}
          />
        </label>
        {entry?.returnComment && (
          <p className="rounded-lg border bg-muted p-3 text-sm">
            Correction requested: {entry.returnComment}
          </p>
        )}
        <div className="space-y-2">
          <div className="weekly-task-heading flex items-center justify-between text-sm font-medium">
            <div>
              <h3>{phase === "plan" ? "Tasks for this week" : "Task results"}</h3>
              <span className="tiny muted">
                {phase === "plan"
                  ? "Each task has a due day and priority."
                  : "Status and outcome for each weekly task."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {phase === "plan" && editingItemId && !taskBeforeEdit && (
                <div className="flex items-center gap-2">
                  <select
                    className="field-input max-w-56 py-1 text-sm"
                    aria-label="Choose an existing task"
                    value={taskToAdd}
                    disabled={busy}
                    onChange={(event) => setTaskToAdd(event.target.value)}
                  >
                    <option value="">Choose existing task</option>
                    {detail.tasks
                      .filter(
                        (task) => !form.items.some((item) => (item.taskId ?? item.id) === task.id),
                      )
                      .map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!taskToAdd || busy}
                    onClick={addExistingTask}
                  >
                    Add selected task
                  </Button>
                </div>
              )}
              {!editingItemId && addTaskButton}
              {phase === "report" && (
                <span className="text-muted-foreground">
                  {completed} of {form.items.length} done
                </span>
              )}
            </div>
          </div>
          {!form.items.length && (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {phase === "plan"
                ? "Add your first task below."
                : "No tasks for this week yet. You can add work you did below."}
            </p>
          )}
          {[...form.items]
            .sort(
              (left, right) =>
                Number(right.id === editingItemId) - Number(left.id === editingItemId),
            )
            .map((item) => {
              const index = form.items.findIndex((row) => row.id === item.id);
              if (item.id !== editingItemId) {
                const progress = checklistProgress(item.detail);
                const storedTask = tasks?.find(
                  (task) =>
                    task.id === (item.taskId ?? item.id) && task.assignee === detail.person.id,
                );
                return (
                  <div key={item.id} className="weekly-task-card">
                    <div className="weekly-task-card-head">
                      <div>
                        <strong>
                          {index + 1}. {item.title}
                        </strong>
                        <p>
                          {item.due ? `Due ${item.due} | ` : ""}
                          {item.priority ?? "Medium"} priority |{" "}
                          {progress.total
                            ? `${progress.done}/${progress.total} completed`
                            : item.status.replaceAll("_", " ")}
                        </p>
                        {progress.total > 0 && <p>{checklistSummary(item.detail)}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy || !!editingItemId}
                          onClick={() => {
                            setTaskBeforeEdit(structuredClone(item));
                            setEditingItemId(item.id);
                          }}
                        >
                          Edit task {index + 1}
                        </Button>
                        {storedTask &&
                          !isDemo &&
                          !["Done", "Cancelled"].includes(storedTask.status) && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy || !!editingItemId}
                              onClick={() => setDelegating(storedTask)}
                            >
                              Delegate task
                            </Button>
                          )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove task ${index + 1}`}
                          disabled={busy || !!editingItemId}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.filter((row) => row.id !== item.id),
                            }))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {item.detail && (
                      <details className="mt-2 text-sm">
                        <summary>Task details</summary>
                        <TaskDescription description={item.detail} />
                      </details>
                    )}
                    {phase === "report" && item.outcome && (
                      <p className="mt-2 text-sm">Outcome: {item.outcome}</p>
                    )}
                  </div>
                );
              }
              return (
                <div
                  key={item.id}
                  ref={editorRegion}
                  className="taskedit weekly-task-composer"
                  role="group"
                  aria-label={`Edit task ${index + 1}`}
                >
                  {
                    <div className="taskedithead">
                      <span>Task {index + 1}</span>
                      <button
                        type="button"
                        className="btn danger sm"
                        aria-label={`Cancel editing task ${index + 1}`}
                        disabled={busy}
                        onClick={cancelTask}
                      >
                        <CloseOutlined fontSize="inherit" /> Cancel
                      </button>
                    </div>
                  }
                  <div className={phase === "plan" ? "taskeditgrid" : "report-task-title"}>
                    <div className="field">
                      <label htmlFor={`weekly-task-${item.id}`}>Task title</label>
                      <input
                        id={`weekly-task-${item.id}`}
                        className="field-input"
                        aria-label={`Task ${index + 1}`}
                        placeholder="e.g. Recruitment for Client A"
                        required
                        autoFocus
                        maxLength={200}
                        value={item.title}
                        disabled={busy}
                        onChange={(event) => updateItem(item.id, { title: event.target.value })}
                      />
                      {phase === "report" && (
                        <small>
                          {item.priority ?? "Medium"} priority{item.due ? ` | Due ${item.due}` : ""}
                        </small>
                      )}
                    </div>
                    {phase === "plan" && (
                      <>
                        <div className="field">
                          <label htmlFor={`due-${item.id}`}>Due day</label>
                          <select
                            id={`due-${item.id}`}
                            aria-label={`Due day for task ${index + 1}`}
                            disabled={busy}
                            value={
                              item.due ??
                              new Date(
                                new Date(`${detail.weekStart}T12:00:00Z`).getTime() + 4 * 86400000,
                              )
                                .toISOString()
                                .slice(0, 10)
                            }
                            onChange={(event) => updateItem(item.id, { due: event.target.value })}
                          >
                            {[
                              "Monday",
                              "Tuesday",
                              "Wednesday",
                              "Thursday",
                              "Friday",
                              "Saturday",
                              "Sunday",
                            ].map((day, offset) => {
                              const date = new Date(
                                new Date(`${detail.weekStart}T12:00:00Z`).getTime() +
                                  offset * 86400000,
                              )
                                .toISOString()
                                .slice(0, 10);
                              return (
                                <option key={day} value={date}>
                                  {day}
                                </option>
                              );
                            })}
                            {item.due &&
                              (item.due < detail.weekStart || item.due > detail.weekEnd) && (
                                <option value={item.due}>{item.due}</option>
                              )}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`priority-${item.id}`}>Priority</label>
                          <select
                            id={`priority-${item.id}`}
                            aria-label={`Priority for task ${index + 1}`}
                            value={item.priority ?? "Medium"}
                            disabled={busy}
                            onChange={(event) =>
                              updateItem(item.id, {
                                priority: event.target.value as WeeklyItem["priority"],
                              })
                            }
                          >
                            {["High", "Medium", "Low", "Urgent"].map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mt-3 space-y-3 md:col-span-full">
                    <div className="field-label">
                      <span>Description / deliverables</span>
                      <RichTextEditor
                        checklist
                        deliverableWeek={detail.weekStart}
                        ariaLabel={`Description for task ${index + 1}`}
                        value={item.detail}
                        disabled={busy}
                        onChange={(detail) =>
                          updateItem(item.id, {
                            detail,
                            subtasks: [],
                            status: checklistProgress(detail).total
                              ? taskOutcome(checklistStatus(detail, "To do"))
                              : item.status,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Forwarding and postponement take effect when you submit this {phase}.
                      </p>
                    </div>
                    {checklistProgress(item.detail).total > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {checklistProgress(item.detail).done}/{checklistProgress(item.detail).total}{" "}
                        completed
                        <span className="mt-1 block">{checklistSummary(item.detail)}</span>
                      </p>
                    ) : (
                      <select
                        className="report-status"
                        data-status={item.status}
                        aria-label={`Status: ${item.title}`}
                        value={item.status}
                        disabled={busy}
                        onChange={(event) =>
                          updateItem(item.id, {
                            status: event.target.value as WeeklyItem["status"],
                          })
                        }
                      >
                        {phase === "plan" && <option value="planned">Planned</option>}
                        <option value="pending">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    )}
                    {phase === "report" && (
                      <label className="field-label">
                        Outcome / explanation
                        <input
                          className="field-input"
                          aria-label={"Outcome: " + plainText(item.title)}
                          value={item.outcome ?? ""}
                          maxLength={2000}
                          disabled={busy}
                          onChange={(event) => updateItem(item.id, { outcome: event.target.value })}
                        />
                      </label>
                    )}
                  </div>
                  <div className="mt-4 flex justify-end gap-2 border-t pt-3">
                    <Button type="button" variant="outline" disabled={busy} onClick={cancelTask}>
                      Cancel task
                    </Button>
                    <Button type="button" disabled={busy} onClick={finishTask}>
                      Save task
                    </Button>
                  </div>
                </div>
              );
            })}
          {form.items.length > 0 && !editingItemId && (
            <div className="flex justify-end pt-2">{addTaskButton}</div>
          )}
          {!!editingItemId && (
            <p className="text-xs text-muted-foreground">
              Save this task to return to the list. Save draft or Submit saves your complete {phase}
              .
            </p>
          )}
        </div>
        {phase === "report" && (
          <label className="field-label">
            Challenges and blockers
            <textarea
              className="field-input min-h-20"
              maxLength={5000}
              value={form.blockers ?? ""}
              disabled={busy}
              onChange={(event) => setForm({ ...form, blockers: event.target.value })}
            />
          </label>
        )}
        {phase === "report" && (
          <label className="field-label">
            Next week's priorities
            <textarea
              className="field-input min-h-20"
              maxLength={5000}
              value={form.nextWeek ?? ""}
              disabled={busy}
              onChange={(event) => setForm({ ...form, nextWeek: event.target.value })}
            />
          </label>
        )}
        <label className="field-label">
          Notes (optional)
          <textarea
            className="field-input min-h-20"
            maxLength={5000}
            value={form.note ?? ""}
            disabled={busy}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Attachments
            {form.attachments?.length ? ` (${form.attachments.length})` : " (optional)"}
          </summary>
          <div className="mt-3 space-y-2">
            {(form.attachments ?? []).map((id) => (
              <div key={id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {documents.find((document) => document.id === id)?.name ??
                    "Attachment unavailable"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    setForm({
                      ...form,
                      attachments: form.attachments?.filter((value) => value !== id) ?? [],
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <UploadField
              aria-label="Upload weekly attachment"
              disabled={busy || (form.attachments?.length ?? 0) >= 10}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                input.value = "";
                if (!file) return;
                if (file.size > 25 * 1024 * 1024) {
                  toast.error("Choose a file no larger than 25 MB.");
                  return;
                }
                const document = documentSchema.parse({
                  id: crypto.randomUUID(),
                  name: file.name,
                  folder: "Weekly submissions",
                  access: "restricted",
                  owner: detail.person.id,
                  allowed: [detail.person.id],
                  updated: today(),
                  weeklyRef: `weekly:${detail.person.id}:${detail.weekStart}:${phase}`,
                  mime: file.type || "application/octet-stream",
                });
                setUploading(true);
                try {
                  if (await perform(() => uploadDocument(document, file), "Attachment uploaded"))
                    setForm((current) => ({
                      ...current,
                      attachments: [...(current.attachments ?? []), document.id],
                    }));
                } finally {
                  setUploading(false);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Up to 10 files, 25 MB each. Shared with the CEO.
            </p>
          </div>
        </details>
        {!!detail.leave?.length && (
          <p className="text-xs text-muted-foreground">
            Recorded leave: {detail.leave.map((row) => `${row.start} to ${row.end}`).join(", ")}
          </p>
        )}
        {!reportOpen && (
          <p className="text-sm text-muted-foreground">
            Report submission opens {weeklyTime(detail.reportOpensAt)}. You can save or schedule it
            now.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <div>{startActions}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void requestClose()}
            >
              Cancel
            </Button>
            {!entry?.submittedAt && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !!editingItemId}
                  onClick={() => void save(false)}
                >
                  Save draft
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !!editingItemId}
                  onClick={() => setScheduling(!scheduling)}
                >
                  Schedule
                </Button>
              </>
            )}
            <Button type="submit" disabled={busy || !reportOpen || !!editingItemId}>
              {mutation.isPending
                ? "Saving..."
                : entry?.submittedAt
                  ? `Submit ${phase} update`
                  : `Submit ${phase} to CEO`}
            </Button>
          </div>
        </div>
      </form>
      {delegating && <TaskDelegateDialog task={delegating} onClose={() => setDelegating(null)} />}
      {scheduling && (
        <SubmissionSchedule
          kind={phase}
          target={detail.weekStart}
          saveDraft={() => mutation.mutateAsync({ submit: false })}
          disabled={busy}
          onScheduled={onClose}
          onBusyChange={setSchedulePending}
        />
      )}
      <Dialog open={lateDialogOpen} onOpenChange={setLateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for late submission</DialogTitle>
            <DialogDescription>
              This {phase} is past its deadline. Provide a reason before submitting.
            </DialogDescription>
          </DialogHeader>
          <label className="field-label">
            Reason
            <textarea
              className="field-input min-h-24"
              maxLength={1000}
              minLength={5}
              required
              value={lateReason}
              onChange={(event) => setLateReason(event.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setLateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={mutation.isPending || lateReason.trim().length < 5}
              onClick={async () => {
                if (await save(true, lateReason.trim())) {
                  setLateDialogOpen(false);
                  setLateReason("");
                }
              }}
            >
              Submit {phase}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
  return inline ? (
    <section className="panel reporting-editor">{content}</section>
  ) : (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void requestClose();
      }}
    >
      <DialogContent className="reporting max-h-[90vh] max-w-3xl overflow-y-auto">
        {content}
      </DialogContent>
    </Dialog>
  );
}
