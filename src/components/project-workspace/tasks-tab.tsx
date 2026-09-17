import { useState, type KeyboardEvent, type ReactNode } from "react";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import type { PipelineStageDef } from "@/features/pipeline/pipeline-theme";
import { initials } from "@/features/pipeline/pipeline-theme";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Task,
  type TaskStatus,
} from "@/features/projects/use-projects";
import {
  TASK_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
} from "@/features/project-workspace/workspace-theme";
import { formatDate } from "@/lib/format-date";

const STAGES: PipelineStageDef[] = (Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((k) => ({
  key: k,
  label: TASK_STATUS_LABELS[k],
  color: TASK_STATUS_COLORS[k],
}));

const NO_PHASE = "No phase";

const onActivate = (open: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    open();
  }
};

export function TasksTab({
  tasks,
  profileMap,
  detailed = false,
  canMoveTask,
  onTaskClick,
  onStatusChange,
  newTaskAction,
}: {
  tasks: Task[];
  profileMap: Map<string, string>;
  /** IT projects: group by phase and show hours. */
  detailed?: boolean;
  canMoveTask?: (task: Task) => boolean;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  newTaskAction?: ReactNode;
}) {
  const [view, setView] = useState<"list" | "kanban">("list");
  // The API orders by status; lists read better in the order tasks were planned.
  const orderedTasks = [...tasks].sort((a, b) => a.position - b.position);
  const groups = detailed
    ? Array.from(new Set(orderedTasks.map((t) => t.phase ?? NO_PHASE)))
    : [null];
  const assigneeName = (t: Task) =>
    t.assignee_id ? (profileMap.get(t.assignee_id) ?? null) : null;

  return (
    <div className="ws-panel">
      <h3>
        Tasks
        <div className="flex flex-wrap items-center gap-2">
          {tasks.length > 0 && (
            <div className="ws-seg" role="group" aria-label="Task view">
              <button
                type="button"
                className={view === "list" ? "active" : ""}
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                List
              </button>
              <button
                type="button"
                className={view === "kanban" ? "active" : ""}
                aria-pressed={view === "kanban"}
                onClick={() => setView("kanban")}
              >
                Board
              </button>
            </div>
          )}
          {tasks.length > 0 && newTaskAction}
        </div>
      </h3>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm font-medium">No tasks yet</p>
          {newTaskAction ?? (
            <p className="text-sm text-muted-foreground">
              Tasks added to this project will show here.
            </p>
          )}
        </div>
      ) : view === "list" ? (
        <div>
          {groups.map((group) => (
            <div key={group ?? "all"}>
              {group && <div className="wbs-phase">{group}</div>}
              {orderedTasks
                .filter((t) => !group || (t.phase ?? NO_PHASE) === group)
                .map((t) => {
                  const pct =
                    t.status === "completed"
                      ? 100
                      : Math.min(99, Math.round((t.actual_hours / (t.estimated_hours || 1)) * 100));
                  const pr = TASK_PRIORITY_COLORS[t.priority];
                  const who = assigneeName(t);
                  const details = [
                    t.due_date ? `Due ${formatDate(t.due_date)}` : null,
                    who ? `Assigned to ${who}` : "Not assigned",
                    detailed && t.estimated_hours != null
                      ? `Estimated ${t.estimated_hours}h · spent ${t.actual_hours}h`
                      : null,
                    t.depends_on.length > 0
                      ? `Waits on ${t.depends_on.map((d) => d.title).join(", ")}`
                      : null,
                  ].filter(Boolean);
                  return (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open task ${t.title}`}
                      className="wbs-row cursor-pointer"
                      onClick={() => onTaskClick(t)}
                      onKeyDown={onActivate(() => onTaskClick(t))}
                    >
                      <div className="mini-avatar" aria-hidden="true">
                        {who ? initials(who) : "—"}
                      </div>
                      <div className="wbs-name">
                        {t.title}
                        <div className="sub" style={{ fontSize: 12 }}>
                          {details.join(" · ")}
                        </div>
                      </div>
                      <span className="priority-pill" style={{ background: pr.bg, color: pr.text }}>
                        {TASK_PRIORITY_LABELS[t.priority]}
                      </span>
                      {detailed && (
                        <div className="prog-mini" aria-hidden="true">
                          <div className="prog-mini-fill" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      <span
                        className="status-pill"
                        style={{
                          background: `${TASK_STATUS_COLORS[t.status]}22`,
                          color: TASK_STATUS_COLORS[t.status],
                        }}
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
        <>
          <p className="mb-2 text-xs" style={{ color: "var(--pipeline-slate)" }}>
            Drag a card to another column, or open the task and change its status.
          </p>
          <PipelineBoard
            stages={STAGES}
            items={orderedTasks}
            getStage={(t) => t.status}
            getId={(t) => t.id}
            canDrag={canMoveTask}
            onMove={(id, newStage) => {
              const task = orderedTasks.find((t) => t.id === id);
              if (task && task.status !== newStage && (!canMoveTask || canMoveTask(task)))
                onStatusChange(id, newStage as TaskStatus);
            }}
            renderCard={(t) => {
              const pr = TASK_PRIORITY_COLORS[t.priority];
              const who = assigneeName(t);
              return (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Open task ${t.title}`}
                  onClick={() => onTaskClick(t)}
                  onKeyDown={onActivate(() => onTaskClick(t))}
                >
                  <div className="t">{t.title}</div>
                  <span className="priority-pill" style={{ background: pr.bg, color: pr.text }}>
                    {TASK_PRIORITY_LABELS[t.priority]}
                  </span>
                  <div className="kcard-foot">
                    <span className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
                      {t.due_date ? `Due ${formatDate(t.due_date)}` : "No due date"}
                    </span>
                    <div
                      className="mini-avatar"
                      aria-label={who ? `Assigned to ${who}` : "Not assigned"}
                    >
                      {who ? initials(who) : "—"}
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </>
      )}
    </div>
  );
}
