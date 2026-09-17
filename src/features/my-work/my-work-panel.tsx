import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatDate, formatRelative } from "@/lib/format-date";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CLIENT_REQUEST_STAGE_LABELS } from "@/features/client-requests/use-client-requests";
import { TICKET_PRIORITY_LABELS } from "@/features/it/use-tickets";
import {
  useMyWork,
  type MyReportStatus,
  type MyWork,
  type MyWorkProject,
  type MyWorkReport,
  type MyWorkTask,
} from "./use-my-work";

const SHORT_DEPARTMENT_NAME: Record<string, string> = {
  finance: "Finance",
  hr: "HR",
  it: "IT",
  marketing: "Marketing",
  tender: "Tender",
  operations: "Operations",
};

const REPORT_STATUS_WORDS: Record<MyReportStatus, string> = {
  not_started: "Not started",
  draft: "Draft, not sent yet",
  changes_requested: "The CEO asked for changes",
  submitted: "Sent, waiting for the CEO",
  approved: "Approved",
};

const NEEDS_ACTION: MyReportStatus[] = ["not_started", "draft", "changes_requested"];

const localDayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dayOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function monthName(period: string) {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  const d = new Date(y, m - 1, 1);
  const sameYear = y === new Date().getFullYear();
  return d.toLocaleDateString(
    "en-GB",
    sameYear ? { month: "long" } : { month: "long", year: "numeric" },
  );
}

const rowLink =
  "flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** "Your work, Faith": what's waiting on this person, shown at the top of their home page. */
