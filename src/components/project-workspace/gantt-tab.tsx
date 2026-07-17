import type { Project, Task, Milestone } from "@/features/projects/use-projects";
import { TASK_STATUS_COLORS, daysBetween } from "@/features/project-workspace/workspace-theme";

export function GanttTab({
  project,
  tasks,
  milestones,
}: {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
}) {
  if (!project.start_date || !project.end_date) {
    return (
      <div className="ws-panel">
        <h3>Gantt Chart &amp; Timeline</h3>
        <div className="ws-section-label">
          Set a start and end date on this project to see its timeline.
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

  const posPct = (d: string | Date) => Math.max(0, Math.min(100, (daysBetween(start, d) / totalDays) * 100));
  const todayPct = posPct(today);
  // Re-sort by position — the API orders by status-then-position for the plain Kanban board
  // elsewhere in the app, but the Gantt needs phase-then-position chronology.
  const orderedTasks = [...tasks].sort((a, b) => a.position - b.position);
  const phases = Array.from(new Set(orderedTasks.map((t) => t.phase ?? "Unphased")));

  return (
    <div className="ws-panel">
      <h3>
        Gantt Chart &amp; Timeline
        <span className="ws-section-label" style={{ margin: 0 }}>
          critical / overdue tasks outlined in red
        </span>
      </h3>
      <div className="gantt-wrap">
        <div className="gantt">
          <div className="gantt-header">
            {months.map((m) => (
              <span key={m.toISOString()}>{m.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}</span>
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <div className="gtoday" style={{ left: `calc(220px + ${todayPct}% * (100% - 220px) / 100)` }}>
              <span className="gtoday-label">Today</span>
            </div>
            {phases.map((phase) => (
              <div key={phase}>
                <div className="grow">
                  <div className="grow-label phase">{phase}</div>
                  <div className="gtrack" />
                </div>
                {orderedTasks
                  .filter((t) => (t.phase ?? "Unphased") === phase)
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
                            style={{ left: `${left}%`, width: `${width}%`, background: TASK_STATUS_COLORS[t.status] }}
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
                <div className="grow-label" style={{ fontStyle: "italic", color: "var(--pipeline-slate)" }}>
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
