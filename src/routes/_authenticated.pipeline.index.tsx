import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useTenders } from "@/features/tender/use-tender";
import { useClientRequests } from "@/features/client-requests/use-client-requests";
import { usePipelineProjects } from "@/features/pipeline/use-pipeline";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { formatCurrency } from "@/features/finance/finance";
import { DEPT_COLORS, DEPT_COLOR_FALLBACK } from "@/features/pipeline/pipeline-theme";
import { useAuth } from "@/lib/auth";

// Pipeline's in-page tabs are kanban-only now (see _authenticated.pipeline.tsx) — this overview
// dashboard is kept intact but no longer part of that tab set, so the bare /pipeline URL (what
// the top-nav link points to) redirects straight to the first kanban instead of landing here.
export const Route = createFileRoute("/_authenticated/pipeline/")({
  head: () => ({ meta: [{ title: "Pipeline — AIMS" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/pipeline/engagements" });
  },
  component: PipelineOverview,
});

function PipelineOverview() {
  const { profile } = useAuth();
  const tendersQ = useTenders();
  const requestsQ = useClientRequests();
  const projectsQ = usePipelineProjects();
  const departmentsQ = useDepartments();

  const tenders = tendersQ.data ?? [];
  const requests = requestsQ.data ?? [];
  const projects = projectsQ.data ?? [];

  const activeTenders = tenders.filter((t) => !["won", "lost", "withdrawn"].includes(t.stage));
  const activeRequests = requests.filter((r) => !["won", "lost", "withdrawn"].includes(r.stage));
  const activeProjects = projects.filter((p) => p.delivery_stage !== "closed");
  const pipelineValue =
    activeTenders.reduce((s, t) => s + (t.estimated_value ?? 0), 0) +
    activeRequests.reduce((s, r) => s + (r.estimated_value ?? 0), 0);

  const departments = departmentsQ.data ?? [];
  const deptCounts = new Map<string, number>();
  for (const d of departments) deptCounts.set(d.id, 0);
  for (const t of activeTenders) deptCounts.set(t.department_id, (deptCounts.get(t.department_id) ?? 0) + 1);
  for (const r of activeRequests) {
    if (!r.department_id) continue;
    deptCounts.set(r.department_id, (deptCounts.get(r.department_id) ?? 0) + 1);
  }
  for (const p of activeProjects) deptCounts.set(p.department_id, (deptCounts.get(p.department_id) ?? 0) + 1);
  const maxDeptCount = Math.max(1, ...Array.from(deptCounts.values()));

  const recentTenders = [...tenders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const recentRequests = [...requests].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const recentProjects = [...projects].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);

  return (
    <div>
      <h1 className="p-title text-lg">
        Good {timeOfDay()}, {(profile?.fullName || "there").split(" ")[0]}
      </h1>
      <div className="mt-1 text-xs" style={{ color: "var(--pipeline-slate)" }}>
        Here's where every tender, client request and live project stands today.
      </div>

      <div className="my-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatCard label="Active Tenders" value={activeTenders.length} sub="in identification → evaluation" />
        <StatCard label="Active Engagements" value={activeRequests.length} sub="being engaged by departments" />
        <StatCard label="Live Projects" value={activeProjects.length} sub="in delivery, invoicing or payment" />
        <StatCard label="Pipeline Value" value={formatCurrency(pipelineValue)} sub="not yet won or lost" money />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="p-panel">
          <div className="p-title mb-3 text-[16px]">Recently added</div>
          <div className="space-y-3.5">
            {recentTenders.map((t) => (
              <FeedRow
                key={t.id}
                dot="var(--pipeline-blue,#375D8A)"
                text={
                  <>
                    <b>Tender</b> · {t.title}
                  </>
                }
                when={t.created_at}
              />
            ))}
            {recentRequests.map((r) => (
              <FeedRow
                key={r.id}
                dot="var(--pipeline-teal)"
                text={
                  <>
                    <b>Engagement</b> · {r.client_name ?? r.prospect_client_name ?? r.title}
                  </>
                }
                when={r.created_at}
              />
            ))}
            {recentProjects.map((p) => (
              <FeedRow
                key={p.id}
                dot="var(--pipeline-gold)"
                text={
                  <>
                    <b>Project</b> · {p.name}
                  </>
                }
                when={p.created_at}
              />
            ))}
            {recentTenders.length + recentRequests.length + recentProjects.length === 0 && (
              <div className="empty-col">Nothing logged yet.</div>
            )}
          </div>
        </div>

        <div className="p-panel">
          <div className="p-title mb-3 text-[16px]">Load by department</div>
          {departments.map((d) => {
            const c = DEPT_COLORS[d.code] ?? DEPT_COLOR_FALLBACK;
            const count = deptCounts.get(d.id) ?? 0;
            return (
              <div key={d.id} className="mb-2.5 flex items-center gap-2.5">
                <div className="w-[120px] shrink-0 text-xs" style={{ color: "var(--pipeline-slate)" }}>
                  {d.name}
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-md" style={{ background: "var(--pipeline-line-soft)" }}>
                  <div
                    className="h-full rounded-md"
                    style={{ width: `${(count / maxDeptCount) * 100}%`, background: c.text }}
                  />
                </div>
                <div className="p-mono w-[22px] shrink-0 text-right text-[11.5px]">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/pipeline/tenders" className="p-panel flex-1 text-sm font-semibold hover:opacity-80" style={{ minWidth: 200 }}>
          Open Tender Pipeline →
        </Link>
        <Link to="/pipeline/engagements" className="p-panel flex-1 text-sm font-semibold hover:opacity-80" style={{ minWidth: 200 }}>
          Open Client Engagement →
        </Link>
        <Link to="/pipeline/projects" className="p-panel flex-1 text-sm font-semibold hover:opacity-80" style={{ minWidth: 200 }}>
          Open Projects & Delivery →
        </Link>
      </div>
    </div>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function StatCard({ label, value, sub, money }: { label: string; value: string | number; sub: string; money?: boolean }) {
  return (
    <div className="stat-card">
      <div className="p-mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--pipeline-slate-light)" }}>
        {label}
      </div>
      <div className="p-title my-1.5" style={{ fontSize: money ? 24 : 30 }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: "var(--pipeline-slate)" }}>
        {sub}
      </div>
    </div>
  );
}

function FeedRow({ dot, text, when }: { dot: string; text: React.ReactNode; when: string }) {
  return (
    <div className="flex gap-2.5 border-b pb-2.5" style={{ borderColor: "var(--pipeline-line-soft)" }}>
      <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: dot }} />
      <div>
        <div className="text-[12.8px] leading-relaxed">{text}</div>
        <div className="p-mono mt-0.5 text-[10.5px]" style={{ color: "var(--pipeline-slate-light)" }}>
          {new Date(when).toLocaleDateString(undefined, { month: "short", day: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
