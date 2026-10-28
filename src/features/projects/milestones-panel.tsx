import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import {
  useCreateMilestone,
  useDeleteMilestone,
  useUpdateMilestone,
  type Milestone,
} from "@/features/projects/use-projects";

const today = () => new Date().toISOString().slice(0, 10);

/** The key dates in a project: add, tick off, reopen or remove them. */
export function MilestonesPanel({
  projectId,
  milestones,
  canManage,
}: {
  projectId: string;
  milestones: Milestone[];
  canManage: boolean;
}) {
  const create = useCreateMilestone(projectId);
  const update = useUpdateMilestone(projectId);
  const remove = useDeleteMilestone(projectId);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(today());
  const [errors, setErrors] = useState<{ title?: string; dueDate?: string }>({});
  const sorted = [...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const { guardClose } = useUnsavedChanges(adding && (!!title.trim() || dueDate !== today()));

  const closeForm = () => {
    setAdding(false);
    setTitle("");
    setDueDate(today());
    setErrors({});
  };

  const save = async () => {
    const next = {
      title: title.trim() ? undefined : "Name the milestone, e.g. “Shortlist sent to client”.",
      dueDate: dueDate ? undefined : "Choose the date it's due.",
    };
    setErrors(next);
    if (next.title || next.dueDate) return;
    try {
      await create.mutateAsync({ title: title.trim(), dueDate });
      toast.success("Milestone added");
      closeForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the milestone");
    }
  };

  const toggle = (m: Milestone) =>
    update.mutate(
      { id: m.id, isComplete: !m.is_complete },
      {
        onSuccess: () =>
          toast.success(m.is_complete ? "Milestone reopened" : "Milestone marked as done"),
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Couldn't update the milestone"),
      },
    );

  const del = async (m: Milestone) => {
    const ok = await confirmDialog({
      title: `Delete "${m.title}"?`,
      description: "The milestone is removed from this project's timeline.",
      confirmLabel: "Delete milestone",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(m.id, {
      onSuccess: () => toast.success("Milestone deleted"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't delete the milestone"),
    });
  };

  return (
    <div className="ws-panel">
      <div className="flex items-center justify-between gap-2">
        <h3>Milestones</h3>
        {canManage && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add milestone
          </Button>
        )}
      </div>

      {adding && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="mt-3 grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_11rem_auto] sm:items-start"
        >
          <FormField id={`ms-title-${projectId}`} label="Milestone" required error={errors.title}>
            <Input
              id={`ms-title-${projectId}`}
              value={title}
              autoFocus
              placeholder="e.g. Shortlist sent to client"
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={!!errors.title}
            />
          </FormField>
          <FormField id={`ms-due-${projectId}`} label="Due date" required error={errors.dueDate}>
            <Input
              id={`ms-due-${projectId}`}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-invalid={!!errors.dueDate}
            />
          </FormField>
          <div className="flex gap-2 sm:pt-6">
            <Button type="button" size="sm" variant="outline" onClick={() => guardClose(closeForm)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Save milestone
            </Button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {canManage
            ? "No milestones yet. Add the key dates this project must hit."
            : "No milestones yet."}
        </p>
      ) : (
        <ul className="mt-2 divide-y">
          {sorted.map((m) => {
            const late = !m.is_complete && m.due_date.slice(0, 10) < today();
            return (
              <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
                {canManage ? (
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-primary"
                    onClick={() => toggle(m)}
                    aria-label={m.is_complete ? `Reopen ${m.title}` : `Mark ${m.title} as done`}
                  >
                    {m.is_complete ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </button>
                ) : m.is_complete ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Done" />
                ) : (
                  <Circle
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-label="Not done"
                  />
                )}
                <span
                  className={cn(
                    "min-w-0 flex-1",
                    m.is_complete && "text-muted-foreground line-through",
                  )}
                >
                  {m.title}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-xs",
                    late ? "font-medium text-destructive" : "text-muted-foreground",
                  )}
                >
                  {late ? `Late · was due ${formatDate(m.due_date)}` : formatDate(m.due_date)}
                </span>
                {canManage && (
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    onClick={() => del(m)}
                    aria-label={`Delete milestone ${m.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
