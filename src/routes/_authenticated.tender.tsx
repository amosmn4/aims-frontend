import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { RequireRole } from "@/components/require-role";
import { PageHeader } from "@/components/app-shell";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { DepartmentWorkspaceContent } from "./_authenticated.departments.$deptId";
import { TenderPipelineBoard } from "./_authenticated.pipeline.tenders";
import { EngagementBoard } from "./_authenticated.pipeline.engagements";
import { TenderReport } from "./_authenticated.reports.departments.tender";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Tender department hub — pilot for consolidating a department's scattered pages (bid pipeline,
// client request intake, contracts/clients/projects, reporting) into one place instead of
// requiring nav-to-nav hops across Departments / Pipeline / Requests / Reports. The tab targets
// below are the *existing, unmoved* pages, embedded directly (not routed) since they live in
// separate URL subtrees — old URLs (/pipeline/tenders, /pipeline/engagements,
// /reports/departments/tender, /departments/$deptId) keep working standalone. Only the "Overview"
// tab is a real nested route (/tender index + /tender/$tenderId detail), rendered via <Outlet />.
export const Route = createFileRoute("/_authenticated/tender")({
  head: () => ({ meta: [{ title: "Tender — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: TenderHub,
});

type HubTab = "overview" | "pipeline" | "requests" | "workspace" | "reports";

const TABS: { key: HubTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "pipeline", label: "Bid Pipeline" },
  { key: "requests", label: "Client Requests" },
  { key: "workspace", label: "Contracts, Clients & Projects" },
  { key: "reports", label: "Reports" },
];

function TenderHub() {
  const location = useLocation();
  const [tab, setTab] = useState<HubTab>("overview");
  const departmentsQ = useDepartments();
  const tenderDept = departmentsQ.data?.find((d) => d.code === "tender");
  // The tender detail page (/tender/$tenderId) is a genuine drill-down, not part of the tab
  // surface — let it render full-page via Outlet, same as visiting it directly would.
  const onDetailPage = location.pathname !== "/tender";

  return (
    <RequireRole
      roles={["tender"]}
      message="The Tender workspace is restricted to the Tender team, CEO and System Administrator."
    >
      <div>
        <PageHeader
          title="Tender"
          description="Bid pipeline, client request intake, contracts, projects and reporting for the Tender team — start to finish, in one place."
        />
        {!onDetailPage && (
          <div className="border-b mb-4 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {onDetailPage || tab === "overview" ? (
          <Outlet />
        ) : tab === "pipeline" ? (
          <div className="pipeline-scope">
            <TenderPipelineBoard />
          </div>
        ) : tab === "requests" ? (
          <div className="pipeline-scope">
            <EngagementBoard />
          </div>
        ) : tab === "workspace" ? (
          tenderDept ? (
            <DepartmentWorkspaceContent deptId={tenderDept.id} />
          ) : (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )
        ) : (
          <TenderReport />
        )}
      </div>
    </RequireRole>
  );
}
