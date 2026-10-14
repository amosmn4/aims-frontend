import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { DepartmentWorkPanel } from "@/features/my-work/department-work-panel";
import { createFileRoute } from "@tanstack/react-router";
import { ClientRequestsWorkspace } from "./_authenticated.requests.index";

export const Route = createFileRoute("/_authenticated/operations/")({
  head: () => ({ meta: [{ title: "Requests overview — Operations — AIMS" }] }),
  component: OperationsHome,
});

function OperationsHome() {
  const [toolsOpen, setToolsOpen] = useState(false);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Operations"
        description="Projects, work updates and team reports to the CEO."
      />
      <DepartmentWorkPanel departmentCode="operations" />
      <details
        className="rounded-lg border bg-card p-4"
        onToggle={(event) => setToolsOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-semibold">Client request tools</summary>
        {toolsOpen && (
          <div className="mt-4">
            <ClientRequestsWorkspace />
          </div>
        )}
      </details>
    </div>
  );
}
