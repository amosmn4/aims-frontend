import { UploadField } from "@/components/UploadField";
import { SubtaskChecklist } from "@/components/SubtaskChecklist";
import { reportingWeek } from "@/lib/weekly";
import { useBusinessAccess } from "@/lib/access";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader, Pill, fmtDate } from "@/components/kit";
import { EmptyState, RecordActions, SearchField } from "@/components/RecordDialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskForm } from "@/components/WorkspaceForms";
import { useRole } from "@/lib/role";
import { commentTask, perform, saveRecord, useWorkspace } from "@/lib/workspace";
import type { Task } from "@/lib/data";
import { documentSchema } from "@/lib/models";
import { today } from "@/lib/access";
import {
  deleteFile,
  documentBlob,
  downloadBlob,
  saveFile,
  uploadDocument,
} from "@/lib/file-storage";
import { isDemo } from "@/lib/api";
import { meta } from "@/lib/meta";
import { SafeHtml } from "@/production/components/safe-html";

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: meta("Tasks", "Track and update Amsol project tasks.") }),
  component: Tasks,
});
const cols = ["To do", "In progress", "Done"] as const;

function Tasks() {
  const { mode, me } = useRole();
  const { tasks, projects, documents, businesses, person, project } = useWorkspace();
  const access = useBusinessAccess();
  const manages = (task: Task) =>
    !!access.permissions?.some(
      (grant) => grant.business === (task.business ?? "b0") && grant.manage,
    );
  const [edit, setEdit] = useState<Task | "new" | null>(null);
  const [commenting, setCommenting] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [week, setWeek] = useState("");
  const [source, setSource] = useState("");
  const [priority, setPriority] = useState("");
  const [staff, setStaff] = useState("");
  const [business, setBusiness] = useState("");
  const list = tasks.filter(
    (task) =>
      (mode === "ceo" ||
        manages(task) ||
        (mode === "department"
          ? person(task.assignee).dept === me.dept
          : task.assignee === me.id)) &&
      (!week ||
        task.weekStart === week ||
        (!task.weekStart &&
          task.due >= week &&
          task.due <=
            new Date(new Date(`${week}T12:00:00Z`).getTime() + 6 * 86400000)
              .toISOString()
              .slice(0, 10))) &&
      (!source || task.source === source) &&
      (!priority || task.priority === priority) &&
      (!staff || task.assignee === staff) &&
      (!business || (task.business ?? "b0") === business) &&
      `${task.title} ${task.description ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const canCreate = true;
  return (
    <div>
      <PageHeader
        title={
          mode === "ceo" ? "All tasks" : mode === "department" ? "Department tasks" : "My tasks"
        }
        subtitle="Assign work and track it through completion"
        action={
          canCreate && (
            <button className="action-button" onClick={() => setEdit("new")}>
              New task
            </button>
          )
        }
      />
      <SearchField value={search} onChange={setSearch} placeholder="Search tasks" />
      <div className="mb-5 flex flex-wrap gap-3">
        <label className="field-label">
          Week
          <input
            className="field-input"
            type="date"
            value={week}
            onChange={(event) =>
              setWeek(
                event.target.value
                  ? reportingWeek(new Date(`${event.target.value}T12:00:00Z`))
                  : "",
              )
            }
          />
        </label>
        <label className="field-label">
          Work type
          <select
            className="field-input"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="">All</option>
            {["planned", "ad_hoc", "contingency", "project"].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Priority
          <select
            className="field-input"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="">All</option>
            {["Urgent", "High", "Medium", "Low"].map((value) => (
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
            <option value="">All assigned businesses</option>
            {businesses.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        {mode === "ceo" && (
          <label className="field-label">
            Staff
            <select
              className="field-input"
              value={staff}
              onChange={(event) => setStaff(event.target.value)}
            >
              <option value="">All staff</option>
              {[...new Set(tasks.map((task) => task.assignee))].map((id) => (
                <option key={id} value={id}>
                  {person(id).name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {cols.map((status) => (
          <section key={status}>
            <div className="mb-3 flex items-center justify-between text-sm font-semibold">
              {status}
              <Pill>{list.filter((task) => task.status === status).length}</Pill>
            </div>
            <div className="space-y-3">
              {!list.some((task) => task.status === status) && (
                <EmptyState>No tasks in this column.</EmptyState>
              )}
              {list
                .filter((task) => task.status === status)
                .map((task) => {
                  const editable =
                    mode === "ceo" ||
                    manages(task) ||
                    task.assignee === me.id ||
                    project(task.project)?.lead === me.id;
                  const attachments = documents.filter((doc) => doc.task === task.id);
                  const canAttach =
                    mode === "ceo" ||
                    (!task.project && task.assignee === me.id) ||
                    project(task.project)?.members.includes(me.id);
                  return (
                    <Card key={task.id} className="p-4">
                      <div className="font-medium">{task.title}</div>
                      {task.project ? (
                        <Link
                          to="/projects/$id"
                          params={{ id: task.project }}
                          className="mt-1 block text-xs text-primary"
                        >
                          {project(task.project)?.name}
                        </Link>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.source?.replaceAll("_", " ") ?? "Weekly work"}
                          {task.weekStart ? ` | Week of ${task.weekStart}` : ""}
                        </p>
                      )}
                      {task.description && (
                        <SafeHtml html={task.description} className="blog-content mt-2 text-sm" />
                      )}
                      <SubtaskChecklist
                        key={`${task.id}:${JSON.stringify(task.subtasks)}`}
                        task={task}
                        editable={editable}
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{person(task.assignee).name}</span>
                        <span className="flex gap-2">
                          <Pill tone={task.priority === "High" ? "accent" : "muted"}>
                            {task.priority}
                          </Pill>
                          {fmtDate(task.due)}
                        </span>
                      </div>
                      {task.ceoComment && (
                        <div className="mt-3 rounded-md border-l-2 border-primary bg-muted/50 p-3 text-sm">
                          <div className="mb-1 text-xs font-semibold text-muted-foreground">
                            CEO comment
                          </div>
                          <p className="whitespace-pre-wrap">{task.ceoComment}</p>
                        </div>
                      )}
                      {(attachments.length > 0 || canAttach) && (
                        <div className="mt-3 space-y-2 border-t pt-3">
                          {attachments.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              className="block text-left text-xs text-primary underline"
                              onClick={async () => {
                                try {
                                  downloadBlob(await documentBlob(doc), doc.name);
                                } catch (error) {
                                  toast.error(
                                    error instanceof Error ? error.message : "Download failed.",
                                  );
                                }
                              }}
                            >
                              {doc.name}
                            </button>
                          ))}
                          {canAttach && (
                            <label className="inline-flex cursor-pointer items-center text-xs font-medium text-primary underline">
                              Attach document or image
                              <UploadField
                                className="sr-only"
                                aria-label={`Attach document or image to ${task.title}`}
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
                                  const fileKey = crypto.randomUUID();
                                  const doc = documentSchema.parse({
                                    id: crypto.randomUUID(),
                                    name: file.name,
                                    folder: "Task attachments",
                                    access: task.project ? "project" : "restricted",
                                    allowed: task.project ? undefined : [me.id],
                                    owner: me.id,
                                    updated: today(),
                                    project: task.project || undefined,
                                    task: task.id,
                                    fileKey,
                                    mime: file.type || "application/octet-stream",
                                  });
                                  await perform(async () => {
                                    if (!isDemo) return uploadDocument(doc, file);
                                    await saveFile(fileKey, file);
                                    try {
                                      await saveRecord("documents", doc);
                                    } catch (error) {
                                      await deleteFile(fileKey).catch(() => {});
                                      throw error;
                                    }
                                  }, "Attachment uploaded");
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                      {editable && (
                        <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
                          <select
                            aria-label={`Status for ${task.title}`}
                            className="field-input w-auto py-1"
                            value={task.status}
                            onChange={(event) =>
                              perform(() =>
                                saveRecord("tasks", {
                                  ...task,
                                  status: event.target.value as Task["status"],
                                }),
                              )
                            }
                          >
                            {cols.map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                          {(mode === "ceo" ||
                            manages(task) ||
                            project(task.project)?.lead === me.id ||
                            (!task.project && task.assignee === me.id)) && (
                            <RecordActions
                              collection="tasks"
                              id={task.id}
                              label={task.title}
                              onEdit={() => setEdit(task)}
                            />
                          )}
                        </div>
                      )}
                      {mode === "ceo" && (
                        <button
                          type="button"
                          className="mt-3 text-xs font-medium text-primary underline"
                          onClick={() => setCommenting(task)}
                        >
                          {task.ceoComment ? "Edit CEO comment" : "Add CEO comment"}
                        </button>
                      )}
                    </Card>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
      {edit && (
        <TaskForm record={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />
      )}
      {commenting && <TaskCommentDialog task={commenting} onClose={() => setCommenting(null)} />}
    </div>
  );
}

function TaskCommentDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const [comment, setComment] = useState(task.ceoComment ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>CEO comment</DialogTitle>
          <DialogDescription>{task.title}</DialogDescription>
        </DialogHeader>
        <label className="field-label">
          Comment
          <textarea
            className="field-input min-h-32"
            maxLength={10000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const saved = await perform(() => commentTask(task.id, comment), "CEO comment saved");
              setSaving(false);
              if (saved) onClose();
            }}
          >
            Save comment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
