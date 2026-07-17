import type { Project, Task, Milestone, TaskStatus } from "@/features/projects/use-projects";
import { TASK_STATUS_LABELS } from "@/features/projects/use-projects";
import { TASK_STATUS_COLORS, MILESTONE_STATUS_STYLES, money, fmtDate } from "@/features/project-workspace/workspace-theme";
import { computePercentComplete, computeEvm } from "@/features/project-workspace/workspace-calcs";

function milestoneStatus(m: Milestone): "done" | "atrisk" | "upcoming" {
  if (m.is_complete) return "done";
  const daysUntil = Math.round((new Date(m.due_date).getTime() - Date.now()) / 86400000);
  return daysUntil <= 7 ? "atrisk" : "upcoming";
}

function DonutChart({ counts, total }: { counts: Record<TaskStatus, number>; total: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segs = (Object.keys(counts) as TaskStatus[]).map((k) => {
    const frac = total ? counts[k] / total : 0;
    const len = frac * c;
    const seg = (
      <circle
        key={k}
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={TASK_STATUS_COLORS[k]}
        strokeWidth="16"
        strokeDasharray={`${len} ${c - len}`}
        strokeDashoffset={-offset}
      />
    );
    offset += len;
    return seg;
  });
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
      {segs}
    </svg>
  );
}

export function OverviewTab({
  project,
  tasks,
  milestones,
  actualCost,
}: {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
  actualCost: number;
}) {
  const pct = computePercentComplete(tasks);
  const budget = project.budget ?? 0;
  const budgetPct = budget > 0 ? Math.min(100, Math.round((actualCost / budget) * 100)) : 0;
  const evm = computeEvm({
    budget,
    startDate: project.start_date,
    endDate: project.end_date,
    percentComplete: pct,
    actualCost,
  });

  const phases = Array.from(new Set(tasks.map((t) => t.phase).filter(Boolean)));
  const statusCounts = tasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<TaskStatus, number>,
  );
  for (const k of Object.keys(TASK_STATUS_LABELS) as TaskStatus[]) statusCounts[k] ??= 0;

  return (
    <>
      <div className="ws-ov-grid">
        <div className="ws-metric-card">
          <div className="label">Overall Progress</div>
          <div className="num">{pct}%</div>
          <div className="ws-bar-track">
            <div className="ws-bar-fill" style={{ width: `${pct}%`, background: "var(--pipeline-teal)" }} />
          </div>
          <div className="sub">
            {tasks.length} tasks across {phases.length || 1} phases
          </div>
        </div>
        <div className="ws-metric-card">
          <div className="label">Budget Burn</div>
          <div className="num">{budgetPct}%</div>
          <div className="ws-bar-track">
            <div
              className="ws-bar-fill"
              style={{ width: `${budgetPct}%`, background: budgetPct > 85 ? "var(--pipeline-coral)" : "var(--pipeline-gold)" }}
            />
          </div>
          <div className="sub">
            {money(actualCost)} of {money(budget)}
          </div>
        </div>
        <div className="ws-metric-card">
          <div className="label">Schedule Performance (SPI)</div>
          <div className="num" style={{ color: evm.spi >= 1 ? "var(--pipeline-teal)" : "var(--pipeline-coral)" }}>
            {evm.spi.toFixed(2)}
          </div>
          <div className="sub">{evm.spi >= 1 ? "Ahead of / on schedule" : "Behind schedule"}</div>
        </div>
        <div className="ws-metric-card">
          <div className="label">Cost Performance (CPI)</div>
          <div className="num" style={{ color: evm.cpi >= 1 ? "var(--pipeline-teal)" : "var(--pipeline-coral)" }}>
            {evm.cpi.toFixed(2)}
          </div>
          <div className="sub">{evm.cpi >= 1 ? "Under / on budget" : "Over budget for work done"}</div>
        </div>
      </div>

      <div className="ws-two-col">
        <div className="ws-panel">
          <h3>Milestones</h3>
          {milestones.length === 0 ? (
            <div className="ws-section-label">No milestones recorded yet.</div>
          ) : (
            <div className="ws-milestone-strip">
              {milestones.map((m) => {
                const st = MILESTONE_STATUS_STYLES[milestoneStatus(m)];
                return (
                  <div key={m.id} className="ws-ms-item">
                    <div className="d">{fmtDate(m.due_date)}</div>
                    <div className="t">{m.title}</div>
                    <span className="ws-ms-status" style={{ background: st.bg, color: st.c }}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="ws-section-label" style={{ marginTop: 20 }}>
            EVM Snapshot
          </div>
          <div className="evm-bars">
            <div className="evm-row">
              <div className="evm-label">Planned Value (PV)</div>
              <div className="evm-track">
                <div
                  className="evm-fill"
                  style={{ width: `${budget > 0 ? Math.min(100, (evm.pv / budget) * 100) : 0}%`, background: "var(--pipeline-slate-light)" }}
                />
              </div>
              <div className="evm-val">{money(evm.pv)}</div>
            </div>
            <div className="evm-row">
              <div className="evm-label">Earned Value (EV)</div>
              <div className="evm-track">
                <div
                  className="evm-fill"
                  style={{ width: `${budget > 0 ? Math.min(100, (evm.ev / budget) * 100) : 0}%`, background: "var(--pipeline-teal)" }}
                />
              </div>
              <div className="evm-val">{money(evm.ev)}</div>
            </div>
            <div className="evm-row">
              <div className="evm-label">Actual Cost (AC)</div>
              <div className="evm-track">
                <div
                  className="evm-fill"
                  style={{ width: `${budget > 0 ? Math.min(100, (evm.ac / budget) * 100) : 0}%`, background: "var(--pipeline-gold)" }}
                />
              </div>
              <div className="evm-val">{money(evm.ac)}</div>
            </div>
          </div>
        </div>

        <div className="ws-panel">
          <h3>Task Status Breakdown</h3>
          <DonutChart counts={statusCounts} total={tasks.length} />
          <div className="ws-donut-legend">
            {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((k) => (
              <div key={k} className="ws-dl-row">
                <span className="ws-dl-dot" style={{ background: TASK_STATUS_COLORS[k] }} />
                {TASK_STATUS_LABELS[k]}
                <span className="ws-dl-num">{statusCounts[k]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
