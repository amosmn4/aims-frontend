import type { Project, Task, Milestone } from "@/features/projects/use-projects";
import { TASK_STATUS_COLORS, daysBetween } from "@/features/project-workspace/workspace-theme";

const NO_PHASE = "No phase";

export function GanttTab({
  project,
  tasks,
  milestones,
  detailed = false,
}: {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
  /** IT projects: group rows by phase. */
  detailed?: boolean;
}) {
  if (!project.start_date || !project.end_date) {
    return (
      <div className="ws-panel">
        <h3>Timeline</h3>
        <div className="text-sm" style={{ color: "var(--pipeline-slate)" }}>
          Add a start and end date to this project (Edit project) to see its timeline.
        </div>
      </div>
    );
  }

  const start = new Date(project.start_date);
  const end = new Date(project.end_date);
  const totalDays = daysBetween(start, end) || 1;
  const today = new Date();

  const months: Date[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  const posPct = (d: string | Date) =>
    Math.max(0, Math.min(100, (daysBetween(start, d) / totalDays) * 100));
  const todayPct = posPct(today);
  // The API orders by status; the timeline reads in planned order.
  const orderedTasks = [...tasks].sort((a, b) => a.position - b.position);
  const groups = detailed
    ? Array.from(new Set(orderedTasks.map((t) => t.phase ?? NO_PHASE)))
    : [null];
  const datedCount = orderedTasks.filter((t) => t.start_date || t.due_date).length;

  return (
    <div className="ws-panel">
      <h3>
        Timeline
        <span className="text-xs font-normal" style={{ color: "var(--pipeline-slate)" }}>
          Late tasks are outlined in red
        </span>
      </h3>
      {datedCount === 0 && milestones.length === 0 && (
        <p className="mb-2 text-sm" style={{ color: "var(--pipeline-slate)" }}>
          No tasks or milestones have dates yet. Give tasks a due date to place them here.
        </p>
      )}
      <div className="gantt-wrap">
        <div className="gantt">
          <div className="gantt-header">
            {months.map((m) => (
              <span key={m.toISOString()}>
                {m.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
              </span>
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <div
              className="gtoday"
              style={{ left: `calc(220px + ${todayPct}% * (100% - 220px) / 100)` }}
            >
              <span className="gtoday-label">Today</span>
            </div>
            {groups.map((group) => (
              <div key={group ?? "all"}>
                {group && (
                  <div className="grow">
                    <div className="grow-label phase">{group}</div>
                    <div className="gtrack" />
                  </div>
                )}
                {orderedTasks
                  .filter((t) => !group || (t.phase ?? NO_PHASE) === group)
                  .map((t) => {
                    if (!t.start_date && !t.due_date) return null;
                    const tStart = t.start_date ?? t.due_date!;
                    const tEnd = t.due_date ?? t.start_date!;
                    const left = posPct(tStart);
                    const right = posPct(tEnd);
                    const width = Math.max(1.2, right - left);
                    const overdue = t.status !== "completed" && new Date(tEnd) < today;
                    return (
                      <div key={t.id} className="grow">
                        <div className="grow-label">{t.title}</div>
                        <div className="gtrack">
                          <div
                            className={`gbar ${overdue ? "crit" : ""}`}
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              background: TASK_STATUS_COLORS[t.status],
                            }}
                          >
                            {t.title.length > 18 && width > 10 ? `${t.title.slice(0, 16)}…` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
            {milestones.map((m) => (
              <div key={m.id} className="grow">
                <div
                  className="grow-label"
                  style={{ fontStyle: "italic", color: "var(--pipeline-slate)" }}
                >
                  ◆ {m.title}
                </div>
                <div className="gtrack">
                  <div className="gmilestone" style={{ left: `${posPct(m.due_date)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
