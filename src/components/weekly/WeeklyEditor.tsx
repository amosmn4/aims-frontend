import { useBlocker } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import AddOutlined from "@mui/icons-material/AddOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/production/components/confirm-dialog";
import { api } from "@/lib/api";
import { documentSchema } from "@/lib/models";
import { today } from "@/lib/access";
import { loadWorkspace, perform, useWorkspace } from "@/lib/workspace";
import { uploadDocument } from "@/lib/file-storage";
import { SubmissionSchedule } from "@/components/SubmissionSchedule";
import { UploadField } from "@/components/UploadField";
import { RichTextEditor } from "@/production/features/marketing/rich-text-editor";
import { TaskDeliverables } from "@/components/TaskDeliverables";
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
  const { documents } = useWorkspace();
  const [version, setVersion] = useState(entry?.version ?? 0);
  const [uploading, setUploading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [schedulePending, setSchedulePending] = useState(false);
  const [weekInput, setWeekInput] = useState(detail.weekStart);
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
    subtasks: item.subtasks?.map((part) => ({ ...part, title: plainText(part.title) })),
  }));
  const [form, setForm] = useState<WeeklySubmission>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const dirty = JSON.stringify(form) !== saved;
  const mutation = useMutation({
    mutationFn: (submit: boolean) =>
      api<{ version: number }>(`/weekly/reports/${detail.weekStart}/${phase}`, {
        method: "PUT",
        body: JSON.stringify({ version, submit, submission: form }),
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
      }
      onClose();
    }
  };
  const updateItem = (id: string, value: Partial<WeeklyItem>) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...value } : item)),
    }));
  const save = async (submit: boolean) => {
    if (
      await perform(
        async () => {
          await mutation.mutateAsync(submit);
        },
        submit ? "Weekly submission saved" : "Draft saved",
      )
    )
      onClose();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
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
      disabled={busy || form.items.length >= 100}
      onClick={() =>
        setForm({
          ...form,
          items: [
            ...form.items,
            {
              id: crypto.randomUUID(),
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
        })
      }
    >
      <AddOutlined fontSize="small" /> Add task
    </Button>
  );
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
          <RichTextEditor
            ariaLabel={phase === "plan" ? "Weekly objective" : "Executive summary"}
            value={form.summary}
            disabled={busy}
            onChange={(summary) => setForm({ ...form, summary })}
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
              {addTaskButton}
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
          {form.items.map((item, index) => {
            return (
              <div key={item.id} className={phase === "plan" ? "taskedit" : "reportrow"}>
                {phase === "plan" && (
                  <div className="taskedithead">
                    <span>Task {index + 1}</span>
                    <button
                      type="button"
                      className="btn danger sm"
                      aria-label={`Remove task ${index + 1}`}
                      disabled={busy}
                      onClick={() =>
                        setForm({ ...form, items: form.items.filter((row) => row.id !== item.id) })
                      }
                    >
                      <CloseOutlined fontSize="inherit" /> Remove
                    </button>
                  </div>
                )}
                <div className={phase === "plan" ? "taskeditgrid" : "report-task-title"}>
                  <div className="field">
                    <label htmlFor={`weekly-task-${item.id}`}>Task title</label>
                    <input
                      id={`weekly-task-${item.id}`}
                      className="field-input"
                      aria-label={`Task ${index + 1}`}
                      placeholder="e.g. Recruitment for Client A"
                      required
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
                  <label className="field-label">
                    Description / deliverables
                    <RichTextEditor
                      ariaLabel={`Description for task ${index + 1}`}
                      value={item.detail}
                      disabled={busy}
                      onChange={(detail) => updateItem(item.id, { detail })}
                    />
                  </label>
                  <TaskDeliverables
                    label={`Task ${index + 1} deliverables`}
                    items={item.subtasks ?? []}
                    disabled={busy}
                    onChange={(subtasks) => updateItem(item.id, { subtasks })}
                  />
                  <select
                    className="report-status"
                    data-status={item.status}
                    aria-label={`Status: ${item.title}`}
                    value={item.status}
                    disabled={busy}
                    onChange={(event) =>
                      updateItem(item.id, { status: event.target.value as WeeklyItem["status"] })
                    }
                  >
                    {phase === "plan" && <option value="planned">Planned</option>}
                    <option value="pending">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  {phase === "report" && (
                    <label className="field-label">
                      Outcome / explanation
                      <RichTextEditor
                        ariaLabel={`Outcome: ${plainText(item.title)}`}
                        value={item.outcome ?? ""}
                        disabled={busy}
                        onChange={(outcome) => updateItem(item.id, { outcome })}
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {phase === "report" && (
          <label className="field-label">
            Challenges and blockers
            <RichTextEditor
              ariaLabel="Challenges and blockers"
              value={form.blockers}
              disabled={busy}
              onChange={(blockers) => setForm({ ...form, blockers })}
            />
          </label>
        )}
        {phase === "report" && (
          <label className="field-label">
            Next week's priorities
            <RichTextEditor
              ariaLabel="Next week's priorities"
              value={form.nextWeek}
              disabled={busy}
              onChange={(nextWeek) => setForm({ ...form, nextWeek })}
            />
          </label>
        )}
        <label className="field-label">
          Notes (optional)
          <RichTextEditor
            ariaLabel="Notes (optional)"
            value={form.note ?? ""}
            disabled={busy}
            onChange={(note) => setForm({ ...form, note })}
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
                  disabled={busy}
                  onClick={() => void save(false)}
                >
                  Save draft
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setScheduling(!scheduling)}
                >
                  Schedule
                </Button>
              </>
            )}
            <Button type="submit" disabled={busy || !reportOpen}>
              {mutation.isPending
                ? "Saving..."
                : entry?.submittedAt
                  ? `Submit ${phase} update`
                  : `Submit ${phase} to CEO`}
            </Button>
          </div>
        </div>
      </form>
      {scheduling && (
        <SubmissionSchedule
          kind={phase}
          target={detail.weekStart}
          saveDraft={() => mutation.mutateAsync(false)}
          disabled={busy}
          onScheduled={onClose}
          onBusyChange={setSchedulePending}
        />
      )}
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
