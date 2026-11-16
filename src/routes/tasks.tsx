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
  const { tasks, projects, documents, person, project } = useWorkspace();
  const [edit, setEdit] = useState<Task | "new" | null>(null);
  const [commenting, setCommenting] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const list = tasks.filter(
    (task) =>
      (mode === "ceo" ||
        (mode === "department"
          ? person(task.assignee).dept === me.dept
          : task.assignee === me.id)) &&
      task.title.toLowerCase().includes(search.toLowerCase()),
  );
  const canCreate = mode === "ceo" || projects.some((project) => project.members.includes(me.id));
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
                    task.assignee === me.id ||
                    project(task.project)?.lead === me.id;
                  const attachments = documents.filter((doc) => doc.task === task.id);
                  const canAttach =
                    mode === "ceo" || project(task.project)?.members.includes(me.id);
                  return (
                    <Card key={task.id} className="p-4">
                      <div className="font-medium">{task.title}</div>
                      <Link
                        to="/projects/$id"
                        params={{ id: task.project }}
                        className="mt-1 block text-xs text-primary"
                      >
                        {project(task.project)?.name}
                      </Link>
                      {task.description && (
                        <SafeHtml html={task.description} className="blog-content mt-2 text-sm" />
                      )}
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
                              <input
                                type="file"
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
                                    access: "project",
                                    owner: me.id,
                                    updated: today(),
                                    project: task.project,
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
                          {(mode === "ceo" || project(task.project)?.lead === me.id) && (
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
