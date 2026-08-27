import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { useTenders } from "@/features/tender/use-tender";
import { useClientRequests } from "@/features/client-requests/use-client-requests";
import { useProjects, PROJECT_STATUS_LABELS } from "@/features/projects/use-projects";
import { useContracts, useDepartments } from "@/features/clients/use-clients-contracts";
import { useServiceLines } from "@/features/finance/use-finance-data";
import {
  useRecruitmentEngagements,
  FUNNEL_STAGE_LABELS,
  type FunnelStageKey,
} from "@/features/hr/use-recruitment";
import { formatCurrency } from "@/features/finance/finance";

export const Route = createFileRoute("/_authenticated/reports/departments/hr")({
  head: () => ({ meta: [{ title: "HR Report — AIMS" }] }),
  component: HrReport,
});

const TENDER_TERMINAL = new Set(["won", "lost", "withdrawn", "cancelled"]);
const REQUEST_TERMINAL = new Set(["won", "lost", "withdrawn"]);
const STAGE_ORDER: FunnelStageKey[] = [
  "applications_received",
  "screened",
  "interviewed",
  "offered",
  "placed",
];

// Exported so the HR department hub can embed this same report as a "Reports" tab.
export function HrReport() {
  return (
    <RequireRole
      roles={["hr"]}
      message="The HR report is restricted to the HR team, CEO and System Administrator."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Human Resources</div>
            <div className="text-xs text-muted-foreground">
              Every project routed to or won by HR — salary surveys, training, HRMS, recruitment and
              more — plus recruitment's own applicant funnel.
            </div>
          </div>
          <Link to="/hr" className="text-xs text-primary hover:underline">
            Open HR workspace
          </Link>
        </div>
        <ServiceLineBreakdown />
        <RecruitmentSummary />
      </div>
    </RequireRole>
  );
}

function ServiceLineBreakdown() {
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

  const data = useMemo(() => {
    const tenders = tendersQ.data ?? [];
    const requests = requestsQ.data ?? [];
    const projects = projectsQ.data ?? [];
    const contracts = contractsQ.data ?? [];
    const serviceLines = serviceLinesQ.data ?? [];

    const activeTenders = tenders.filter((t) => !TENDER_TERMINAL.has(t.stage));
    const activeRequests = requests.filter((r) => !REQUEST_TERMINAL.has(r.stage));

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

    const recentProjects = [...projects]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 6);

    return { lines: Array.from(byLine.values()).sort((a, b) => b.value - a.value), recentProjects };
  }, [tendersQ.data, requestsQ.data, projectsQ.data, contractsQ.data, serviceLinesQ.data]);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm font-semibold mb-1">By service line</div>
      <p className="text-xs text-muted-foreground mb-4">
        Salary Surveys · Recruitment · Training · HRMS Licensing · HR Management Services
      </p>
      {data.lines.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">
          No active HR tenders, requests or contracts yet.
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {data.lines.map((l) => {
            const max = Math.max(...data.lines.map((x) => x.value), 1);
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

      <div className="text-sm font-semibold mb-2 pt-2 border-t">Recent HR projects</div>
      {data.recentProjects.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">No HR projects yet.</div>
      ) : (
        <div className="divide-y">
          {data.recentProjects.map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="flex items-center justify-between py-2 text-sm hover:bg-secondary/40 -mx-1 px-1 rounded"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">
                {PROJECT_STATUS_LABELS[p.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RecruitmentSummary() {
  const engagementsQ = useRecruitmentEngagements();
  const engagements = (engagementsQ.data ?? []).filter((e) => e.funnel);

  const totals = STAGE_ORDER.reduce(
    (acc, k) => {
      acc[k] = engagements.reduce((sum, e) => sum + (e.funnel ? e.funnel[k] : 0), 0);
      return acc;
    },
    {} as Record<FunnelStageKey, number>,
  );

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold">Recruitment funnel</div>
        <Link to="/hr/recruitment" className="text-xs text-primary hover:underline">
          View by engagement
        </Link>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Aggregated across every recruitment-as-a-service engagement being tracked.
      </p>
      {engagementsQ.isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : engagements.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          No recruitment funnel numbers reported yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {STAGE_ORDER.map((k) => (
            <div key={k} className="rounded-md border p-3 text-center">
              <div className="text-xs text-muted-foreground">{FUNNEL_STAGE_LABELS[k]}</div>
              <div className="text-xl font-semibold tabular-nums mt-1">{totals[k]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
