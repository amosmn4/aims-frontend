import { Lock, Repeat } from "lucide-react";
import type { Project, Task } from "@/features/projects/use-projects";
import { HEALTH_STYLES, money, fmtDate } from "@/features/project-workspace/workspace-theme";
import { computePercentComplete, daysLeft } from "@/features/project-workspace/workspace-calcs";

export function WorkspaceHeader({
  project,
  tasks,
  actualCost,
}: {
  project: Project;
  tasks: Task[];
  actualCost: number;
}) {
  const health = HEALTH_STYLES[project.health];
  const pct = computePercentComplete(tasks);
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
            <span
              className="p-chip inline-flex items-center gap-1"
              title="Only the creator and specific people added to the Team tab can see this project"
            >
              <Lock className="h-3 w-3" /> Restricted
            </span>
          )}
          {project.engagement_type === "ongoing" && (
            <span
              className="p-chip inline-flex items-center gap-1"
              title="Retainer/maintenance work with no natural end — excluded from overdue alerts"
            >
              <Repeat className="h-3 w-3" /> Ongoing
            </span>
          )}
          {project.client_name && <span>{project.client_name}</span>}
          <span>{project.department_name}</span>
          {project.methodology && <span>{project.methodology}</span>}
          {project.start_date && project.end_date && (
            <span className="ws-section-label" style={{ margin: 0, display: "inline" }}>
              {fmtDate(project.start_date)} – {fmtDate(project.end_date)}
            </span>
          )}
        </div>
      </div>
      <div className="ws-stats">
        <div className="ws-stat">
          <div className="ring-wrap">
            <svg width="64" height="64">
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
            Complete
          </div>
        </div>
        <div className="ws-stat">
          <div className="n">{left != null && left >= 0 ? left : left != null ? 0 : "—"}</div>
          <div className="l">Days Left</div>
        </div>
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
          <div className="l">Budget Used</div>
        </div>
      </div>
    </div>
  );
}
