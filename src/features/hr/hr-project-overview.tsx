import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, CheckCircle2, Loader2, Plus, Repeat } from "lucide-react";
import {
  useCreateTask,
  useUpdateProject,
  isTaskOverdue,
  taskCompletion,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type Milestone,
  type Project,
  type ProjectStatus,
  type Task,
} from "@/features/projects/use-projects";
import { ClientContractPanel } from "@/features/projects/client-contract-panel";
import { RecruitmentFunnelPanel } from "@/features/hr/recruitment-funnel-panel";
import { RecruitmentPlacementsPanel } from "@/features/hr/recruitment-placements-panel";
import { RECRUITMENT_SERVICE_LINE } from "@/features/hr/use-recruitment";
import { TimelinePanel } from "@/components/project-workspace/overview-tab";
import { formatDate } from "@/lib/format-date";
import { StaffSelect, useStaffOptions } from "@/features/projects/staff-picker";
import { daysLeft } from "@/features/project-workspace/workspace-calcs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MilestonesPanel } from "@/features/projects/milestones-panel";

/** Plain-language project home for HR: what's done, what's late, who the client is, what's next. */
export function HrProjectOverview({
  project,
  tasks,
  milestones,
  canManage,
  onOpenTask,
  onViewTasks,
}: {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
  canManage: boolean;
  onOpenTask: (taskId: string) => void;
  onViewTasks: () => void;
}) {
  const update = useUpdateProject();
  const { nameOf } = useStaffOptions();
  const done = tasks.filter((t) => t.status === "completed").length;
  const pct = taskCompletion(tasks);
  const overdue = tasks.filter((t) => isTaskOverdue(t));
  const recurring = project.engagement_type === "ongoing";
  const left = recurring ? null : daysLeft(project.end_date);
  const upcoming = tasks
    .filter((t) => t.status !== "completed")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 5);

  return (
    <div className="space-y-3.5">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="ws-panel !mt-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Progress
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{pct}%</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            {tasks.length === 0 ? "No tasks yet" : `${done} of ${tasks.length} tasks done`}
          </div>
        </div>

        <div className={cn("ws-panel !mt-0", overdue.length > 0 && "border-destructive/40")}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> Overdue tasks
          </div>
          <div
            className={cn(
              "mt-2 text-2xl font-semibold tabular-nums",
              overdue.length > 0 && "text-destructive",
            )}
          >
            {overdue.length}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            {overdue.length === 0 ? "Nothing is late" : `Oldest: ${overdue[0].title}`}
          </div>
        </div>

        <div className="ws-panel !mt-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {recurring ? (
              <Repeat className="h-3.5 w-3.5" />
            ) : (
              <CalendarDays className="h-3.5 w-3.5" />
            )}
            {recurring ? "Recurring" : "Dates"}
          </div>
          <div className="mt-2 text-sm">
            {project.start_date ? `Started ${formatDate(project.start_date)}` : "No start date"}
            {!recurring && (
              <>
                <br />
                {project.end_date
                  ? `Ends ${formatDate(project.end_date)}${left != null ? ` · ${left >= 0 ? `${left} days left` : `${-left} days over`}` : ""}`
                  : "No end date"}
              </>
            )}
          </div>
          <div className="mt-2">
            <label
              htmlFor={`hr-status-${project.id}`}
              className="mb-1 block text-xs text-muted-foreground"
            >
              Status
            </label>
            <Select
              value={project.status}
              disabled={!canManage || update.isPending}
              onValueChange={(v) =>
                update.mutate(
                  { id: project.id, status: v as ProjectStatus },
                  {
                    onSuccess: () =>
                      toast.success(
                        `Marked ${PROJECT_STATUS_LABELS[v as ProjectStatus].toLowerCase()}`,
                      ),
                    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
                  },
                )
              }
            >
              <SelectTrigger id={`hr-status-${project.id}`} className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROJECT_STATUS_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <ClientContractPanel project={project} canManage={canManage} />

      {project.service_line_code === RECRUITMENT_SERVICE_LINE && (
        <>
          <div className="ws-panel">
            <h3>Recruitment numbers</h3>
            <RecruitmentFunnelPanel projectId={project.id} canManage={canManage} />
          </div>
          <div className="ws-panel">
            <RecruitmentPlacementsPanel projectId={project.id} canManage={canManage} />
          </div>
        </>
      )}

      <div className="ws-panel">
        <div className="flex items-center justify-between gap-2">
          <h3>Next up</h3>
          {tasks.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onViewTasks}>
              All tasks ({tasks.length})
            </Button>
          )}
        </div>
        {canManage && <QuickAddTask projectId={project.id} />}
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {tasks.length > 0
              ? "All tasks are done."
              : canManage
                ? "No tasks yet. Add the first one above."
                : "No tasks yet."}
          </p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border">
            {upcoming.map((t) => {
              const who = nameOf(t.assignee_id);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTask(t.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5 text-left text-sm hover:bg-secondary/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{t.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {who ? `Assigned to ${who}` : "Not assigned"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{TASK_STATUS_LABELS[t.status]}</span>
                      <span
                        className={cn(
                          "tabular-nums",
                          isTaskOverdue(t)
                            ? "font-semibold text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {t.due_date ? `Due ${formatDate(t.due_date)}` : "No due date"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <MilestonesPanel projectId={project.id} milestones={milestones} canManage={canManage} />

      <TimelinePanel projectId={project.id} />
    </div>
  );
}

function QuickAddTask({ projectId }: { projectId: string }) {
  const createTask = useCreateTask();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState<string>();
  const { nameOf } = useStaffOptions();

  return (
    <form
      noValidate
      className="mt-3 space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) {
          setError("Type what needs doing first.");
          return;
        }
        setError(undefined);
        createTask.mutate(
          {
            projectId,
            title: title.trim(),
            dueDate: dueDate || undefined,
            assigneeId: assigneeId || undefined,
            priority: "medium",
          },
          {
            onSuccess: () => {
              const who = nameOf(assigneeId);
              setTitle("");
              setDueDate("");
              setAssigneeId("");
              toast.success(who ? `Task added and assigned to ${who}` : "Task added");
            },
            onError: (err) =>
              toast.error(err instanceof Error ? err.message : "Failed to add task"),
          },
        );
      }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(12rem,1fr)_10rem_12rem_auto]">
        <Input
          id={`quick-task-${projectId}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task… e.g. Shortlist candidates"
          aria-label="New task title"
          aria-invalid={!!error}
          aria-describedby={error ? `quick-task-${projectId}-error` : undefined}
        />
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Due date (optional)"
        />
        <StaffSelect
          value={assigneeId}
          onChange={setAssigneeId}
          placeholder="Assign to (optional)"
          ariaLabel="Assign to (optional)"
        />
        <Button type="submit" disabled={createTask.isPending}>
          {createTask.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          <span className="ml-1">Add task</span>
        </Button>
      </div>
      {error && (
        <p id={`quick-task-${projectId}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
