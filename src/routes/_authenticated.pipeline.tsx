import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useTenders } from "@/features/tender/use-tender";
import { useClientRequests } from "@/features/client-requests/use-client-requests";
import { usePipelineProjects } from "@/features/pipeline/use-pipeline";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [{ title: "Pipeline — AIMS" }],
  }),
  component: PipelineLayout,
});

// Pipeline is the cross-department aggregate view — kanbans only, each one the exact same
// component embedded in its owning department's hub (Bid Pipeline also lives in the Tender hub,
// Client Requests also lives in the Operations hub). More department kanbans (IT, Marketing) are
// a deliberate future addition, not part of this pass.
const TABS = [
  { to: "/pipeline/engagements", label: "Client Requests", match: "/pipeline/engagements" },
  { to: "/pipeline/tenders", label: "Bid Pipeline", match: "/pipeline/tenders" },
  { to: "/pipeline/projects", label: "Delivery Board", match: "/pipeline/projects" },
];

function PipelineLayout() {
  const location = useLocation();
  const tendersQ = useTenders();
  const requestsQ = useClientRequests();
  const projectsQ = usePipelineProjects();

  const activeTenders = (tendersQ.data ?? []).filter(
    (t) => !["won", "lost", "withdrawn", "cancelled"].includes(t.stage),
  ).length;
  const activeEngagements = (requestsQ.data ?? []).filter(
    (r) => !["won", "lost", "withdrawn"].includes(r.stage),
  ).length;
  const activeProjects = (projectsQ.data ?? []).filter((p) => p.delivery_stage !== "closed").length;
  const counts: Record<string, number> = {
    "/pipeline/tenders": activeTenders,
    "/pipeline/engagements": activeEngagements,
    "/pipeline/projects": activeProjects,
  };

  return (
    <div className="pipeline-scope -m-4 sm:-m-6" style={{ background: "var(--pipeline-paper)" }}>
      <div
        className="flex gap-1 overflow-x-auto border-b px-4 sm:px-6"
        style={{ borderColor: "var(--pipeline-line)", background: "var(--pipeline-paper-2)" }}
      >
        {TABS.map((t) => {
          const active = location.pathname === t.match;
          return (
            <Link
              key={t.to}
              to={t.to}
              className="flex items-center gap-2 whitespace-nowrap px-4 py-3 text-[13.5px] font-medium"
              style={{
                color: active ? "var(--pipeline-ink)" : "var(--pipeline-slate)",
                borderBottom: active ? "2px solid var(--pipeline-gold)" : "2px solid transparent",
              }}
            >
              {t.label}
              {counts[t.to] != null && (
                <span
                  className="p-mono rounded-full px-1.5 py-px text-[11px]"
                  style={{
                    background: active ? "var(--pipeline-gold-soft)" : "var(--pipeline-line-soft)",
                    color: active ? "#5f4315" : "var(--pipeline-slate)",
                  }}
                >
                  {counts[t.to]}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <Outlet />
      </div>
    </div>
  );
}
