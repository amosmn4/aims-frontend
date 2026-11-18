import { useState } from "react";
import { useRole } from "@/lib/role";
import { useWorkspace, saveRecord, perform } from "@/lib/workspace";
import { reportSchema, documentSchema } from "@/lib/models";
import type { Report } from "@/lib/data";
import { today } from "@/lib/access";
import { isDemo } from "@/lib/api";
import { uploadDocument } from "@/lib/file-storage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { UploadField } from "./UploadField";
import { SubmissionSchedule } from "./SubmissionSchedule";

export function MonthlyReportEditor({
  record,
  onClose,
}: {
  record?: Report | undefined;
  onClose: () => void;
}) {
  const { me } = useRole();
  const { tasks, businesses, documents, templates } = useWorkspace();
  const [templateId, setTemplateId] = useState("");
  const template = templates.find((row) => row.id === templateId);
  const [id] = useState(record?.id ?? crypto.randomUUID());
  const [month, setMonth] = useState(
    record?.month ?? record?.date.slice(0, 7) ?? today().slice(0, 7),
  );
  const [title, setTitle] = useState(record?.title ?? `Monthly report | ${month}`);
  const [type, setType] = useState<Report["type"]>(record?.type ?? "Monthly");
  const [business, setBusiness] = useState(record?.business ?? "b0");
  const [progress, setProgress] = useState(record?.progress ?? "");
  const [blockers, setBlockers] = useState(record?.blockers ?? "");
  const [next, setNext] = useState(record?.next ?? "");
  const inMonth = (row: (typeof tasks)[number], value: string) =>
    row.assignee === me.id && (row.due.startsWith(value) || row.weekStart?.startsWith(value));
  const [selected, setSelected] = useState(
    record?.taskIds ?? tasks.filter((row) => inMonth(row, month)).map((row) => row.id),
  );
  const [attachments, setAttachments] = useState(record?.attachments ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitted = record?.status !== "draft" && !!record;
  const relevant = tasks.filter(
    (row) => inMonth(row, month) || (row.assignee === me.id && selected.includes(row.id)),
  );
  const save = async (status: "draft" | "submitted", files = attachments) => {
    if (!me.dept) throw new Error("Your account needs a department before submitting a report.");
    if (status === "submitted" && !progress.trim())
      throw new Error("Add your progress before submitting.");
    await saveRecord(
      "reports",
      reportSchema.parse({
        ...record,
        id,
        title,
        month,
        type,
        business,
        dept: record?.dept ?? me.dept,
        author: me.id,
        date: record?.date ?? today(),
        progress,
        blockers,
        next,
        reviewed: false,
        status,
        taskIds: selected,
        attachments: files,
      }),
    );
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "Edit report" : "Monthly report"}</DialogTitle>
          <DialogDescription>
            Include your planned, ad hoc and contingency work. Recorded leave is included
            automatically.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              await save("submitted");
              onClose();
            } catch (error) {
              setError(error instanceof Error ? error.message : "Report could not be submitted.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="field-label">
              Reporting month
              <input
                className="field-input"
                type="month"
                required
                value={month}
                onChange={(event) => {
                  const value = event.target.value;
                  setMonth(value);
                  setSelected(tasks.filter((row) => inMonth(row, value)).map((row) => row.id));
                }}
              />
            </label>
            <label className="field-label">
              Type
              <select
                className="field-input"
                value={type}
                onChange={(event) => setType(event.target.value as Report["type"])}
              >
                {[
                  "Monthly",
                  "Ad-hoc",
                  ...(record && !["Monthly", "Ad-hoc"].includes(record.type) ? [record.type] : []),
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Business
              <select
                className="field-input"
                value={business}
                onChange={(event) => setBusiness(event.target.value)}
              >
                {businesses.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field-label">
            Report title
            <input
              className="field-input"
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          {!!templates.length && (
            <label className="field-label">
              Template
              <select
                className="field-input"
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
              >
                <option value="">Default monthly report</option>
                {templates.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field-label">
            {template?.progress ?? "Progress and results"}
            <textarea
              className="field-input min-h-32"
              maxLength={10000}
              value={progress}
              onChange={(event) => setProgress(event.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              {template?.blockers ?? "Blockers and support"}
              <textarea
                className="field-input min-h-24"
                maxLength={10000}
                value={blockers}
                onChange={(event) => setBlockers(event.target.value)}
              />
            </label>
            <label className="field-label">
              {template?.next ?? "Next steps"}
              <textarea
                className="field-input min-h-24"
                maxLength={10000}
                value={next}
                onChange={(event) => setNext(event.target.value)}
              />
            </label>
          </div>
          <fieldset className="rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Tasks for this month</legend>
            <p className="mb-3 text-xs text-muted-foreground">
              Task outcomes and subtasks are saved with the report.
            </p>
            {!relevant.length && <p className="text-sm">No tasks are recorded for this period.</p>}
            {relevant.map((task) => (
              <label key={task.id} className="flex gap-3 border-t py-3 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(task.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, task.id]
                        : selected.filter((value) => value !== task.id),
                    )
                  }
                />
                <span>
                  <span className="font-medium">{task.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {task.status} | {task.source?.replaceAll("_", " ") ?? "project"}
                    {task.subtasks?.length
                      ? ` | ${task.subtasks.filter((item) => item.done).length}/${task.subtasks.length} subtasks`
                      : ""}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-2 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Attachments</h3>
            {attachments.map((value) => (
              <div key={value} className="flex items-center justify-between gap-2 text-sm">
                <span>{documents.find((doc) => doc.id === value)?.name ?? "Attachment"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setAttachments(attachments.filter((id) => id !== value))}
                >
                  Remove from report
                </Button>
              </div>
            ))}
            {!isDemo && (
              <UploadField
                aria-label="Upload report attachment"
                busy={busy}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  setError("");
                  try {
                    if (file.size > 25 * 1024 * 1024) throw new Error("Choose a file up to 25 MB.");
                    await save(submitted ? "submitted" : "draft");
                    const docId = crypto.randomUUID();
                    await uploadDocument(
                      documentSchema.parse({
                        id: docId,
                        name: file.name,
                        folder: "Monthly reports",
                        access: "restricted",
                        owner: me.id,
                        allowed: [me.id],
                        report: id,
                        updated: today(),
                      }),
                      file,
                    );
                    const files = [...attachments, docId];
                    setAttachments(files);
                    await save(submitted ? "submitted" : "draft", files);
                  } catch (error) {
                    setError(error instanceof Error ? error.message : "Upload failed.");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Close
            </Button>
            {!submitted && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await perform(() => save("draft"), "Draft saved");
                  setBusy(false);
                }}
              >
                Save draft
              </Button>
            )}
            <Button disabled={busy}>{submitted ? "Save report" : "Submit report"}</Button>
          </div>
        </form>
        {!submitted && (
          <SubmissionSchedule
            kind="monthly"
            target={id}
            saveDraft={() => save("draft")}
            disabled={busy}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
