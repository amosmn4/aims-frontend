import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RequireRole } from "@/components/require-role";
import { PageHeader } from "@/components/app-shell";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { DepartmentWorkspaceContent } from "./_authenticated.departments.$deptId";
import { EngagementBoard } from "./_authenticated.pipeline.engagements";
import { ClientRequestsWorkspace } from "./_authenticated.requests.index";
import { DepartmentTaskBoard } from "./_authenticated.projects.department";
import { DeadlineCalendarView } from "./_authenticated.calendar";
import { OperationsReport } from "./_authenticated.reports.departments.operations";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Operations department hub — the intake/routing home for client requests, mirroring the Tender
// hub pattern (_authenticated.tender.tsx). No nested route to preserve here (unlike Tender's
// $tenderId drill-down), so this is a pure local-tab-state component: every tab embeds an
// existing, unmoved page's component directly. Old URLs (/requests, /requests/$requestId,
// /pipeline/engagements, /departments/$deptId) keep working standalone.
export const Route = createFileRoute("/_authenticated/operations")({
  head: () => ({ meta: [{ title: "Operations — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: OperationsHub,
});

type HubTab = "overview" | "requests" | "workspace" | "tasks" | "calendar" | "reports";

const TABS: { key: HubTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "requests", label: "Client Requests" },
  { key: "workspace", label: "Contracts, Clients & Projects" },
  { key: "tasks", label: "Tasks" },
  { key: "calendar", label: "Calendar" },
  { key: "reports", label: "Reports" },
];

function OperationsHub() {
  const [tab, setTab] = useState<HubTab>("overview");
  const departmentsQ = useDepartments();
  const operationsDept = departmentsQ.data?.find((d) => d.code === "operations");

  return (
    <RequireRole
      roles={["operations"]}
      message="The Operations workspace is restricted to the Operations team, CEO and System Administrator."
    >
      <div>
        <PageHeader
          title="Operations"
          description="Client request intake, routing, contracts, projects and reporting for the Operations team — start to finish, in one place."
        />
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

        {tab === "overview" ? (
          <ClientRequestsWorkspace />
        ) : tab === "requests" ? (
          // Unfiltered — Operations owns intake/routing for every request, not just ones
          // already assigned to it, so this stays the full cross-department board (unlike
          // every other department's own "Pipeline" tab, which is scoped to just their own).
          <div className="pipeline-scope">
            <EngagementBoard />
          </div>
        ) : tab === "reports" ? (
          <OperationsReport />
        ) : !operationsDept ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : tab === "tasks" ? (
          <DepartmentTaskBoard departmentId={operationsDept.id} />
        ) : tab === "calendar" ? (
          <DeadlineCalendarView departmentId={operationsDept.id} />
        ) : (
          <DepartmentWorkspaceContent deptId={operationsDept.id} />
        )}
      </div>
    </RequireRole>
  );
}
