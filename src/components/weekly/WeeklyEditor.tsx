import { useBlocker } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
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
}: {
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
  const initial = {
    ...(entry?.submission ?? emptyWeeklySubmission()),
    items: phase === "report" ? reportItems(detail) : (entry?.submission.items ?? []),
  };
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
    if (!busy && (!dirty || (await discard()))) onClose();
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
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void requestClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry?.submittedAt ? "Edit" : entry ? "Continue" : "New"} weekly {phase}
          </DialogTitle>
          <DialogDescription>
            {phase === "plan"
              ? "Add your tasks, then save, schedule or submit."
              : "Tick what is done. Add blockers or a note if needed."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {onWeekChange ? (
            <label className="field-label w-fit">
              Week to prepare
              <input
                aria-label="Week to prepare"
                className="field-input"
                type="date"
                value={detail.weekStart}
                disabled={busy}
                onChange={async (event) => {
                  const value = event.target.value;
                  if (value && (!dirty || (await discard())))
                    onWeekChange(reportingWeek(new Date(`${value}T12:00:00Z`)));
                }}
              />
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">Week of {detail.weekStart}</p>
          )}
          {entry?.returnComment && (
            <p className="rounded-lg border bg-muted p-3 text-sm">
              Correction requested: {entry.returnComment}
            </p>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{phase === "plan" ? "Tasks" : "This week's tasks"}</span>
              {phase === "report" && (
                <span className="text-muted-foreground">
                  {completed} of {form.items.length} done
                </span>
              )}
            </div>
            {!form.items.length && (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {phase === "plan"
                  ? "Add your first task below."
                  : "No tasks for this week yet. You can add work you did below."}
              </p>
            )}
            {form.items.map((item, index) => {
              const editableTitle =
                phase === "plan" ||
                (!item.taskId &&
                  !detail.tasks.some((task) => task.id === item.id) &&
                  !detail.plan?.submission.items.some((task) => task.id === item.id));
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  {phase === "report" && (
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-primary"
                      aria-label={`Done: ${item.title}`}
                      checked={item.status === "completed"}
                      disabled={busy}
                      onChange={(event) =>
                        updateItem(item.id, {
                          status: event.target.checked ? "completed" : "pending",
                        })
                      }
                    />
                  )}
                  {editableTitle ? (
                    <input
                      className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
                      aria-label={`Task ${index + 1}`}
                      placeholder="Task name"
                      required
                      maxLength={200}
                      value={item.title}
                      disabled={busy}
                      onChange={(event) => updateItem(item.id, { title: event.target.value })}
                    />
                  ) : (
                    <span
                      className={`min-w-0 flex-1 break-words text-sm ${item.status === "completed" ? "text-muted-foreground line-through" : ""}`}
                    >
                      {item.title}
                    </span>
                  )}
                  {editableTitle && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label={`Remove task ${index + 1}`}
                      disabled={busy}
                      onClick={() =>
                        setForm({ ...form, items: form.items.filter((row) => row.id !== item.id) })
                      }
                    >
                      <CloseOutlined fontSize="small" />
                    </Button>
                  )}
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
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
                      status: phase === "plan" ? "planned" : "pending",
                    },
                  ],
                })
              }
            >
              <AddOutlined fontSize="small" /> Add task
            </Button>
          </div>
          {phase === "report" && (
            <label className="field-label">
              Blockers (optional)
              <textarea
                aria-label="Blockers (optional)"
                className="field-input min-h-20"
                maxLength={5000}
                value={form.blockers}
                disabled={busy}
                onChange={(event) => setForm({ ...form, blockers: event.target.value })}
              />
            </label>
          )}
          <label className="field-label">
            Notes (optional)
            <textarea
              aria-label="Notes (optional)"
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
              Report submission opens {weeklyTime(detail.reportOpensAt)}. You can save or schedule
              it now.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
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
                  ? "Save changes"
                  : `Submit ${phase}`}
            </Button>
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
      </DialogContent>
    </Dialog>
  );
}
