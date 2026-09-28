import { toast } from "sonner";
import { AlertTriangle, CalendarDays, CheckCircle2, Repeat } from "lucide-react";
import {
  useUpdateProject,
  isTaskOverdue,
  DELIVERABLE_STATUS_LABELS,
  DELIVERABLE_STATUS_TONE,
  isDeliverableLate,
  loggedProgress,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type Deliverable,
  type Milestone,
  type Project,
  type ProjectStatus,
  type Task,
} from "@/features/projects/use-projects";
import { ClientContractPanel } from "@/features/projects/client-contract-panel";
import { RecruitmentFunnelPanel } from "@/features/hr/recruitment-funnel-panel";
import { RecruitmentPlacementsPanel } from "@/features/hr/recruitment-placements-panel";
import { RECRUITMENT_SERVICE_LINE } from "@/features/hr/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { useStaffOptions } from "@/features/projects/staff-picker";
import { daysLeft } from "@/features/project-workspace/workspace-calcs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type HrSection = "deliverables" | "tasks" | "milestones";

const today = () => new Date().toISOString().slice(0, 10);

/** Plain-language summary of an HR project: progress, what's late, and what has been logged. */
export function HrProjectOverview({
  project,
  tasks,
  milestones,
  deliverables,
  canManage,
  onOpenTask,
  onOpenSection,
}: {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
  deliverables: Deliverable[];
  canManage: boolean;
  onOpenTask: (taskId: string) => void;
  onOpenSection: (section: HrSection) => void;
}) {
  const update = useUpdateProject();
  const { nameOf } = useStaffOptions();
  const pct = loggedProgress(deliverables, tasks, milestones);
  const delivered = deliverables.filter((d) => d.status === "delivered").length;
  const tasksDone = tasks.filter((t) => t.status === "completed").length;
  const milestonesDone = milestones.filter((m) => m.is_complete).length;
  const lateTasks = tasks.filter((t) => isTaskOverdue(t)).length;
  const lateDeliverables = deliverables.filter((d) => isDeliverableLate(d)).length;
  const lateMilestones = milestones.filter((m) => !m.is_complete && m.due_date < today()).length;
  const late = lateTasks + lateDeliverables + lateMilestones;
  const recurring = project.engagement_type === "ongoing";
  const left = recurring ? null : daysLeft(project.end_date);
  const upcoming = tasks
    .filter((t) => t.status !== "completed")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 5);
  const nextMilestones = milestones
    .filter((m) => !m.is_complete)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
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
          <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
            <div>
              {delivered} of {deliverables.length} deliverables delivered
            </div>
            <div>
              {tasksDone} of {tasks.length} tasks done
            </div>
            <div>
              {milestonesDone} of {milestones.length} milestones reached
            </div>
          </div>
        </div>

        <div className={cn("ws-panel !mt-0", late > 0 && "border-destructive/40")}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> Late
          </div>
          <div
            className={cn(
              "mt-2 text-2xl font-semibold tabular-nums",
              late > 0 && "text-destructive",
            )}
          >
            {late}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            {late === 0
              ? "Nothing is late"
              : [
                  lateDeliverables > 0 && `${lateDeliverables} deliverables`,
                  lateTasks > 0 && `${lateTasks} tasks`,
                  lateMilestones > 0 && `${lateMilestones} milestones`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
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

      {project.description && (
        <div className="ws-panel">
          <h3>About this project</h3>
          <p className="mt-1 whitespace-pre-line text-sm">{project.description}</p>
        </div>
      )}

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
        <SummaryHeading
          title="Deliverables"
          viewAllLabel={`All deliverables (${deliverables.length})`}
          show={deliverables.length > 0}
          onViewAll={() => onOpenSection("deliverables")}
        />
        {deliverables.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No deliverables logged yet.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-lg border">
            {deliverables.slice(0, 5).map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate font-medium">{d.title}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "tabular-nums",
                      isDeliverableLate(d)
                        ? "font-semibold text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {d.due_date ? `Due ${formatDate(d.due_date)}` : "No due date"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      DELIVERABLE_STATUS_TONE[d.status],
                    )}
                  >
                    {DELIVERABLE_STATUS_LABELS[d.status]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ws-panel">
        <SummaryHeading
          title="Next tasks"
          viewAllLabel={`All tasks (${tasks.length})`}
          show={tasks.length > 0}
          onViewAll={() => onOpenSection("tasks")}
        />
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {tasks.length > 0 ? "All tasks are done." : "No tasks logged yet."}
          </p>
        ) : (
          <ul className="mt-2 divide-y rounded-lg border">
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

      <div className="ws-panel">
        <SummaryHeading
          title="Next milestones"
          viewAllLabel={`All milestones (${milestones.length})`}
          show={milestones.length > 0}
          onViewAll={() => onOpenSection("milestones")}
        />
        {nextMilestones.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {milestones.length > 0 ? "All milestones reached." : "No milestones logged yet."}
          </p>
        ) : (
          <ul className="mt-2 divide-y rounded-lg border">
            {nextMilestones.map((m) => {
              const isLate = m.due_date < today();
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{m.title}</span>
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      isLate ? "font-semibold text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {isLate ? `Late · was due ${formatDate(m.due_date)}` : formatDate(m.due_date)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryHeading({
  title,
  viewAllLabel,
  show,
  onViewAll,
}: {
  title: string;
  viewAllLabel: string;
  show: boolean;
  onViewAll: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3>{title}</h3>
      {show && (
        <Button size="sm" variant="ghost" onClick={onViewAll}>
          {viewAllLabel}
        </Button>
      )}
    </div>
  );
}
