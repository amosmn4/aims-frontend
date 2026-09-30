import { createFileRoute } from "@tanstack/react-router";
import { WithDepartment } from "@/components/nav/with-department";
import { EngagementBoard } from "./_authenticated.pipeline.engagements";

export const Route = createFileRoute("/_authenticated/finance/pipeline")({
  head: () => ({ meta: [{ title: "Client requests — AIMS" }] }),
  component: FinanceClientRequests,
});

function FinanceClientRequests() {
  return (
    <WithDepartment code="finance">
      {(dept) => (
        <div className="pipeline-scope">
          <EngagementBoard departmentId={dept.id} />
        </div>
      )}
    </WithDepartment>
  );
}
