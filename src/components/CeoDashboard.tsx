import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  CheckSquare,
  FileText,
  Users,
} from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import { ModuleSummaries } from "./ModuleSummaries";
import { useRole } from "@/lib/role";
import { compactKes, fmtKes } from "@/lib/business";
import {
  financeForBusiness,
  financeTimeline,
  formatRange,
  inDateRange,
  previousDateRange,
  rangeForPeriod,
  tasksDueInRange,
  totalsForRange,
  type DashboardPeriod,
  type DateRange,
} from "@/lib/ceo-dashboard";
import { Button } from "@/components/ui/button";

const chartColors = ["#08785f", "#9bc9b7"];
const inputClass =
  "h-[34px] min-w-[105px] rounded-md border border-border bg-background px-2 text-xs text-foreground";
const controlLabel = "mb-1 block pl-0.5 text-[10px] text-muted-foreground";
const cardClass = "min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-[17px]";
const headingClass = "mb-1 text-sm font-semibold";
const descriptionClass = "text-[11px] text-muted-foreground";

type ChartStyle = "line" | "bar";

function dayName(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function changePercent(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function ChangeNote({
  current,
  previous,
  inverse = false,
  hasCurrentData,
  hasPreviousData,
}: {
  current: number;
  previous: number;
  inverse?: boolean;
  hasCurrentData: boolean;
  hasPreviousData: boolean;
}) {
  if (!hasCurrentData)
    return <span className="text-muted-foreground">No finance records in this period</span>;
  if (!hasPreviousData)
    return <span className="text-muted-foreground">No previous-period data</span>;
  const change = changePercent(current, previous);
  if (change === null)
    return <span className="text-muted-foreground">No previous-period data</span>;
  const improved = inverse ? change <= 0 : change >= 0;
  const sign = change > 0 ? "+" : "";
  return (
    <span className={improved ? "font-semibold text-primary" : "font-semibold text-destructive"}>
      {sign}
      {change.toFixed(1)}%{" "}
      <span className="font-normal text-muted-foreground">vs previous period</span>
    </span>
  );
}

function ChartTabs({
  value,
  onChange,
  first,
  second,
}: {
  value: ChartStyle;
  onChange: (style: ChartStyle) => void;
  first: { value: ChartStyle; label: string };
  second: { value: ChartStyle; label: string };
}) {
  return (
    <div className="flex shrink-0 gap-0.5 rounded-md bg-muted p-0.5">
      {[first, second].map((tab) => (
        <button
          key={tab.value}
          type="button"
          aria-pressed={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={`rounded px-2 py-1 text-[10px] transition-colors ${
            value === tab.value
              ? "bg-card font-semibold text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function DashboardTooltip({ value, name }: { value?: number; name?: string }) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="text-muted-foreground">{name}</div>
      <div className="mt-1 font-semibold">{typeof value === "number" ? fmtKes(value) : "—"}</div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  note,
  tone = "green",
}: {
  title: string;
  value: string;
  icon: typeof ArrowUpRight;
  note: ReactNode;
  tone?: "green" | "amber" | "blue";
}) {
  const iconTone = {
    green: "bg-primary/10 text-primary",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  }[tone];
  return (
    <article className={cardClass}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {title}
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${iconTone}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="my-2 text-[23px] font-bold tracking-tight text-foreground sm:text-[27px]">
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{note}</div>
    </article>
  );
}

export function CeoDashboard() {
  const { me } = useRole();
  const { businessFinance, businesses, people, projects, reports, tasks, deptName } =
    useWorkspace();
  const [period, setPeriod] = useState<DashboardPeriod>("year");
  const [businessScope, setBusinessScope] = useState("all");
  const [draftRange, setDraftRange] = useState<DateRange>(() => rangeForPeriod("year"));
  const [appliedRange, setAppliedRange] = useState<DateRange>(() => rangeForPeriod("year"));
  const [rangeError, setRangeError] = useState("");
  const [financeStyle, setFinanceStyle] = useState<ChartStyle>("line");
  const [staffStyle, setStaffStyle] = useState<ChartStyle>("bar");

  const scopedFinance = useMemo(
    () => financeForBusiness(businessFinance, businessScope),
    [businessFinance, businessScope],
  );
  const previousRange = useMemo(() => previousDateRange(appliedRange), [appliedRange]);
  const currentTotals = useMemo(
    () => totalsForRange(scopedFinance, appliedRange),
    [scopedFinance, appliedRange],
  );
  const previousTotals = useMemo(
    () => totalsForRange(scopedFinance, previousRange),
    [scopedFinance, previousRange],
  );
  const financeRowsInPeriod = scopedFinance.filter((row) => inDateRange(row.date, appliedRange));
  const financeRowsInPreviousPeriod = scopedFinance.filter((row) =>
    inDateRange(row.date, previousRange),
  );
  const financeData = useMemo(
    () => financeTimeline(scopedFinance, appliedRange),
    [scopedFinance, appliedRange],
  );
  const periodTasks = useMemo(() => tasksDueInRange(tasks, appliedRange), [tasks, appliedRange]);
  const activeProjects = projects.filter((project) => project.status !== "completed");
  const openTasks = tasks.filter((task) => task.status !== "Done");
  const overdueTasks = openTasks.filter((task) => task.due < new Date().toISOString().slice(0, 10));
  const attentionProjects = activeProjects.filter((project) => project.status !== "on-track");
  const pendingReports = reports.filter((report) => !report.reviewed);
  const completedInPeriod = periodTasks.filter((task) => task.status === "Done");
  const inProgressInPeriod = periodTasks.filter((task) => task.status === "In progress");

  const staffData = people
    .filter((member) => member.dept)
    .map((member) => ({
      id: member.id,
      name: member.name.split(" ")[0],
      fullName: member.name,
      department: member.dept ? deptName(member.dept) : "Executive",
      completed: completedInPeriod.filter((task) => task.assignee === member.id).length,
      inProgress: inProgressInPeriod.filter((task) => task.assignee === member.id).length,
    }))
    .sort((a, b) => b.completed + b.inProgress - (a.completed + a.inProgress))
    .slice(0, 8);

  const scopedBusinesses =
    businessScope === "all"
      ? businesses
      : businesses.filter((business) => business.id === businessScope);
  const businessData = scopedBusinesses.map((business) => {
    const currentRows = scopedFinance.filter(
      (row) => row.business === business.id && inDateRange(row.date, appliedRange),
    );
    const previousRows = scopedFinance.filter(
      (row) => row.business === business.id && inDateRange(row.date, previousRange),
    );
    const totals = totalsForRange(currentRows, appliedRange);
    const previous = totalsForRange(previousRows, previousRange);
    return {
      ...business,
      ...totals,
      hasRecords: currentRows.length > 0,
      hasPreviousRecords: previousRows.length > 0,
      change: changePercent(totals.profit, previous.profit),
    };
  });
  const maxProfit = Math.max(0, ...businessData.map((business) => business.profit));
  const notices = [
    ...(overdueTasks.length
      ? [
          {
            id: "overdue",
            title: `${overdueTasks.length} overdue ${overdueTasks.length === 1 ? "task" : "tasks"}`,
            detail: overdueTasks[0]?.title ?? "Open overdue work",
            tone: "red" as const,
            href: "/tasks" as const,
          },
        ]
      : []),
    ...(pendingReports.length
      ? [
          {
            id: "reports",
            title: `${pendingReports.length} ${pendingReports.length === 1 ? "report" : "reports"} awaiting review`,
            detail: pendingReports[0]?.title ?? "Staff updates need your review",
            tone: "amber" as const,
            href: "/reports" as const,
          },
        ]
      : []),
    ...(attentionProjects.length
      ? [
          {
            id: "projects",
            title: `${attentionProjects.length} active ${attentionProjects.length === 1 ? "project needs" : "projects need"} support`,
            detail: attentionProjects[0]?.name ?? "Review delivery status",
            tone: "red" as const,
            href: "/projects" as const,
          },
        ]
      : []),
  ];

  const updatePeriod = (value: DashboardPeriod) => {
    setPeriod(value);
    setRangeError("");
    if (value !== "custom") setDraftRange(rangeForPeriod(value));
  };

  const applyRange = () => {
    if (!draftRange.from || !draftRange.to || draftRange.from > draftRange.to) {
      setRangeError("Choose a valid start and end date.");
      return;
    }
    setAppliedRange(draftRange);
    setRangeError("");
  };

  const changeRangeDate = (key: keyof DateRange, value: string) => {
    setPeriod("custom");
    setDraftRange((current) => ({ ...current, [key]: value }));
    setRangeError("");
  };

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-9 lg:py-7">
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
            Executive overview
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[27px]">
            Good {new Date().getHours() < 12 ? "morning" : "afternoon"}, {me.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Your whole business, at a glance.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-1 flex-wrap items-end gap-2 rounded-xl border bg-card p-2 shadow-sm">
            <label>
              <span className={controlLabel}>Business scope</span>
              <select
                className={inputClass}
                value={businessScope}
                onChange={(event) => setBusinessScope(event.target.value)}
                aria-label="Business scope"
              >
                <option value="all">All businesses</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={controlLabel}>Period</span>
              <select
                className={inputClass}
                value={period}
                onChange={(event) => updatePeriod(event.target.value as DashboardPeriod)}
                aria-label="Reporting period"
              >
                <option value="month">Month to date</option>
                <option value="quarter">Quarter to date</option>
                <option value="year">Year to date</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            <label>
              <span className={controlLabel}>From</span>
              <input
                className={inputClass}
                type="date"
                value={draftRange.from}
                onChange={(event) => changeRangeDate("from", event.target.value)}
                aria-label="Reporting period start date"
              />
            </label>
            <label>
              <span className={controlLabel}>To</span>
              <input
                className={inputClass}
                type="date"
                value={draftRange.to}
                onChange={(event) => changeRangeDate("to", event.target.value)}
                aria-label="Reporting period end date"
              />
            </label>
            <Button className="h-[34px] px-3 text-xs" onClick={applyRange}>
              Apply
            </Button>
          </div>
          <a
            href="#attention"
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg border bg-card text-sm text-foreground hover:bg-muted"
            aria-label={`Notifications${notices.length ? `, ${notices.length} items need attention` : ", none"}`}
            title="Jump to items needing attention"
          >
            ♧
            {notices.length > 0 && (
              <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full border border-card bg-destructive" />
            )}
          </a>
        </div>
      </header>
      <ModuleSummaries />
      {rangeError && (
        <p role="alert" className="mb-3 text-right text-xs text-destructive">
          {rangeError}
        </p>
      )}
      <p className="mb-4 text-right text-[11px] text-muted-foreground">
        Reporting period: {formatRange(appliedRange)} · Compared with previous period
      </p>
      {businessScope !== "all" && (
        <p className="mb-4 text-xs text-muted-foreground">
          Financial metrics and business performance are scoped to{" "}
          {businesses.find((business) => business.id === businessScope)?.name ??
            "the selected business"}
          . Team delivery and active work remain company-wide because tasks and projects are not
          assigned to individual businesses.
        </p>
      )}

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Business summary">
        <MetricCard
          title="Revenue"
          value={compactKes(currentTotals.revenue)}
          icon={ArrowUpRight}
          note={
            <ChangeNote
              current={currentTotals.revenue}
              previous={previousTotals.revenue}
              hasCurrentData={financeRowsInPeriod.length > 0}
              hasPreviousData={financeRowsInPreviousPeriod.length > 0}
            />
          }
        />
        <MetricCard
          title="Operating expenses"
          value={compactKes(currentTotals.expenses)}
          icon={ArrowUpRight}
          tone="amber"
          note={
            <ChangeNote
              current={currentTotals.expenses}
              previous={previousTotals.expenses}
              inverse
              hasCurrentData={financeRowsInPeriod.length > 0}
              hasPreviousData={financeRowsInPreviousPeriod.length > 0}
            />
          }
        />
        <MetricCard
          title="Net operating income"
          value={compactKes(currentTotals.profit)}
          icon={Building2}
          note={
            <span>
              <ChangeNote
                current={currentTotals.profit}
                previous={previousTotals.profit}
                hasCurrentData={financeRowsInPeriod.length > 0}
                hasPreviousData={financeRowsInPreviousPeriod.length > 0}
              />
              {financeRowsInPeriod.length > 0 && currentTotals.revenue > 0 && (
                <span className="ml-1 text-muted-foreground">
                  · margin {((currentTotals.profit / currentTotals.revenue) * 100).toFixed(1)}%
                </span>
              )}
            </span>
          }
        />
        <MetricCard
          title="Active work"
          value={`${activeProjects.length} projects`}
          icon={Briefcase}
          tone="blue"
          note={`${openTasks.length} open tasks · ${overdueTasks.length + attentionProjects.length} need attention`}
        />
      </section>

      <section className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <article className={cardClass}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className={headingClass}>Financial performance</h2>
              <p className={descriptionClass}>Revenue, expenses and net income · KES</p>
            </div>
            <ChartTabs
              value={financeStyle}
              onChange={setFinanceStyle}
              first={{ value: "line", label: "Trend" }}
              second={{ value: "bar", label: "Bars" }}
            />
          </div>
          <div className="mb-2 flex gap-4 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-primary" /> Revenue
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-[#9bc9b7]" /> Expenses
            </span>
          </div>
          {financeRowsInPeriod.length ? (
            <div className="h-[220px]" role="img" aria-label="Financial performance by month">
              <ResponsiveContainer width="100%" height="100%">
                {financeStyle === "line" ? (
                  <LineChart data={financeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      tickFormatter={compactKes}
                      width={64}
                    />
                    <Tooltip content={<DashboardTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke={chartColors[0]}
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      name="Expenses"
                      stroke={chartColors[1]}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={financeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      tickFormatter={compactKes}
                      width={64}
                    />
                    <Tooltip content={<DashboardTooltip />} />
                    <Bar
                      dataKey="revenue"
                      name="Revenue"
                      fill={chartColors[0]}
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="expenses"
                      name="Expenses"
                      fill={chartColors[1]}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="grid h-[220px] place-items-center text-center text-xs text-muted-foreground">
              No finance records are available yet.
            </div>
          )}
        </article>

        <article className={cardClass}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className={headingClass}>Tasks by staff</h2>
              <p className={descriptionClass}>Task status for items due in selected period</p>
            </div>
            <ChartTabs
              value={staffStyle}
              onChange={setStaffStyle}
              first={{ value: "bar", label: "Bars" }}
              second={{ value: "line", label: "Trend" }}
            />
          </div>
          <div className="mb-2 flex gap-4 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-primary" /> Completed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-[#9bc9b7]" /> In progress
            </span>
          </div>
          <div className="h-[220px]" role="img" aria-label="Tasks by staff for the selected period">
            <ResponsiveContainer width="100%" height="100%">
              {staffStyle === "bar" ? (
                <BarChart data={staffData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={9} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                          <div className="font-semibold">{payload[0]?.payload.fullName}</div>
                          {payload.map((entry) => (
                            <div key={entry.name} className="mt-1 text-muted-foreground">
                              {entry.name}: {entry.value}
                            </div>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                  <Bar
                    dataKey="completed"
                    name="Completed"
                    fill={chartColors[0]}
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="inProgress"
                    name="In progress"
                    fill={chartColors[1]}
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              ) : (
                <LineChart data={staffData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={9} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                          <div className="font-semibold">{payload[0]?.payload.fullName}</div>
                          {payload.map((entry) => (
                            <div key={entry.name} className="mt-1 text-muted-foreground">
                              {entry.name}: {entry.value}
                            </div>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke={chartColors[0]}
                    strokeWidth={2.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="inProgress"
                    name="In progress"
                    stroke={chartColors[1]}
                    strokeWidth={2}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)_minmax(270px,.9fr)]">
        <article className={cardClass}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className={headingClass}>Team delivery</h2>
              <p className={descriptionClass}>Workload and completion at a glance</p>
            </div>
            <Link to="/people" className="shrink-0 text-[10px] font-medium text-primary">
              View staff →
            </Link>
          </div>
          <div className="space-y-3">
            {staffData.slice(0, 5).map((member) => {
              const total = member.completed + member.inProgress;
              const percent = total ? (member.completed / total) * 100 : 0;
              return (
                <div
                  key={member.id}
                  className="grid grid-cols-[30px_minmax(0,1fr)_42px] items-center gap-2"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                    {dayName(member.fullName)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold">
                      {member.fullName}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {member.department}
                      </span>
                    </div>
                    <div className="mt-1 h-[5px] overflow-hidden rounded bg-muted">
                      <i
                        className="block h-full rounded bg-primary"
                        style={{ width: `${percent}%` }}
                        aria-label={`${percent.toFixed(0)} percent of due tasks completed`}
                      />
                    </div>
                  </div>
                  <div className="text-right text-[11px] font-bold tabular-nums">
                    {member.completed}
                    <span className="block text-[9px] font-normal text-muted-foreground">done</span>
                  </div>
                </div>
              );
            })}
            {!staffData.length && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No staff records found.
              </p>
            )}
          </div>
        </article>

        <article className={cardClass}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className={headingClass}>Business performance</h2>
              <p className={descriptionClass}>Net income and change from previous period</p>
            </div>
            <Link to="/businesses" className="shrink-0 text-[10px] font-medium text-primary">
              All businesses →
            </Link>
          </div>
          <div className="divide-y">
            {businessData.map((business, index) => {
              const width = maxProfit > 0 ? Math.max(0, (business.profit / maxProfit) * 100) : 0;
              const palette = ["bg-primary", "bg-blue-500", "bg-amber-500", "bg-violet-500"];
              return (
                <div
                  key={business.id}
                  className="grid grid-cols-[minmax(88px,1fr)_1.3fr_78px] items-center gap-2 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold">{business.name}</div>
                    <div className="mt-0.5 text-[9px] text-muted-foreground">
                      Net income ·{" "}
                      {!business.hasRecords ? (
                        "No entry"
                      ) : !business.hasPreviousRecords || business.change === null ? (
                        "No comparison"
                      ) : (
                        <span
                          className={
                            business.change >= 0
                              ? "font-semibold text-primary"
                              : "font-semibold text-destructive"
                          }
                        >
                          {business.change >= 0 ? "↑" : "↓"} {Math.abs(business.change).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-[7px] overflow-hidden rounded-full bg-muted">
                    <i
                      className={`block h-full rounded-full ${palette[index % palette.length]}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="text-right text-[11px] font-semibold tabular-nums">
                    {business.hasRecords ? compactKes(business.profit) : "No entry"}
                    <small className="mt-0.5 block text-[9px] font-normal text-muted-foreground">
                      {business.hasRecords
                        ? `Revenue ${compactKes(business.revenue)}`
                        : "No finance data"}
                    </small>
                  </div>
                </div>
              );
            })}
            {!businessData.length && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No businesses have been added.
              </p>
            )}
          </div>
          {!scopedFinance.length && (
            <p className="mt-2 text-xs text-muted-foreground">
              No finance records are available yet.
            </p>
          )}
        </article>

        <article className={`${cardClass} lg:col-span-2 2xl:col-span-1`}>
          <div className="mb-3">
            <h2 className={headingClass}>Quick links</h2>
            <p className={descriptionClass}>Common executive actions</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { to: "/people", label: "Invite staff", icon: Users },
              { to: "/reports", label: "Review reports", icon: FileText },
              { to: "/businesses", label: "Finance overview", icon: Building2 },
              { to: "/tasks", label: "Open tasks", icon: CheckSquare },
            ].map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="rounded-lg border p-2.5 text-[10px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
              >
                <Icon className="mb-2 h-4 w-4 text-primary" />
                {label}
              </Link>
            ))}
          </div>
          <h3 id="attention" className="mb-2 mt-5 border-t pt-4 text-[11px] font-semibold">
            Needs your attention <span className="text-destructive">{notices.length}</span>
          </h3>
          <div className="space-y-3">
            {notices.map((notice) => (
              <Link key={notice.id} to={notice.href} className="grid grid-cols-[8px_1fr] gap-2">
                <i
                  className={`mt-1 h-[7px] w-[7px] rounded-full ${
                    notice.tone === "red" ? "bg-destructive" : "bg-amber-500"
                  }`}
                />
                <span>
                  <strong className="block text-[10px] leading-snug">{notice.title}</strong>
                  <small className="mt-0.5 block truncate text-[9px] text-muted-foreground">
                    {notice.detail}
                  </small>
                </span>
              </Link>
            ))}
            {!notices.length && (
              <p className="text-[10px] text-muted-foreground">You’re all caught up.</p>
            )}
          </div>
        </article>
      </section>
      <p className="mt-5 text-center text-[9px] text-muted-foreground">
        Metrics reflect workspace records and the selected reporting period.
      </p>
    </main>
  );
}
