import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { EngagementBoard } from "./_authenticated.pipeline.engagements";

export const Route = createFileRoute("/_authenticated/it/pipeline")({
  head: () => ({ meta: [{ title: "IT — Pipeline — AIMS" }] }),
  component: ItPipeline,
});

function ItPipeline() {
  const departmentsQ = useDepartments();
  const dept = departmentsQ.data?.find((d) => d.code === "it");
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
