import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "@/components/icons";
import {
  Card,
  PageHeader,
  Progress,
  SectionTitle,
  Stat,
  StatusBadge,
  Pill,
  fmtDate,
} from "@/components/kit";
import { useWorkspace } from "@/lib/workspace";
import { DepartmentModules } from "@/components/DepartmentModules";
import { ReportReminders } from "@/components/ReportReminders";
import { WeeklyReminder } from "@/components/weekly/WeeklyReminder";
import {
  businessTotals,
  canSeeBusinesses,
  compactKes,
  latestMonth,
  monthLabel,
  rowsFor,
} from "@/lib/business";
import { deptOtherProjects, myProjects, useRole } from "@/lib/role";
import { ProjectAnalytics } from "@/components/ProjectAnalytics";
import { today } from "@/lib/access";
import { CeoDashboard } from "@/components/CeoDashboard";
import { DepartmentWorkspace } from "@/components/DepartmentWorkspace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Amsol Projects & Reporting" },
      {
        name: "description",
        content: "See where every Amsol project stands, recent reports and what needs attention.",
      },
      { property: "og:title", content: "Dashboard · Amsol Projects & Reporting" },
      {
        property: "og:description",
        content: "See where every Amsol project stands, recent reports and what needs attention.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { mode } = useRole();
  return mode === "ceo" ? (
    <CeoDashboard />
  ) : mode === "department" ? (
    <DepartmentWorkspace />
  ) : (
    <LegacyDashboard />
  );
}

