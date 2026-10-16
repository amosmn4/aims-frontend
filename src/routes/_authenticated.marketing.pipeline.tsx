import { createFileRoute } from "@tanstack/react-router";
import { WithDepartment } from "@/components/nav/with-department";
import { EngagementBoard } from "./_authenticated.pipeline.engagements";

export const Route = createFileRoute("/_authenticated/marketing/pipeline")({
  head: () => ({ meta: [{ title: "Client requests — AIMS" }] }),
  component: MarketingClientRequests,
});

function MarketingClientRequests() {
  return (
    <WithDepartment code="marketing">
      {(dept) => (
        <div className="pipeline-scope">
          <EngagementBoard departmentId={dept.id} />
        </div>
      )}
    </WithDepartment>
  );
}
