import { Link } from "@tanstack/react-router";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import { useWeekly } from "@/lib/weekly";
import type { ReportingWorkspace } from "@/lib/reporting";
import { isDemo } from "@/lib/api";

export function CeoStaffSummary({ from, to }: { from: string; to: string }) {
  const query = useWeekly<ReportingWorkspace>(`workspace?view=overview&from=${from}&to=${to}`);
  if (isDemo) return null;
  const metrics = query.data?.metrics;
  return (
    <section className="mb-5" aria-label="Staff reporting">
      <h2 className="mb-3 text-base font-semibold">Staff reporting</h2>
      {query.error && <p role="alert">Staff reporting could not load: {query.error.message}</p>}
      {query.isPending && <p role="status">Loading staff reporting...</p>}
      {metrics && (
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-xl border bg-card p-4">
            <AssignmentOutlined className="mb-2 text-primary" />
            <h3 className="font-semibold">Task and submission tracking</h3>
            <p className="my-2 text-sm">
              {metrics.completed} of {metrics.tasks} tasks completed
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              {metrics.plans} plans and {metrics.reports} reports received. {metrics.awaiting}{" "}
              awaiting review.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-primary">
              <Link to="/tasks" search={{ scope: "staff" }}>
                Staff tasks
              </Link>
              <Link to="/reporting" search={{ view: "submissions", from, to }}>
                Submissions
              </Link>
            </div>
          </article>
          <article className="rounded-xl border bg-card p-4">
            <TrendingUpOutlined className="mb-2 text-primary" />
            <h3 className="font-semibold">Staff performance</h3>
            <p className="my-2 text-2xl font-semibold">
              {metrics.tasks ? Math.round((metrics.completed / metrics.tasks) * 100) : 0}%
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Task completion across {metrics.staff} active staff for this period.
            </p>
            <Link
              className="text-sm text-primary"
              to="/reporting"
              search={{ view: "performance", from, to }}
            >
              View staff performance
            </Link>
          </article>
          <article className="rounded-xl border bg-card p-4">
            <EventAvailableOutlined className="mb-2 text-primary" />
            <h3 className="font-semibold">Reporting compliance</h3>
            <p className="my-2 text-sm">
              {metrics.plans}/{metrics.expectedPlans} plans and {metrics.reports}/
              {metrics.expectedReports} reports submitted
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              {metrics.overdueReports} overdue reports
            </p>
            <Link
              className="text-sm text-primary"
              to="/reporting"
              search={{ view: "overview", from, to }}
            >
              View reporting overview
            </Link>
          </article>
        </div>
      )}
    </section>
  );
}
