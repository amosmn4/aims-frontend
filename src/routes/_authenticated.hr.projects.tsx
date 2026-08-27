import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { ProjectsDeliveryBoard } from "./_authenticated.pipeline.projects";

export const Route = createFileRoute("/_authenticated/hr/projects")({
  head: () => ({ meta: [{ title: "HR — Work & Projects — AIMS" }] }),
  component: HrProjects,
});

// Projects routed to HR (from a won tender, a converted client request, or created directly),
// locked to HR's own department id — the exact same board/data as the central Pipeline's
// Delivery Board (_authenticated.pipeline.projects.tsx), just pre-filtered, so a stage update
// made here is the same update reflected there.
function HrProjects() {
  const departmentsQ = useDepartments();
  const hrDept = departmentsQ.data?.find((d) => d.code === "hr");

  if (!hrDept) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pipeline-scope">
      <ProjectsDeliveryBoard fixedDepartmentId={hrDept.id} />
    </div>
  );
}
