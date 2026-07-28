import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Briefcase, TrendingUp, Repeat, CalendarClock } from "lucide-react";
import { useTenders } from "@/features/tender/use-tender";
import { useClientRequests } from "@/features/client-requests/use-client-requests";
import { useProjects, PROJECT_STATUS_LABELS } from "@/features/projects/use-projects";
import { useContracts, useDepartments } from "@/features/clients/use-clients-contracts";
import { useServiceLines } from "@/features/finance/use-finance-data";
import { formatCurrency } from "@/features/finance/finance";

export const Route = createFileRoute("/_authenticated/hr/")({
  head: () => ({ meta: [{ title: "HR Overview — AIMS" }] }),
  component: HrOverview,
});

const TENDER_TERMINAL = new Set(["won", "lost", "withdrawn"]);
const REQUEST_TERMINAL = new Set(["won", "lost", "withdrawn"]);
const PROJECT_ACTIVE = new Set(["planning", "active"]);

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </div>
        <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function HrOverview() {
  const departmentsQ = useDepartments();
  const hrDept = departmentsQ.data?.find((d) => d.code === "hr");
  const departmentId = hrDept?.id;

  const tendersQ = useTenders({ departmentId });
  const requestsQ = useClientRequests({ departmentId });
  const projectsQ = useProjects({ departmentId });
  const contractsQ = useContracts({ departmentId });
  const serviceLinesQ = useServiceLines();

  const loading =
    departmentsQ.isLoading ||
    tendersQ.isLoading ||
    requestsQ.isLoading ||
    projectsQ.isLoading ||
    contractsQ.isLoading ||
    serviceLinesQ.isLoading;

  const stats = useMemo(() => {
    const tenders = tendersQ.data ?? [];
    const requests = requestsQ.data ?? [];
    const projects = projectsQ.data ?? [];
    const contracts = contractsQ.data ?? [];
    const serviceLines = serviceLinesQ.data ?? [];
    const slByCode = new Map(serviceLines.map((s) => [s.code, s]));

    const activeTenders = tenders.filter((t) => !TENDER_TERMINAL.has(t.stage));
    const activeRequests = requests.filter((r) => !REQUEST_TERMINAL.has(r.stage));
    const activeProjects = projects.filter((p) => PROJECT_ACTIVE.has(p.status));

    const pipelineValue =
      activeTenders.reduce((s, t) => s + (t.estimated_value ?? 0), 0) +
      activeRequests.reduce((s, r) => s + (r.estimated_value ?? 0), 0);

    const recurringLines = new Set(
      ["HR_MGMT", "HRMS"].map((code) => slByCode.get(code)?.id).filter((id): id is string => !!id),
    );
    const recurringRetainers = contracts.filter(
      (c) => c.status === "active" && c.service_line_id && recurringLines.has(c.service_line_id),
    );

    const in14Days = new Date();
    in14Days.setDate(in14Days.getDate() + 14);
    const upcomingDeadlines = activeTenders.filter(
      (t) => t.submission_deadline && new Date(t.submission_deadline) <= in14Days,
    );

    // Breakdown by HR service line — tenders, requests and contracts all carry a service line;
    // projects don't (they inherit it transitively from whichever of these they originated
    // from), so this breakdown is built from the three that do.
    const byLine = new Map<string, { name: string; count: number; value: number }>();
    for (const t of activeTenders) {
      const key = t.service_line_name ?? "Other";
      const cur = byLine.get(key) ?? { name: key, count: 0, value: 0 };
      cur.count += 1;
      cur.value += t.estimated_value ?? 0;
      byLine.set(key, cur);
    }
    for (const r of activeRequests) {
      const key = r.service_line_name ?? "Other";
      const cur = byLine.get(key) ?? { name: key, count: 0, value: 0 };
      cur.count += 1;
      cur.value += r.estimated_value ?? 0;
      byLine.set(key, cur);
    }
    for (const c of contracts.filter((c) => c.status === "active")) {
      const sl = serviceLines.find((s) => s.id === c.service_line_id);
      const key = sl?.name ?? "Other";
      const cur = byLine.get(key) ?? { name: key, count: 0, value: 0 };
      cur.count += 1;
      cur.value += c.value;
      byLine.set(key, cur);
    }

    const recent = [
      ...tenders.map((t) => ({
        kind: "Tender" as const,
        id: t.id,
        title: t.title,
        stage: t.stage,
        created_at: t.created_at,
      })),
      ...requests.map((r) => ({
        kind: "Request" as const,
        id: r.id,
        title: r.client_name ?? r.prospect_client_name ?? r.title,
        stage: r.stage,
        created_at: r.created_at,
      })),
      ...projects.map((p) => ({
        kind: "Project" as const,
        id: p.id,
        title: p.name,
        stage: PROJECT_STATUS_LABELS[p.status],
        created_at: p.created_at,
      })),
    ]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 8);

    return {
      activeEngagements: activeTenders.length + activeRequests.length + activeProjects.length,
      pipelineValue,
      recurringRetainers: recurringRetainers.length,
      upcomingDeadlines: upcomingDeadlines.length,
      lines: Array.from(byLine.values()).sort((a, b) => b.value - a.value),
      recent,
    };
  }, [tendersQ.data, requestsQ.data, projectsQ.data, contractsQ.data, serviceLinesQ.data]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Active Engagements"
          value={String(stats.activeEngagements)}
          hint="Tenders, requests & projects in flight"
          icon={Briefcase}
        />
        <StatCard
          label="Pipeline Value"
          value={formatCurrency(stats.pipelineValue)}
          hint="Open tenders & requests"
          icon={TrendingUp}
        />
        <StatCard
          label="Recurring Retainers"
          value={String(stats.recurringRetainers)}
          hint="Active HR Management / HRMS contracts"
          icon={Repeat}
        />
        <StatCard
          label="Deadlines (14 days)"
          value={String(stats.upcomingDeadlines)}
          hint="Tender submissions due soon"
          icon={CalendarClock}
        />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-1">By service line</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Salary Surveys · Recruitment · Training · HRMS Licensing · HR Management Services
        </p>
        {stats.lines.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No active HR tenders, requests or contracts yet.
          </div>
        ) : (
          <div className="space-y-3">
            {stats.lines.map((l) => {
              const max = Math.max(...stats.lines.map((x) => x.value), 1);
              const pct = (l.value / max) * 100;
              return (
                <div key={l.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">
                      {l.name} <span className="ml-2 text-muted-foreground">({l.count})</span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(l.value)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">Recent activity</h2>
        {stats.recent.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nothing logged for HR yet.
          </div>
        ) : (
          <div className="divide-y">
            {stats.recent.map((r) => {
              const to =
                r.kind === "Tender"
                  ? `/tender/${r.id}`
                  : r.kind === "Request"
                    ? `/requests/${r.id}`
                    : `/projects/${r.id}`;
              return (
                <Link
                  key={`${r.kind}-${r.id}`}
                  to={to}
                  className="flex items-center justify-between py-2.5 text-sm hover:bg-secondary/40 -mx-2 px-2 rounded"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-semibold w-14 shrink-0">
                      {r.kind}
                    </span>
                    <span className="font-medium">{r.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{r.stage}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