export function MyWorkPanel({
  departmentCode,
  className,
}: {
  /** Home page's department; its reports and projects are listed first. */
  departmentCode?: string;
  className?: string;
}) {
  const { profile } = useAuth();
  const q = useMyWork();
  const firstName = profile?.fullName?.trim().split(/\s+/)[0];

  return (
    <section
      aria-labelledby="my-work-heading"
      className={cn("rounded-xl border bg-card", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="my-work-heading" className="text-base font-semibold">
          {firstName ? `Your work, ${firstName}` : "Your work"}
        </h2>
      </div>
      {q.isLoading ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your work…
        </p>
      ) : q.isError || !q.data ? (
        <LoadError what="your work" error={q.error} onRetry={() => q.refetch()} className="m-4" />
      ) : (
        <MyWorkBlocks data={q.data} departmentCode={departmentCode} />
      )}
    </section>
  );
}

function MyWorkBlocks({ data, departmentCode }: { data: MyWork; departmentCode?: string }) {
  const firstForDepartment = (code: string | null | undefined) =>
    departmentCode && code === departmentCode ? 0 : 1;

  const reports = [...data.reports].sort(
    (a, b) => firstForDepartment(a.departmentCode) - firstForDepartment(b.departmentCode),
  );
  const projects = [...data.projects].sort(
    (a, b) => firstForDepartment(a.department?.code) - firstForDepartment(b.department?.code),
  );
  const waiting = data.reviews?.waiting ?? 0;

  const blocks: { key: string; node: ReactNode }[] = [];
  if (data.tasks.open > 0) blocks.push({ key: "tasks", node: <TasksBlock tasks={data.tasks} /> });
  if (waiting > 0) blocks.push({ key: "reviews", node: <ReviewsBlock waiting={waiting} /> });
  if (reports.some((r) => NEEDS_ACTION.includes(r.status)))
    blocks.push({ key: "reports", node: <ReportsBlock reports={reports} /> });
  if (data.requests.length > 0)
    blocks.push({ key: "requests", node: <RequestsBlock requests={data.requests} /> });
  if (projects.length > 0)
    blocks.push({ key: "projects", node: <ProjectsBlock projects={projects} /> });
  if (data.tickets.assigned.length > 0)
    blocks.push({ key: "tickets", node: <TicketsBlock tickets={data.tickets.assigned} /> });
  if (data.tickets.raisedOpen > 0)
    blocks.push({ key: "it-help", node: <ItRequestsBlock open={data.tickets.raisedOpen} /> });

  if (blocks.length === 0) {
    return (
      <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
        Nothing waiting on you. Nice.
      </p>
    );
  }

  return (
    <div className={cn("grid gap-x-6 gap-y-5 p-4", blocks.length > 1 && "md:grid-cols-2")}>
      {blocks.map((b) => (
        <div key={b.key} className="min-w-0">
          {b.node}
        </div>
      ))}
    </div>
  );
}

function Block({
  title,
  summary,
  children,
  footer,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
      <ul className="mt-2 divide-y overflow-hidden rounded-lg border">{children}</ul>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

function FooterLink({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
      {children} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

function TasksBlock({ tasks }: { tasks: MyWork["tasks"] }) {
  const parts = [
    tasks.overdue > 0 && `${tasks.overdue} overdue`,
    tasks.dueSoon > 0 && `${tasks.dueSoon} due in the next 7 days`,
    `${plural(tasks.open, "open task")} in total`,
  ].filter(Boolean);

  return (
    <Block
      title="Tasks"
      summary={parts.join(" · ")}
      footer={
        <Link to="/projects/mine">
          <FooterLink>See all my tasks</FooterLink>
        </Link>
      }
    >
      {tasks.items.slice(0, 5).map((t) => (
        <li key={t.id}>
          <Link
            to="/projects/$projectId"
            params={{ projectId: t.project.id }}
            search={{ view: "tasks" }}
            className={rowLink}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{t.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{t.project.name}</span>
            </span>
            <TaskDue task={t} />
          </Link>
        </li>
      ))}
    </Block>
  );
}

function TaskDue({ task }: { task: MyWorkTask }) {
  const due = dayOnly(task.dueDate);
  if (!due) return <span className="shrink-0 text-xs text-muted-foreground">No due date</span>;
  if (task.overdue) {
    return (
      <span className="shrink-0 text-right text-xs">
        <span className="block font-semibold text-destructive">Overdue</span>
        <span className="block text-muted-foreground">was due {formatDate(due)}</span>
      </span>
    );
  }
  const soon = due <= localDayKey(new Date(Date.now() + 7 * 864e5));
  return (
    <span
      className={cn(
        "shrink-0 text-right text-xs",
        soon ? "font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      Due {formatDate(due)}
    </span>
  );
}

function ReviewsBlock({ waiting }: { waiting: number }) {
  return (
    <Block title="Reports to review">
      <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <span className="text-sm">{plural(waiting, "report")} waiting for your review</span>
        <Button asChild size="sm">
          <Link to="/reports">Review reports</Link>
        </Button>
      </li>
    </Block>
  );
}

function ItRequestsBlock({ open }: { open: number }) {
  return (
    <Block title="Your IT requests">
      <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <span className="text-sm">{plural(open, "request")} still open with IT</span>
        <Button asChild size="sm" variant="outline">
          <Link to="/it-help">See your IT requests</Link>
        </Button>
      </li>
    </Block>
  );
}

function ReportsBlock({ reports }: { reports: MyWorkReport[] }) {
  const today = localDayKey();
  return (
    <Block title="Reports to send">
      {reports.map((r) => {
        const name = SHORT_DEPARTMENT_NAME[r.departmentCode] ?? r.departmentName;
        const late = NEEDS_ACTION.includes(r.status) && r.dueDate < today;
        return (
          <li
            key={r.departmentId}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {name} report for {monthName(r.period)} — due {formatDate(r.dueDate)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {REPORT_STATUS_WORDS[r.status]}
                {late && <span className="font-medium text-destructive"> · Late</span>}
              </span>
            </span>
            <ReportAction report={r} />
          </li>
        );
      })}
    </Block>
  );
}

function ReportAction({ report }: { report: MyWorkReport }) {
  const label =
    report.status === "not_started"
      ? "Start report"
      : report.status === "draft"
        ? "Continue draft"
        : report.status === "changes_requested"
          ? "Make the changes the CEO asked for"
          : null;
  if (!label) return null;

  let link: ReactNode;
  if (report.status !== "not_started" && report.reportId) {
    link = (
      <Link to="/department-reports/$reportId" params={{ reportId: report.reportId }}>
        {label}
      </Link>
    );
  } else if (report.status !== "not_started" && report.financeReportId) {
    link = (
      <Link to="/finance/reports/$id" params={{ id: report.financeReportId }}>
        {label}
      </Link>
    );
  } else {
    link = departmentReportsLink(report.departmentCode, label);
  }

  return (
    <Button asChild size="sm" variant={report.status === "draft" ? "outline" : "default"}>
      {link}
    </Button>
  );
}

function departmentReportsLink(code: string, children: ReactNode) {
  switch (code) {
    case "finance":
      return <Link to="/finance/reports">{children}</Link>;
    case "hr":
      return <Link to="/hr/reports">{children}</Link>;
    case "it":
      return <Link to="/it/reports">{children}</Link>;
    case "marketing":
      return <Link to="/marketing/reports">{children}</Link>;
    case "tender":
      return <Link to="/tender/reports">{children}</Link>;
    case "operations":
      return <Link to="/operations/reports">{children}</Link>;
    default:
      return <Link to="/departments">{children}</Link>;
  }
}

function RequestsBlock({ requests }: { requests: MyWork["requests"] }) {
  return (
    <Block title="Client requests given to you">
      {requests.map((r) => (
        <li key={r.id}>
          <Link to="/requests/$requestId" params={{ requestId: r.id }} className={rowLink}>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{r.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[r.referenceNumber, r.clientName].filter(Boolean).join(" · ") || "No client yet"}
              </span>
            </span>
            <span className="shrink-0 text-right text-xs">
              <span className="block font-medium">{CLIENT_REQUEST_STAGE_LABELS[r.stage]}</span>
              <span className="block text-muted-foreground">
                {r.daysInStage === 0
                  ? "Moved here today"
                  : `${plural(r.daysInStage, "day")} in this stage`}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </Block>
  );
}

function projectReason(p: MyWorkProject) {
  const health = p.health === "red" ? "Off track" : p.health === "amber" ? "At risk" : null;
  const late = p.late ? `Past its end date (${formatDate(dayOnly(p.endDate))})` : null;
  return [health, late].filter(Boolean).join(" · ");
}

function ProjectsBlock({ projects }: { projects: MyWorkProject[] }) {
  return (
    <Block title="Projects needing attention">
      {projects.map((p) => (
        <li key={p.id}>
          <Link
            to="/projects/$projectId"
            params={{ projectId: p.id }}
            search={{ view: "overview" }}
            className={rowLink}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span
                className={cn(
                  "block text-xs",
                  p.late || p.health === "red" ? "text-destructive" : "text-warning",
                )}
              >
                {projectReason(p)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </Block>
  );
}

function TicketsBlock({ tickets }: { tickets: MyWork["tickets"]["assigned"] }) {
  return (
    <Block
      title="Tickets given to you"
      footer={
        <Link to="/it/tickets">
          <FooterLink>See all tickets</FooterLink>
        </Link>
      }
    >
      {tickets.map((t) => (
        <li key={t.id}>
          <Link to="/it/tickets" className={rowLink}>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{t.title}</span>
              <span className="block text-xs text-muted-foreground">
                Opened{" "}
                {formatRelative(t.createdAt).replace(/^(Today|Yesterday)/, (w) => w.toLowerCase())}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 text-xs",
                t.priority === "urgent" && "font-medium text-destructive",
                t.priority === "high" && "font-medium text-warning",
                (t.priority === "low" || t.priority === "medium") && "text-muted-foreground",
              )}
            >
              {TICKET_PRIORITY_LABELS[t.priority]} priority
            </span>
          </Link>
        </li>
      ))}
    </Block>
  );
}
