import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  FileWarning,
  FolderKanban,
  Loader2,
  Repeat,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useHrDepartment, useHrWork, isOpenProject } from "@/features/hr/use-hr";
import { HrProjectTable } from "@/features/hr/hr-project-table";
import { useRecruitmentEngagements } from "@/features/hr/use-recruitment";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { NewClientDialog } from "@/features/clients/client-picker";
import { isTaskOverdue, useProjects, useTasks } from "@/features/projects/use-projects";
import { formatCurrency } from "@/features/finance/finance";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { MyWorkPanel } from "@/features/my-work/my-work-panel";
import { StartHerePanel } from "@/features/start-here/start-here-panel";

export const Route = createFileRoute("/_authenticated/hr/")({
  head: () => ({ meta: [{ title: "HR Dashboard — AIMS" }] }),
  component: HrDashboard,
});

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  to,
  search,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  to: string;
  search?: Record<string, string | boolean>;
  tone?: "danger";
}) {
  return (
    <Link
      to={to}
      search={search}
      className={cn(
        "group rounded-xl border bg-card p-4 transition-colors hover:border-primary/50",
        tone === "danger" && "border-destructive/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary",
            tone === "danger" && "bg-destructive/10 text-destructive",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div
        className={cn(
          "mt-2 text-3xl font-semibold tabular-nums",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{hint}</span>
        <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </div>
    </Link>
  );
}

function HrDashboard() {
  const { canWriteDepartment } = useAuth();
  const canManage = canWriteDepartment("hr");
  const { department, lines, missing, loadFailed, retry } = useHrDepartment();
  const { projects, tasks, statsByProject, isLoading } = useHrWork(department?.id);
  // Same queries as useHrWork (shared cache), read here for their error state.
  const projectsQ = useProjects({ departmentId: department?.id, enabled: !!department?.id });
  const tasksQ = useTasks({ departmentId: department?.id, enabled: !!department?.id });
  const workFailed = projectsQ.isError || tasksQ.isError;
  const recruitmentQ = useRecruitmentEngagements();
  const [tab, setTab] = useState<"ongoing" | "one_off">("ongoing");
  const [clientOpen, setClientOpen] = useState(false);

  const data = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const open = projects.filter(isOpenProject);
    const recurring = open.filter((p) => p.engagement_type === "ongoing");
    const oneOff = open.filter((p) => p.engagement_type === "one_off");
    const projectName = new Map(projects.map((p) => [p.id, p.name]));

    const overdueTasks = tasks
      .filter((t) => isTaskOverdue(t))
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    const pastEnd = oneOff.filter((p) => p.end_date && p.end_date < today);
    const renewals = open.filter(
      (p) =>
        p.contract_end_date && p.contract_end_date >= today && p.contract_end_date <= inDays(60),
    );
    const noClient = open.filter((p) => !p.client_id);

    const lineStats = lines.map((l) => {
      const inLine = open.filter((p) => p.service_line_id === l.id);
      return {
        line: l,
        open: inLine.length,
        recurring: inLine.filter((p) => p.engagement_type === "ongoing").length,
        contractValue: inLine.reduce(
          (s, p) => s + (p.contract_status === "active" ? (p.contract_value ?? 0) : 0),
          0,
        ),
      };
    });

    return {
      open,
      recurring,
      oneOff,
      recurringClients: new Set(recurring.map((p) => p.client_id).filter(Boolean)).size,
      overdueTasks,
      pastEnd,
      renewals,
      noClient,
      lineStats,
      projectName,
    };
  }, [projects, tasks, lines]);

  const placed = (recruitmentQ.data ?? []).reduce((s, e) => s + (e.funnel?.placed ?? 0), 0);
  const recruitmentProjects = (recruitmentQ.data ?? []).length;

  if (loadFailed) {
    return <LoadError what="HR" onRetry={retry} />;
  }

  if (missing) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        The HR department isn't set up yet.
      </div>
    );
  }

  const attentionCount =
    data.overdueTasks.length +
    data.pastEnd.length +
    data.renewals.length +
    (data.noClient.length > 0 ? 1 : 0);
  const listed = (tab === "ongoing" ? data.recurring : data.oneOff).slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Human Resources</h1>
          <p className="text-sm text-muted-foreground">
            Your service-line projects, what needs attention, and how each line is doing.
          </p>
        </div>
        {canManage && department && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setClientOpen(true)}>
              <Building2 className="h-4 w-4 mr-1.5" /> New client
            </Button>
            <NewProjectDialog fixedDepartmentId={department.id} />
          </div>
        )}
      </div>

      {!canManage && department && <ViewOnlyBanner area="HR" action="add clients or projects" />}

      <StartHerePanel departmentCode="hr" />
      <MyWorkPanel departmentCode="hr" />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : workFailed ? (
        <LoadError
          what="HR projects and tasks"
          error={projectsQ.error ?? tasksQ.error}
          onRetry={() => {
            if (projectsQ.isError) projectsQ.refetch();
            if (tasksQ.isError) tasksQ.refetch();
          }}
        />
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <FolderKanban className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">
            {canManage ? "Start by capturing your first project" : "No HR projects yet"}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {canManage
              ? "A recruitment drive, a training, a salary survey or ongoing HR support for a client. Add the client, contract and tasks inside the project."
              : "Projects appear here once the HR team adds them."}
          </p>
          {canManage && department && <NewProjectDialog fixedDepartmentId={department.id} />}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Open projects"
              value={data.open.length}
              hint={`${data.oneOff.length} one-off · ${data.recurring.length} recurring`}
              icon={FolderKanban}
              to="/hr/projects"
            />
            <Kpi
              label="Recurring clients"
              value={data.recurringClients}
              hint={`across ${data.recurring.length} recurring projects`}
              icon={Repeat}
              to="/hr/projects"
              search={{ type: "ongoing" }}
            />
            <Kpi
              label="Overdue tasks"
              value={data.overdueTasks.length}
              hint={data.overdueTasks.length ? "need follow-up" : "nothing is late"}
              icon={AlertTriangle}
              to="/hr/tasks"
              search={data.overdueTasks.length ? { overdue: true } : undefined}
              tone={data.overdueTasks.length ? "danger" : undefined}
            />
            <Kpi
              label="People placed"
              value={placed}
              hint={`from ${recruitmentProjects} recruitment projects`}
              icon={UserCheck}
              to="/hr/recruitment"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section
              className="overflow-hidden rounded-xl border bg-card lg:col-span-2"
              aria-label="Projects"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div className="inline-flex rounded-lg bg-secondary p-0.5" role="tablist">
                  {(
                    [
                      ["ongoing", `Recurring (${data.recurring.length})`],
                      ["one_off", `One-off (${data.oneOff.length})`],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      role="tab"
                      aria-selected={tab === v}
                      onClick={() => setTab(v)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium",
                        tab === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Link
                  to="/hr/projects"
                  search={{ type: tab }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  All projects <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {listed.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No open {tab === "ongoing" ? "recurring" : "one-off"} projects.
                </div>
              ) : (
                <HrProjectTable projects={listed} statsByProject={statsByProject} compact />
              )}
            </section>

            <section className="rounded-xl border bg-card" aria-label="Needs attention">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Needs attention</h2>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs tabular-nums",
                    attentionCount
                      ? "bg-destructive/10 text-destructive"
                      : "bg-success/15 text-success",
                  )}
                >
                  {attentionCount || "All clear"}
                </span>
              </div>
              {attentionCount === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nothing is overdue or ending soon.
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.overdueTasks.slice(0, 5).map((t) => (
                    <AttentionItem
                      key={t.id}
                      icon={AlertTriangle}
                      tone="danger"
                      title={t.title}
                      detail={`${data.projectName.get(t.project_id) ?? "Project"} · due ${formatDate(t.due_date)}`}
                      projectId={t.project_id}
                      view="tasks"
                    />
                  ))}
                  {data.overdueTasks.length > 5 && (
                    <li className="px-4 py-2 text-xs">
                      <Link
                        to="/hr/tasks"
                        search={{ overdue: true }}
                        className="text-primary hover:underline"
                      >
                        +{data.overdueTasks.length - 5} more overdue tasks
                      </Link>
                    </li>
                  )}
                  {data.pastEnd.map((p) => (
                    <AttentionItem
                      key={`end-${p.id}`}
                      icon={CalendarClock}
                      tone="warn"
                      title={p.name}
                      detail={`Past its end date (${formatDate(p.end_date)}) — finish or extend it`}
                      projectId={p.id}
                    />
                  ))}
                  {data.renewals.map((p) => (
                    <AttentionItem
                      key={`renew-${p.id}`}
                      icon={Repeat}
                      tone="warn"
                      title={p.name}
                      detail={`Contract ${p.contract_number ?? ""} ends ${formatDate(p.contract_end_date)}`}
                      projectId={p.id}
                    />
                  ))}
                  {data.noClient.length > 0 && (
                    <li>
                      <Link
                        to="/hr/projects"
                        search={{ noClient: true, status: "open" }}
                        className="flex items-start gap-3 px-4 py-2.5 hover:bg-secondary/40"
                      >
                        <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {data.noClient.length} project{data.noClient.length === 1 ? "" : "s"}{" "}
                            without a client
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Add the client inside each project
                          </span>
                        </span>
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </section>
          </div>

          <section aria-label="Service lines">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Service lines</h2>
              <Link to="/hr/reports" className="text-xs font-medium text-primary hover:underline">
                Full report
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {data.lineStats.map(({ line, open, recurring, contractValue }) => (
                <Link
                  key={line.id}
                  to="/hr/projects"
                  search={{ line: line.code }}
                  className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
                >
                  <div className="text-sm font-medium leading-snug">{line.name}</div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums">{open}</div>
                  <div className="text-xs text-muted-foreground">open · {recurring} recurring</div>
                  <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                    {contractValue > 0
                      ? `${formatCurrency(contractValue)} under contract`
                      : "No active contracts"}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {department && (
        <NewClientDialog
          open={clientOpen}
          onOpenChange={setClientOpen}
          departmentId={department.id}
        />
      )}
    </div>
  );
}

function AttentionItem({
  icon: Icon,
  title,
  detail,
  projectId,
  view,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  projectId: string;
  view?: "tasks";
  tone?: "danger" | "warn";
}) {
  return (
    <li>
      <Link
        to="/projects/$projectId"
        params={{ projectId }}
        search={{ view: view ?? "overview" }}
        className="flex items-start gap-3 px-4 py-2.5 hover:bg-secondary/40"
      >
        <Icon
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
            tone === "danger" && "text-destructive",
            tone === "warn" && "text-warning",
          )}
        />
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground">{detail}</span>
        </span>
      </Link>
    </li>
  );
}
