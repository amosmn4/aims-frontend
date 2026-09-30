import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Diamond, Loader2, Plus, X } from "lucide-react";
import {
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  type Task,
  type Milestone,
} from "@/features/projects/use-projects";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Date-scaled timeline: task bars and milestone markers across the project's dates.
export function ProjectTimeline({
  projectId,
  tasks,
  canManage = false,
}: {
  projectId: string;
  tasks: Task[];
  canManage?: boolean;
}) {
  const milestonesQ = useMilestones(projectId);
  const [adding, setAdding] = useState(false);

  const dated = tasks.filter((t) => t.start_date || t.due_date);
  const milestoneDates = (milestonesQ.data ?? []).map((m) => new Date(m.due_date).getTime());
  const taskDates = dated.flatMap((t) =>
    [t.start_date, t.due_date].filter(Boolean).map((d) => new Date(d as string).getTime()),
  );
  const allDates = [...taskDates, ...milestoneDates];

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (allDates.length === 0) {
      const now = Date.now();
      return { rangeStart: now, rangeEnd: now + 30 * 86400000 };
    }
    const min = Math.min(...allDates);
    const max = Math.max(...allDates);
    const pad = Math.max((max - min) * 0.05, 3 * 86400000);
    return { rangeStart: min - pad, rangeEnd: max + pad };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDates.join(",")]);

  const span = Math.max(rangeEnd - rangeStart, 1);
  const pct = (t: number) => ((t - rangeStart) / span) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Timeline</h3>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add milestone
          </Button>
        )}
      </div>

      {milestonesQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : milestonesQ.isError ? (
        <LoadError
          what="milestones"
          error={milestonesQ.error}
          onRetry={() => milestonesQ.refetch()}
        />
      ) : (milestonesQ.data ?? []).length === 0 && dated.length === 0 ? (
        <div className="rounded-lg border bg-card py-10 text-center text-sm text-muted-foreground">
          Nothing to show yet. Give tasks due dates, or add a milestone.
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 overflow-x-auto">
          <div className="min-w-150">
            {(milestonesQ.data ?? []).length > 0 && (
              <div className="relative h-12 mb-2 border-b">
                {(milestonesQ.data ?? []).map((m) => (
                  <MilestoneMarker
                    key={m.id}
                    projectId={projectId}
                    milestone={m}
                    pct={pct}
                    canManage={canManage}
                  />
                ))}
              </div>
            )}

            <div className="space-y-2">
              {dated.map((t) => {
                const start = t.start_date ? new Date(t.start_date).getTime() : undefined;
                const end = t.due_date ? new Date(t.due_date).getTime() : start;
                if (!end) return null;
                const barStart = start ?? end;
                const left = pct(barStart);
                const width = Math.max(pct(end) - left, 1.5);
                return (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <div className="w-40 shrink-0">
                      <div className="truncate">{t.title}</div>
                      <div className="text-muted-foreground">
                        {t.start_date ? `${formatDate(t.start_date)} → ` : ""}
                        {formatDate(t.due_date, "no due date")}
                      </div>
                    </div>
                    <div className="relative h-5 flex-1 rounded bg-secondary/50">
                      <div
                        className={`absolute h-full rounded ${
                          t.status === "completed"
                            ? "bg-success/70"
                            : t.status === "blocked"
                              ? "bg-destructive/60"
                              : "bg-primary/60"
                        }`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {adding && <NewMilestoneDialog projectId={projectId} onClose={() => setAdding(false)} />}
    </div>
  );
}

function MilestoneMarker({
  projectId,
  milestone,
  pct,
  canManage,
}: {
  projectId: string;
  milestone: Milestone;
  pct: (t: number) => number;
  canManage: boolean;
}) {
  const updateMilestone = useUpdateMilestone(projectId);
  const deleteMilestone = useDeleteMilestone(projectId);
  const left = pct(new Date(milestone.due_date).getTime());
  const label = `${milestone.title}, due ${formatDate(milestone.due_date)}`;

  return (
    <div
      className="absolute -translate-x-1/2 flex flex-col items-center"
      style={{ left: `${left}%` }}
    >
      {canManage ? (
        <button
          type="button"
          onClick={() =>
            updateMilestone.mutate({ id: milestone.id, isComplete: !milestone.is_complete })
          }
          aria-label={
            milestone.is_complete ? `Reopen milestone ${label}` : `Mark milestone ${label} as done`
          }
        >
          <Diamond
            className={`h-3.5 w-3.5 ${milestone.is_complete ? "fill-success text-success" : "fill-primary text-primary"}`}
          />
        </button>
      ) : (
        <Diamond
          aria-label={label}
          className={`h-3.5 w-3.5 ${milestone.is_complete ? "fill-success text-success" : "fill-primary text-primary"}`}
        />
      )}
      <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
        {milestone.title} · {formatDate(milestone.due_date)}
      </span>
      {canManage && (
        <button
          type="button"
          onClick={async () => {
            const ok = await confirmDialog({
              title: `Delete milestone "${milestone.title}"?`,
              description: "The milestone will be removed from this project's timeline.",
              confirmLabel: "Delete milestone",
              destructive: true,
            });
            if (ok) deleteMilestone.mutate(milestone.id);
          }}
          className="mt-0.5 rounded text-muted-foreground hover:text-destructive"
          aria-label={`Delete milestone ${milestone.title}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function NewMilestoneDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const createMilestone = useCreateMilestone(projectId);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [errors, setErrors] = useState<{ title?: string; dueDate?: string }>({});
  const { guardClose } = useUnsavedChanges(!!title.trim() || !!dueDate);

  const submit = () => {
    const found = {
      title: title.trim() ? undefined : "Name the milestone.",
      dueDate: dueDate ? undefined : "Choose the date it's due.",
    };
    setErrors(found);
    if (found.title || found.dueDate) return;
    createMilestone.mutate(
      { title: title.trim(), dueDate },
      {
        onSuccess: () => {
          toast.success("Milestone added");
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>New milestone</DialogTitle>
            <RequiredNote />
          </DialogHeader>
          <div className="space-y-3">
            <FormField id="timeline-ms-title" label="Title" required error={errors.title}>
              <Input
                id="timeline-ms-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={!!errors.title}
              />
            </FormField>
            <FormField id="timeline-ms-due" label="Due date" required error={errors.dueDate}>
              <Input
                id="timeline-ms-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-invalid={!!errors.dueDate}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMilestone.isPending}>
              {createMilestone.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add milestone
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
