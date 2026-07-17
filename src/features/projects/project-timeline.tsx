import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Diamond, Loader2, Plus } from "lucide-react";
import {
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  type Task,
  type Milestone,
} from "@/features/projects/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// A lightweight date-scaled timeline — task bars + milestone markers positioned
// proportionally across the project's date span. Dependencies/drag-resize are Phase 3 (Gantt).
export function ProjectTimeline({ projectId, tasks }: { projectId: string; tasks: Task[] }) {
  const milestonesQ = useMilestones(projectId);

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
        <h3 className="text-sm font-semibold">Milestones</h3>
        <NewMilestoneDialog projectId={projectId} />
      </div>

      {milestonesQ.isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (milestonesQ.data ?? []).length === 0 && dated.length === 0 ? (
        <div className="rounded-lg border bg-card py-10 text-center text-sm text-muted-foreground">
          No dated tasks or milestones yet — add due dates to tasks or create a milestone to see the
          timeline.
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 overflow-x-auto">
          <div className="min-w-150">
            {/* Milestone marker row */}
            {(milestonesQ.data ?? []).length > 0 && (
              <div className="relative h-8 mb-2 border-b">
                {(milestonesQ.data ?? []).map((m) => (
                  <MilestoneMarker key={m.id} projectId={projectId} milestone={m} pct={pct} />
                ))}
              </div>
            )}

            {/* Task bars */}
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
                    <div className="w-40 truncate shrink-0">{t.title}</div>
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
                        title={`${t.start_date ?? t.due_date} → ${t.due_date}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MilestoneMarker({
  projectId,
  milestone,
  pct,
}: {
  projectId: string;
  milestone: Milestone;
  pct: (t: number) => number;
}) {
  const updateMilestone = useUpdateMilestone(projectId);
  const deleteMilestone = useDeleteMilestone(projectId);
  const left = pct(new Date(milestone.due_date).getTime());

  return (
    <div
      className="absolute -translate-x-1/2 flex flex-col items-center group"
      style={{ left: `${left}%` }}
    >
      <button
        onClick={() =>
          updateMilestone.mutate({ id: milestone.id, isComplete: !milestone.is_complete })
        }
        title={`${milestone.title} — ${milestone.due_date}`}
      >
        <Diamond
          className={`h-3.5 w-3.5 ${milestone.is_complete ? "fill-success text-success" : "fill-primary text-primary"}`}
        />
      </button>
      <span className="text-[0.5625rem] text-muted-foreground whitespace-nowrap mt-0.5">
        {milestone.title}
      </span>
      <button
        onClick={() => deleteMilestone.mutate(milestone.id)}
        className="text-[0.5625rem] text-destructive opacity-0 group-hover:opacity-100"
      >
        remove
      </button>
    </div>
  );
}

function NewMilestoneDialog({ projectId }: { projectId: string }) {
  const createMilestone = useCreateMilestone(projectId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  const submit = () => {
    if (!title.trim() || !dueDate) {
      toast.error("Title and due date are required");
      return;
    }
    createMilestone.mutate(
      { title: title.trim(), dueDate },
      {
        onSuccess: () => {
          toast.success("Milestone added");
          setOpen(false);
          setTitle("");
          setDueDate("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Milestone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New milestone</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={createMilestone.isPending}>
            {createMilestone.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add milestone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
