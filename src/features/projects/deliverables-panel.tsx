import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import {
  DELIVERABLE_STATUS_LABELS,
  DELIVERABLE_STATUS_TONE,
  isDeliverableLate,
  useCreateDeliverable,
  useDeleteDeliverable,
  useDeliverables,
  useUpdateDeliverable,
  type Deliverable,
  type DeliverableStatus,
} from "@/features/projects/use-projects";

const today = () => new Date().toISOString().slice(0, 10);

/** What the project owes the client: log each one and move it to Delivered. */
export function DeliverablesPanel({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const deliverablesQ = useDeliverables(projectId);
  const create = useCreateDeliverable(projectId);
  const update = useUpdateDeliverable(projectId);
  const remove = useDeleteDeliverable(projectId);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const { guardClose } = useUnsavedChanges(
    adding && (!!title.trim() || !!dueDate || !!notes.trim()),
  );

  const items = deliverablesQ.data ?? [];
  const done = items.filter((d) => d.status === "delivered").length;

  const closeForm = () => {
    setAdding(false);
    setTitle("");
    setDueDate("");
    setNotes("");
    setError(undefined);
  };

  const save = async () => {
    if (!title.trim()) {
      setError("Say what will be delivered, e.g. “Shortlist of 5 candidates”.");
      return;
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        dueDate: dueDate || undefined,
        description: notes.trim() || undefined,
      });
      toast.success("Deliverable added");
      closeForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the deliverable");
    }
  };

  const setStatus = (d: Deliverable, status: DeliverableStatus) =>
    update.mutate(
      { id: d.id, status },
      {
        onSuccess: () => toast.success(`Marked ${DELIVERABLE_STATUS_LABELS[status].toLowerCase()}`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update it"),
      },
    );

  const del = async (d: Deliverable) => {
    const ok = await confirmDialog({
      title: `Delete "${d.title}"?`,
      description: "The deliverable is removed from this project.",
      confirmLabel: "Delete deliverable",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(d.id, {
      onSuccess: () => toast.success("Deliverable deleted"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't delete it"),
    });
  };

  return (
    <div className="ws-panel">
      <div className="flex items-center justify-between gap-2">
        <h3>
          Deliverables
          {items.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {done} of {items.length} delivered
            </span>
          )}
        </h3>
        {canManage && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add deliverable
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
          className="mt-3 space-y-3 rounded-md border p-3"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
            <FormField id={`dl-title-${projectId}`} label="Deliverable" required error={error}>
              <Input
                id={`dl-title-${projectId}`}
                value={title}
                autoFocus
                placeholder="e.g. Shortlist of 5 candidates"
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={!!error}
              />
            </FormField>
            <FormField id={`dl-due-${projectId}`} label="Due date">
              <Input
                id={`dl-due-${projectId}`}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </FormField>
          </div>
          <FormField id={`dl-notes-${projectId}`} label="Notes">
            <Textarea
              id={`dl-notes-${projectId}`}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => guardClose(closeForm)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Save deliverable
            </Button>
          </div>
        </form>
      )}

      {deliverablesQ.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : deliverablesQ.isError ? (
        <LoadError
          what="deliverables"
          error={deliverablesQ.error}
          onRetry={() => deliverablesQ.refetch()}
        />
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {canManage
            ? "No deliverables yet. Add what this project must hand over to the client."
            : "No deliverables logged yet."}
        </p>
      ) : (
        <ul className="mt-2 divide-y">
          {items.map((d) => {
            const late = isDeliverableLate(d);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "font-medium",
                      d.status === "delivered" && "text-muted-foreground line-through",
                    )}
                  >
                    {d.title}
                  </div>
                  {d.description && (
                    <div className="whitespace-pre-line text-xs text-muted-foreground">
                      {d.description}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    "whitespace-nowrap text-xs",
                    late ? "font-medium text-destructive" : "text-muted-foreground",
                  )}
                >
                  {d.status === "delivered" && d.delivered_at
                    ? `Delivered ${formatDate(d.delivered_at)}`
                    : d.due_date
                      ? late
                        ? `Late · was due ${formatDate(d.due_date)}`
                        : `Due ${formatDate(d.due_date)}`
                      : "No due date"}
                </span>
                {canManage ? (
                  <Select
                    value={d.status}
                    disabled={update.isPending}
                    onValueChange={(v) => setStatus(d, v as DeliverableStatus)}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs" aria-label={`Status of ${d.title}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DELIVERABLE_STATUS_LABELS).map(([v, label]) => (
                        <SelectItem key={v} value={v}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      DELIVERABLE_STATUS_TONE[d.status],
                    )}
                  >
                    {DELIVERABLE_STATUS_LABELS[d.status]}
                  </span>
                )}
                {canManage && (
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    onClick={() => del(d)}
                    aria-label={`Delete deliverable ${d.title}`}
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