function LegacyDashboard() {
  const { mode, me, reports } = useRole();
  const { businessFinance, businesses, departments, deptName, person, projects, tasks } =
    useWorkspace();
  const visible = myProjects(mode, me.id, me.dept, projects);
  const active = visible.filter((p) => p.status !== "completed");
  const myTasks =
    mode === "ceo"
      ? tasks
      : mode === "department"
        ? tasks.filter((t) => person(t.assignee).dept === me.dept)
        : tasks.filter((t) => t.assignee === me.id);
  const open = myTasks.filter((t) => t.status !== "Done");
  const overdueTasks = open.filter((task) => task.due < today());
  const atRiskProjects = active.filter((project) => project.status !== "on-track");
  const pendingReview = reports.filter((r) => !r.reviewed);
  const visibleReports =
    mode === "ceo"
      ? reports
      : reports.filter((r) =>
          mode === "department"
            ? r.dept === me.dept
            : r.author === me.id || visible.some((p) => p.id === r.project),
        );
  const greeting =
    mode === "ceo"
      ? "Project outcomes, shared progress and support needs"
      : mode === "department" && me.dept
        ? `${deptName(me.dept)} · Shared department workspace`
        : "My workspace";

  return (
    <div>
      <PageHeader
        title={mode === "ceo" ? "Company overview" : `Welcome, ${me.name.split(" ")[0]}`}
        subtitle={greeting}
      />
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active projects" value={active.length} />
        <Stat
          label="Projects needing support"
          value={active.filter((p) => p.status !== "on-track").length}
        />
        <Stat
          label={
            mode === "ceo"
              ? "Completed projects"
              : mode === "staff"
                ? "My open tasks"
                : "Team open tasks"
          }
          value={
            mode === "ceo" ? visible.filter((p) => p.status === "completed").length : open.length
          }
        />
        {mode === "ceo" ? (
          <Stat label="Updates to review" value={pendingReview.length} />
        ) : (
          <Stat label="Recent reports" value={visibleReports.length} />
        )}
      </div>

      {mode === "ceo" && (
        <>
          <Card className="mb-6 border-primary/20 bg-primary/[0.03]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">CEO focus</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A quick view of delivery risks and decisions needing attention.
                </p>
              </div>
              <Link to="/tasks" className="text-sm font-medium text-primary underline">
                Review tasks
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Link
                to="/tasks"
                className="rounded-lg border bg-background p-4 hover:border-primary/40"
              >
                <div className="font-display text-2xl font-semibold">{overdueTasks.length}</div>
                <div className="text-sm font-medium">Overdue tasks</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Open work past its due date
                </div>
              </Link>
              <div className="rounded-lg border bg-background p-4">
                <div className="font-display text-2xl font-semibold">{atRiskProjects.length}</div>
                <div className="text-sm font-medium">Projects needing support</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  At-risk or delayed, still active
                </div>
              </div>
              <Link
                to="/reports"
                className="rounded-lg border bg-background p-4 hover:border-primary/40"
              >
                <div className="font-display text-2xl font-semibold">{pendingReview.length}</div>
                <div className="text-sm font-medium">Updates awaiting review</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Staff reports without CEO review
                </div>
              </Link>
            </div>
            {overdueTasks.length > 0 && (
              <div className="mt-4 space-y-2 border-t pt-4">
                {overdueTasks
                  .slice()
                  .sort((a, b) => a.due.localeCompare(b.due))
                  .slice(0, 3)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="font-medium">{task.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {person(task.assignee).name} · due {fmtDate(task.due)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </Card>
          <ProjectAnalytics />
        </>
      )}
      <ReportReminders />
      <WeeklyReminder />
      {mode === "department" && me.dept && <DepartmentModules dept={me.dept} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div>
            <SectionTitle>
              {mode === "staff" ? "Projects I'm in" : "Where projects stand"}
            </SectionTitle>
            <Card className="divide-y p-0">
              {active.map((p) => (
                <Link
                  key={p.id}
                  to="/projects/$id"
                  params={{ id: p.id }}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-muted/50 sm:flex-nowrap sm:gap-4"
                >
                  <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {p.stage} · due {fmtDate(p.due)} · {p.depts.map(deptName).join(", ")}
                    </div>
                  </div>
                  <div className="hidden w-24 xl:block">
                    <Progress value={p.progress} />
                  </div>
                  <div className="w-10 text-right text-sm tabular-nums">{p.progress}%</div>
                  <div className="w-20 text-right">
                    <StatusBadge status={p.status} />
                  </div>
                </Link>
              ))}
            </Card>
          </div>

          {mode === "staff" && (
            <div>
              <SectionTitle>
                Other {me.dept ? deptName(me.dept) : "department"} projects
              </SectionTitle>
              <Card className="divide-y p-0">
                {deptOtherProjects(me.id, me.dept, projects).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>{p.name}</span>
                    <span className="flex items-center gap-3">
                      <Pill>Not a member - summary only</Pill>
                      <StatusBadge status={p.status} />
                    </span>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {mode === "ceo" && (
            <div>
              <SectionTitle>By department</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-5">
                {departments.map((d) => {
                  const dp = projects.filter(
                    (p) => p.depts.includes(d.id) && p.status !== "completed",
                  );
                  return (
                    <Link key={d.id} to="/departments/$id" params={{ id: d.id }}>
                      <Card className="h-full p-4 hover:border-primary/40">
                        <div className="text-sm font-semibold">{d.name}</div>
                        <div className="mt-2 font-display text-2xl">{dp.length}</div>
                        <div className="text-xs text-muted-foreground">active projects</div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          {mode === "ceo" &&
            canSeeBusinesses(mode, me.id, me.dept) &&
            (() => {
              const latest = latestMonth(businessFinance);
              const group = businessTotals(businessFinance.filter((r) => r.month === latest));
              return (
                <div>
                  <SectionTitle>Amsol & sister businesses</SectionTitle>
                  <Card>
                    <div className="text-sm text-muted-foreground">
                      Revenue · {monthLabel(latest)}
                    </div>
                    <div className="mt-1 font-display text-3xl font-semibold tabular-nums">
                      {compactKes(group.revenue)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Profit {compactKes(group.profit)} across {businesses.length} businesses
                    </div>
                    <div className="mt-3 space-y-1.5 border-t pt-3 text-sm">
                      {businesses.map((b) => (
                        <div key={b.id} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{b.name}</span>
                          <span className="tabular-nums">
                            {compactKes(
                              businessTotals(
                                rowsFor(businessFinance, b.id).filter((r) => r.month === latest),
                              ).revenue,
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Link
                      to="/businesses"
                      className="mt-3 inline-block text-sm font-medium text-primary"
                    >
                      Compare businesses →
                    </Link>
                  </Card>
                </div>
              );
            })()}
          <div>
            <SectionTitle>
              {mode === "ceo" ? "Awaiting your review" : "Recent reports"}
            </SectionTitle>
            <Card className="space-y-4">
              {(mode === "ceo" ? pendingReview : visibleReports).slice(0, 4).map((r) => (
                <Link key={r.id} to="/reports" hash={`report-${r.id}`} className="block">
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {person(r.author).name} · {fmtDate(r.date)}
                  </div>
                </Link>
              ))}
              <Link to="/reports" className="text-sm font-medium text-primary">
                All reports →
              </Link>
            </Card>
          </div>
          <div>
            <SectionTitle>
              {mode === "ceo" ? "Upcoming project milestones" : "Due soon"}
            </SectionTitle>
            <Card className="space-y-3">
              {mode === "ceo"
                ? [...active]
                    .sort((a, b) => a.due.localeCompare(b.due))
                    .slice(0, 4)
                    .map((p) => (
                      <Link
                        key={p.id}
                        to="/projects/$id"
                        params={{ id: p.id }}
                        className="block text-sm"
                      >
                        <div className="font-medium">{p.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {p.stage} · {fmtDate(p.due)}
                        </div>
                      </Link>
                    ))
                : [...open]
                    .sort((a, b) => a.due.localeCompare(b.due))
                    .slice(0, 5)
                    .map((t) => (
                      <div key={t.id} className="flex items-start gap-2 text-sm">
                        {t.priority === "High" && (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        )}
                        <div>
                          <div>{t.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {person(t.assignee).name} · {fmtDate(t.due)}
                          </div>
                        </div>
                      </div>
                    ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
