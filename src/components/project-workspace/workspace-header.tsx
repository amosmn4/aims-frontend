import { Lock, Repeat, Target } from "lucide-react";
import type { Project, Task } from "@/features/projects/use-projects";
import { HEALTH_STYLES, money } from "@/features/project-workspace/workspace-theme";
import { computePercentComplete, daysLeft } from "@/features/project-workspace/workspace-calcs";
import {
  taskCompletion,
  isTaskOverdue,
  methodologyLabel,
  tracksDeliveryMetrics,
} from "@/features/projects/use-projects";
import { formatDate } from "@/lib/format-date";

export function WorkspaceHeader({
  project,
  tasks,
  actualCost,
}: {
  project: Project;
  tasks: Task[];
  actualCost: number;
}) {
  // Only IT tracks hours and budget burn; everyone else counts tasks done.
  const detailed = tracksDeliveryMetrics(project.department_code);
  const health = HEALTH_STYLES[project.health];
  const pct = detailed ? computePercentComplete(tasks) : taskCompletion(tasks);
  const done = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => isTaskOverdue(t)).length;
  const budget = project.budget ?? 0;
  const budgetPct = budget > 0 ? Math.min(100, Math.round((actualCost / budget) * 100)) : 0;
  const left = daysLeft(project.end_date);

  const r = 26;
  const c = 2 * Math.PI * r;

  return (
    <div className="ws-projhead">
      <div>
        <h1>{project.name}</h1>
        <div className="ws-meta">
          <span className="p-chip" style={{ background: `${health.color}22`, color: health.color }}>
            <span className="health-dot" style={{ background: health.color }} />
            {health.label}
          </span>
          {project.visibility === "restricted" && (
            <span className="p-chip inline-flex items-center gap-1">
              <Lock className="h-3 w-3" aria-hidden="true" /> Team only
            </span>
          )}
          {project.service_line_name && <span className="p-chip">{project.service_line_name}</span>}
          {project.engagement_type === "ongoing" ? (
            <span className="p-chip inline-flex items-center gap-1">
              <Repeat className="h-3 w-3" aria-hidden="true" /> Recurring
            </span>
          ) : (
            <span className="p-chip inline-flex items-center gap-1">
              <Target className="h-3 w-3" aria-hidden="true" /> One-off
            </span>
          )}
          {project.client_name && <span>{project.client_name}</span>}
          {project.department_code !== "hr" && <span>{project.department_name}</span>}
          {detailed && project.methodology && <span>{methodologyLabel(project.methodology)}</span>}
          {(project.start_date || project.end_date) && (
            <span>
              {formatDate(project.start_date, "No start date")} –{" "}
              {formatDate(project.end_date, "no end date")}
            </span>
          )}
        </div>
      </div>
      <div className="ws-stats">
        <div className="ws-stat">
          <div className="ring-wrap">
            <svg width="64" height="64" aria-hidden="true">
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke="var(--pipeline-line-soft)"
                strokeWidth="7"
              />
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke={health.color}
                strokeWidth="7"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - pct / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="ring-label">{pct}%</div>
          </div>
          <div className="l" style={{ marginTop: 6 }}>
            {detailed ? "Complete (by hours)" : "Tasks done"}
          </div>
        </div>
        <div className="ws-stat">
          <div className="n">
            {project.engagement_type === "ongoing"
              ? "∞"
              : left != null && left >= 0
                ? left
                : left != null
                  ? 0
                  : "—"}
          </div>
          <div className="l">Days left</div>
        </div>
        {detailed ? (
          <>
            <div className="ws-stat">
              <div className="n" style={{ fontSize: 14 }}>
                {money(budget)}
              </div>
              <div className="l">Budget</div>
            </div>
            <div className="ws-stat">
              <div
                className="n"
                style={{ color: budgetPct > 85 ? "var(--pipeline-coral)" : "var(--pipeline-ink)" }}
              >
                {budgetPct}%
              </div>
              <div className="l">Budget used</div>
            </div>
          </>
        ) : (
          <>
            <div className="ws-stat">
              <div className="n">
                {done}/{tasks.length}
              </div>
              <div className="l">Tasks</div>
            </div>
            <div className="ws-stat">
              <div
                className="n"
                style={{ color: overdue > 0 ? "var(--pipeline-coral)" : "var(--pipeline-ink)" }}
              >
                {overdue}
              </div>
              <div className="l">Overdue</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
