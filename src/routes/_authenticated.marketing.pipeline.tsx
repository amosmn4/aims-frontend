import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { EngagementBoard } from "./_authenticated.pipeline.engagements";

export const Route = createFileRoute("/_authenticated/marketing/pipeline")({
  head: () => ({ meta: [{ title: "Marketing — Pipeline — AIMS" }] }),
  component: MarketingPipeline,
});

function MarketingPipeline() {
  const departmentsQ = useDepartments();
  const dept = departmentsQ.data?.find((d) => d.code === "marketing");
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
