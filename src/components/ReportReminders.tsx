import { Link } from "@tanstack/react-router";
import { useRole } from "@/lib/role";
import { useWorkspace } from "@/lib/workspace";
import { today } from "@/lib/access";

export function ReportReminders() {
  const { people, reports, settings } = useWorkspace();
  const { mode, me } = useRole();
  if (!settings.remindersEnabled) return null;
  const cutoff = new Date(`${today()}T12:00:00Z`).getTime() - settings.reminderDays * 86400000;
  const pending = people
    .filter((person) => person.dept && (mode === "ceo" || person.id === me.id))
    .filter(
      (person) =>
        !reports.some(
          (report) =>
            report.author === person.id && new Date(`${report.date}T12:00:00Z`).getTime() >= cutoff,
        ),
    );
  if (!pending.length) return null;
  return (
    <div className="mb-6 rounded-lg border bg-card p-4 text-sm">
      <strong>Report reminders</strong>
      <p className="mt-1 text-muted-foreground">
        {mode === "ceo"
          ? `${pending.length} staff have no report in the last ${settings.reminderDays} days.`
          : `You have not submitted a report in the last ${settings.reminderDays} days.`}
      </p>
      <Link to="/reports" className="mt-2 inline-block text-primary underline">
        Open reports
      </Link>
    </div>
  );
}
