import { useState, type ReactNode } from "react";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import type { PipelineStageDef } from "@/features/pipeline/pipeline-theme";
import { initials } from "@/features/pipeline/pipeline-theme";
import { TASK_STATUS_LABELS, type Task, type TaskStatus } from "@/features/projects/use-projects";
import { TASK_STATUS_COLORS, TASK_PRIORITY_COLORS, fmtDate } from "@/features/project-workspace/workspace-theme";

const STAGES: PipelineStageDef[] = (Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((k) => ({
  key: k,
  label: TASK_STATUS_LABELS[k],
  color: TASK_STATUS_COLORS[k],
}));

export function TasksTab({
  tasks,
  profileMap,
  onTaskClick,
  onStatusChange,
  newTaskAction,
}: {
  tasks: Task[];
  profileMap: Map<string, string>;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  newTaskAction?: ReactNode;
}) {
  const [view, setView] = useState<"list" | "kanban">("list");
  // The API orders tasks by status-then-position (right for the plain Kanban board elsewhere in
  // the app); the WBS view needs phase-then-position chronology instead, so re-sort locally.
  const orderedTasks = [...tasks].sort((a, b) => a.position - b.position);
  const phases = Array.from(new Set(orderedTasks.map((t) => t.phase ?? "Unphased")));

  return (
    <div className="ws-panel">
      <h3>
        Tasks &amp; Work Breakdown Structure
        <div className="flex items-center gap-2">
          <div className="ws-seg">
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
              List / WBS
            </button>
            <button className={view === "kanban" ? "active" : ""} onClick={() => setView("kanban")}>
              Kanban
            </button>
          </div>
          {newTaskAction}
        </div>
      </h3>

      {view === "list" ? (
        <div>
          {phases.map((phase) => (
            <div key={phase}>
              <div className="wbs-phase">{phase}</div>
              {orderedTasks
                .filter((t) => (t.phase ?? "Unphased") === phase)
                .map((t) => {
                  const pct =
                    t.status === "completed"
                      ? 100
                      : Math.min(99, Math.round((t.actual_hours / (t.estimated_hours || 1)) * 100));
                  const pr = TASK_PRIORITY_COLORS[t.priority];
                  return (
                    <div key={t.id} className="wbs-row cursor-pointer" onClick={() => onTaskClick(t)}>
                      <div className="mini-avatar">
                        {t.assignee_id ? initials(profileMap.get(t.assignee_id) ?? "?") : "—"}
                      </div>
                      <div className="wbs-name">
                        {t.title}
                        <div className="sub">
                          {t.due_date ? `Due ${fmtDate(t.due_date)} · ` : ""}
                          {t.estimated_hours != null ? `Est ${t.estimated_hours}h / Act ${t.actual_hours}h` : ""}
                          {t.depends_on.length > 0 && ` · depends on ${t.depends_on.map((d) => d.title).join(", ")}`}
                        </div>
                      </div>
                      <span className="priority-pill" style={{ background: pr.bg, color: pr.text }}>
                        {t.priority}
                      </span>
                      <div className="prog-mini">
                        <div className="prog-mini-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span
                        className="status-pill"
                        style={{ background: `${TASK_STATUS_COLORS[t.status]}22`, color: TASK_STATUS_COLORS[t.status] }}
                      >
                        {TASK_STATUS_LABELS[t.status]}
                      </span>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      ) : (
        <PipelineBoard
          stages={STAGES}
          items={orderedTasks}
          getStage={(t) => t.status}
          getId={(t) => t.id}
          onMove={(id, newStage) => onStatusChange(id, newStage as TaskStatus)}
          renderCard={(t) => {
            const pr = TASK_PRIORITY_COLORS[t.priority];
            return (
              <div onClick={() => onTaskClick(t)}>
                <div className="t">{t.title}</div>
                <span className="priority-pill" style={{ background: pr.bg, color: pr.text }}>
                  {t.priority}
                </span>
                <div className="kcard-foot">
                  <span className="ws-section-label" style={{ margin: 0 }}>
                    {t.due_date ? fmtDate(t.due_date) : "—"}
                  </span>
                  <div className="mini-avatar">
                    {t.assignee_id ? initials(profileMap.get(t.assignee_id) ?? "?") : "—"}
                  </div>
                </div>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
