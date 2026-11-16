import { useBlocker } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/production/features/marketing/rich-text-editor";
import { confirmDialog } from "@/production/components/confirm-dialog";
import { api } from "@/lib/api";
import { documentSchema } from "@/lib/models";
import { today } from "@/lib/access";
import { loadWorkspace, perform, useWorkspace } from "@/lib/workspace";
import { uploadDocument } from "@/lib/file-storage";
import {
  emptyWeeklySubmission,
  weeklyLabels,
  weeklyTime,
  type WeeklyDetail,
  type WeeklyItem,
  type WeeklyPhase,
  type WeeklySubmission,
} from "@/lib/weekly";

export function WeeklyEditor({
  detail,
  phase,
  onReload,
}: {
  detail: WeeklyDetail;
  phase: WeeklyPhase;
  onReload: () => void;
}) {
  const entry = detail[phase];
  const client = useQueryClient();
  const { documents } = useWorkspace();
  const [version, setVersion] = useState(entry?.version ?? 0);
  const [uploading, setUploading] = useState(false);
  const initial = entry?.submission ?? {
    ...emptyWeeklySubmission(),
    items:
      phase === "report"
        ? (detail.plan?.submission.items.map((item) => ({ ...item, status: "pending" as const })) ??
          [])
        : [],
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
        toast.error("Weekly record saved, but files could not be refreshed. Reload the workspace."),
      );
      toast.success("Weekly record saved");
    },
  });
  useBlocker({
    shouldBlockFn: async () =>
      dirty &&
      !(await confirmDialog({
        title: "Discard weekly changes?",
        description: "You have unsaved changes. Leave this page and discard them?",
        confirmLabel: "Discard changes",
        destructive: true,
      })),
    enableBeforeUnload: false,
  });
  const updateItem = (id: string, value: Partial<WeeklyItem>) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...value } : item)),
    }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(true);
  };
  const reportOpen = phase !== "report" || new Date(detail.now) >= new Date(detail.reportOpensAt);
  return (
    <Card>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {phase === "plan" ? "My weekly plan" : "My weekly report"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Due {weeklyTime(detail.deadlines[phase])}, Africa/Nairobi. Saving a draft does not
            submit it.
          </p>
        </div>
        {entry?.returnComment && (
          <p className="rounded-lg border bg-muted p-3 text-sm">
            <strong>Correction requested: </strong>
            {entry.returnComment}
          </p>
        )}
        <label className="field-label">
          {phase === "plan" ? "Plan summary" : "Week summary"}
          <RichTextEditor
            value={form.summary}
            onChange={(summary) => setForm({ ...form, summary })}
          />
        </label>
        <div className="space-y-2">
          <div className="text-sm font-medium">Attachments</div>
          <p className="text-xs text-muted-foreground">
            Documents and images are private to you and the CEO. Up to 10 files, 25 MB each. Save
            the draft to remove detached files.
          </p>
          {(form.attachments ?? []).map((id) => {
            const doc = documents.find((item) => item.id === id);
            return (
              <div key={id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{doc?.name ?? "Attachment unavailable"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={mutation.isPending || uploading}
                  onClick={() => {
                    if (doc)
                      setForm((current) => ({
                        ...current,
                        attachments: (current.attachments ?? []).filter((item) => item !== id),
                      }));
                  }}
                >
                  Remove
                </Button>
              </div>
            );
          })}
          <label className="field-label w-fit">
            Add document or image
            <input
              type="file"
              className="field-input"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              disabled={(form.attachments ?? []).length >= 10 || mutation.isPending || uploading}
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                input.value = "";
                if (!file) return;
                if (file.size > 25 * 1024 * 1024) {
                  toast.error("Choose a file no larger than 25 MB.");
                  return;
                }
                if ((form.attachments ?? []).length >= 10) {
                  toast.error("A weekly submission can have up to 10 attachments.");
                  return;
                }
                const doc = documentSchema.parse({
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
                  if (await perform(() => uploadDocument(doc, file), "Attachment uploaded"))
                    setForm((current) => ({
                      ...current,
                      attachments: [...(current.attachments ?? []), doc.id],
                    }));
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={form.items.length >= 100}
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
            Add task
          </Button>
          <label className="field-label min-w-52">
            Add from my project tasks
            <select
              aria-label="Add from my project tasks"
              className="field-input"
              value=""
              onChange={(event) => {
                const task = detail.tasks.find((item) => item.id === event.target.value);
                if (task && form.items.length < 100)
                  setForm({
                    ...form,
                    items: [
                      ...form.items,
                      {
                        id: crypto.randomUUID(),
                        taskId: task.id,
                        title: task.title,
                        detail: "",
                        status: phase === "plan" ? "planned" : "pending",
                      },
                    ],
                  });
              }}
            >
              <option value="">Choose a task</option>
              {detail.tasks.map((task) => (
                <option
                  key={task.id}
                  value={task.id}
                  disabled={form.items.some((item) => item.taskId === task.id)}
                >
                  {task.title} | {task.project}
                </option>
              ))}
            </select>
          </label>
          {phase === "report" && detail.plan?.submittedAt && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setForm({
                  ...form,
                  items: [
                    ...form.items,
                    ...detail
                      .plan!.submission.items.filter(
                        (item) => !form.items.some((current) => current.id === item.id),
                      )
                      .map((item) => ({ ...item, status: "pending" as const })),
                  ],
                })
              }
            >
              Include planned tasks
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {form.items.map((item, index) => (
            <fieldset key={item.id} className="space-y-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Task {index + 1}</legend>
              <label className="field-label">
                Task title {index + 1}
                <input
                  className="field-input"
                  required
                  maxLength={200}
                  value={item.title}
                  onChange={(event) => updateItem(item.id, { title: event.target.value })}
                />
              </label>
              {phase === "report" && (
                <label className="field-label">
                  Outcome {index + 1}
                  <select
                    aria-label={`Outcome ${index + 1}`}
                    className="field-input"
                    value={item.status}
                    onChange={(event) =>
                      updateItem(item.id, { status: event.target.value as WeeklyItem["status"] })
                    }
                  >
                    {(["completed", "in_progress", "pending", "blocked", "cancelled"] as const).map(
                      (value) => (
                        <option key={value} value={value}>
                          {weeklyLabels[value]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
              <label className="field-label">
                {phase === "plan" ? "Expected result" : "Outcome notes"} {index + 1}
                <RichTextEditor
                  value={item.detail}
                  onChange={(detail) => updateItem(item.id, { detail })}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                aria-label={`Remove task ${index + 1}`}
                onClick={() =>
                  setForm({ ...form, items: form.items.filter((task) => task.id !== item.id) })
                }
              >
                Remove task
              </Button>
            </fieldset>
          ))}
        </div>
        <label className="field-label">
          No work / absence explanation
          <textarea
            aria-label="No work / absence explanation"
            className="field-input min-h-20"
            maxLength={2000}
            value={form.noWorkReason}
            onChange={(event) => setForm({ ...form, noWorkReason: event.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            Required when there are no tasks to submit.
          </span>
        </label>
        <label className="field-label">
          Blockers and support needed
          <textarea
            aria-label="Blockers and support needed"
            className="field-input min-h-24"
            maxLength={5000}
            value={form.blockers}
            onChange={(event) => setForm({ ...form, blockers: event.target.value })}
          />
        </label>
        {phase === "report" && (
          <label className="field-label">
            Carry forward / next week
            <textarea
              aria-label="Carry forward / next week"
              className="field-input min-h-24"
              maxLength={5000}
              value={form.nextWeek}
              onChange={(event) => setForm({ ...form, nextWeek: event.target.value })}
            />
          </label>
        )}
        {!reportOpen && (
          <p className="rounded-lg border p-3 text-sm">
            You can prepare a draft now. Final reporting opens {weeklyTime(detail.reportOpensAt)}.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Submitting locks this snapshot. The CEO can return it for correction. Project task
          statuses are kept separately.
        </p>
        {mutation.error && (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{mutation.error.message}</p>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (
                  !dirty ||
                  (await confirmDialog({
                    title: "Reload saved version?",
                    description: "This will discard your unsaved weekly changes.",
                    confirmLabel: "Reload",
                    destructive: true,
                  }))
                )
                  onReload();
              }}
            >
              Reload saved version
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending || uploading}
            onClick={() => mutation.mutate(false)}
          >
            Save draft
          </Button>
          <Button disabled={mutation.isPending || uploading || !reportOpen}>
            {phase === "plan" ? "Submit weekly plan" : "Submit weekly report"}
          </Button>
          {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          {(mutation.isPending || uploading) && (
            <span role="status" className="text-sm">
              {uploading ? "Uploading attachment..." : "Saving..."}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
