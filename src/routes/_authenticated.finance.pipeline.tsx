import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { EngagementBoard } from "./_authenticated.pipeline.engagements";

export const Route = createFileRoute("/_authenticated/finance/pipeline")({
  head: () => ({ meta: [{ title: "Finance — Pipeline — AIMS" }] }),
  component: FinancePipeline,
});

// Same client-request board as the central /pipeline/engagements view, scoped to Finance —
// see _authenticated.pipeline.engagements.tsx for the shared component.
function FinancePipeline() {
  const departmentsQ = useDepartments();
  const dept = departmentsQ.data?.find((d) => d.code === "finance");
  if (!dept) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="pipeline-scope">
      <EngagementBoard departmentId={dept.id} />
    </div>
  );
}
