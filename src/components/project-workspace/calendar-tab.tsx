import type { ReactNode } from "react";
import type { Task, Milestone } from "@/features/projects/use-projects";
import { CAL_EVENT_STYLES } from "@/features/project-workspace/workspace-theme";

type CalEvent = { title: string; type: "deadline" | "milestone" };

export function CalendarTab({ tasks, milestones }: { tasks: Task[]; milestones: Milestone[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const eventsByDate = new Map<string, CalEvent[]>();
  for (const t of tasks) {
    if (!t.due_date || t.status === "completed") continue;
    const list = eventsByDate.get(t.due_date) ?? [];
    list.push({ title: t.title, type: "deadline" });
    eventsByDate.set(t.due_date, list);
  }
  for (const m of milestones) {
    const list = eventsByDate.get(m.due_date) ?? [];
    list.push({ title: m.title, type: "milestone" });
    eventsByDate.set(m.due_date, list);
  }

  const todayStr = today.toISOString().slice(0, 10);
  const cells: ReactNode[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push(
      <div
        key={`pad-${i}`}
        className="cal-cell"
        style={{ background: "transparent", border: "none" }}
      />,
    );
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = dateStr === todayStr;
    const evs = eventsByDate.get(dateStr) ?? [];
    cells.push(
      <div key={dateStr} className={`cal-cell ${isToday ? "today" : ""}`}>
        <div className="dnum">{d}</div>
        {evs.map((e, i) => {
          const style = CAL_EVENT_STYLES[e.type];
          return (
            <div key={i} className="cal-ev" style={{ background: style.bg, color: style.c }}>
              {e.title}
            </div>
          );
        })}
      </div>,
    );
  }

  return (
    <div className="ws-panel">
      <h3>
        {firstDay.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        <span className="ws-section-label" style={{ margin: 0 }}>
          task deadlines · milestones
        </span>
      </h3>
      <div className="cal-grid">
        {dow.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}
