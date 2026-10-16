import { Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import type { Task } from "@/features/projects/use-projects";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_STYLES } from "@/features/projects/use-projects";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const dayName = (due: string, today: string, tomorrow: string) =>
  due === today ? "Today" : due === tomorrow ? "Tomorrow" : formatDate(due);

/** Work promised to clients in the next seven days, soonest first. */
export function DueThisWeekPanel({
  tasks,
  projectName,
}: {
  tasks: Task[];
  projectName: Map<string, string>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  const end = endDate.toISOString().slice(0, 10);

  const due = tasks
    .filter(
      (t) => t.status !== "completed" && t.due_date && t.due_date >= today && t.due_date <= end,
    )
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="due-week-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="due-week-heading" className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Due in the
          next seven days
        </h2>
        <Link to="/hr/tasks" className="text-xs font-medium text-primary hover:underline">
          All HR tasks
        </Link>
      </div>

      {due.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium">Nothing falls due this week</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Give each project step a date so the week ahead shows up here.
          </p>
          <Link
            to="/hr/tasks"
            className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
          >
            Open HR tasks
          </Link>
        </div>
      ) : (
        <ul className="divide-y">
          {due.slice(0, 6).map((t) => (
            <li key={t.id}>
              <Link
                to="/projects/$projectId"
                params={{ projectId: t.project_id }}
                search={{ view: "tasks" }}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-secondary/40"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {projectName.get(t.project_id) ?? t.project_name ?? "Project"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-medium">
                    {dayName(t.due_date!, today, tomorrow)}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[0.625rem] font-medium",
                      TASK_PRIORITY_STYLES[t.priority],
                    )}
                  >
                    {TASK_PRIORITY_LABELS[t.priority]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {due.length > 6 && (
            <li className="px-4 py-2 text-xs">
              <Link to="/hr/tasks" className="text-primary hover:underline">
                +{due.length - 6} more due this week
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
