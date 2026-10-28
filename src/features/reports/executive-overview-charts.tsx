import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { CHART_BLUE, CHART_GREEN } from "@/components/chart-colors";

export interface ExecutiveCharts {
  projectStatuses: { status: string; count: number }[];
  workByTeam: { id: string; name: string; count: number }[];
  reporting: { status: string; count: number }[];
}

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
  not_sent: "Not sent",
  submitted: "Awaiting review",
  approved: "Approved",
  changes_requested: "Needs changes",
};
const REPORT_COLOURS: Record<string, string> = {
  not_sent: "#8C8C8C",
  submitted: CHART_BLUE,
  approved: CHART_GREEN,
  changes_requested: "#F5821F",
};

export function ExecutiveOverviewCharts({
  charts,
  reportMonth,
}: {
  charts: ExecutiveCharts;
  reportMonth: string;
}) {
  const statuses = charts.projectStatuses.map((row) => ({
    ...row,
    name: STATUS_LABELS[row.status] ?? row.status,
  }));
  const reporting = charts.reporting.map((row) => ({
    ...row,
    name: STATUS_LABELS[row.status] ?? row.status,
  }));
  const totalProjects = statuses.reduce((sum, row) => sum + row.count, 0);
  const reportsSent = reporting
    .filter((row) => row.status !== "not_sent")
    .reduce((sum, row) => sum + row.count, 0);
  const departments = reporting.reduce((sum, row) => sum + row.count, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section
        className="min-w-0 rounded-lg border bg-card p-4"
        aria-labelledby="project-status-chart"
      >
        <h2 id="project-status-chart" className="text-sm font-semibold">
          Project status
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {totalProjects} projects across departments and company teams
        </p>
        {totalProjects ? (
          <div className="mt-4 h-56" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statuses} layout="vertical" margin={{ left: 0, right: 15 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={78}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Projects"]} />
                <Bar
                  dataKey="count"
                  isAnimationActive={false}
                  fill={CHART_BLUE}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-10 text-sm text-muted-foreground">
            Projects appear here as teams add work.
          </p>
        )}
        <ul
          className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
          aria-label="Project status figures"
        >
          {statuses.map((row) => (
            <li key={row.status}>
              {row.name}: <strong className="font-medium text-foreground">{row.count}</strong>
            </li>
          ))}
        </ul>
      </section>
      <section className="min-w-0 rounded-lg border bg-card p-4" aria-labelledby="team-work-chart">
        <h2 id="team-work-chart" className="text-sm font-semibold">
          Open work by team
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Active, planned and paused projects</p>
        <div className="mt-4 h-56" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.workByTeam} layout="vertical" margin={{ left: 0, right: 15 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={98}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Open projects"]} />
              <Bar
                dataKey="count"
                isAnimationActive={false}
                fill={CHART_BLUE}
                radius={[0, 4, 4, 0]}
                maxBarSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {charts.workByTeam.map((row) => (
            <Link
              key={row.id}
              to={row.id === "company" ? "/projects/company" : "/projects"}
              search={row.id === "company" ? undefined : { dept: row.id }}
              className="text-primary hover:underline"
            >
              {row.name}: {row.count}
            </Link>
          ))}
        </div>
      </section>
      <section
        className="min-w-0 rounded-lg border bg-card p-4"
        aria-labelledby="report-coverage-chart"
      >
        <h2 id="report-coverage-chart" className="text-sm font-semibold">
          Department reporting
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {reportMonth}: {reportsSent} of {departments} reports sent
        </p>
        {departments ? (
          <div className="relative mt-4 h-56" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reporting}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={85}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {reporting.map((row) => (
                    <Cell key={row.status} fill={REPORT_COLOURS[row.status]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Departments"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold">
                {reportsSent}/{departments}
              </span>
              <span className="text-xs text-muted-foreground">sent</span>
            </div>
          </div>
        ) : (
          <p className="py-10 text-sm text-muted-foreground">
            Department reports appear here once departments are set up.
          </p>
        )}
        <ul
          className="mt-3 grid grid-cols-2 gap-2 text-xs"
          aria-label="Department reporting figures"
        >
          {reporting.map((row) => (
            <li key={row.status} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: REPORT_COLOURS[row.status] }}
              />
              {row.name}: {row.count}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
