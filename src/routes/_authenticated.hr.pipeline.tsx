import { createFileRoute } from "@tanstack/react-router";
import { WithDepartment } from "@/components/nav/with-department";
import { EngagementBoard } from "./_authenticated.pipeline.engagements";

export const Route = createFileRoute("/_authenticated/hr/pipeline")({
  head: () => ({ meta: [{ title: "Client requests — AIMS" }] }),
  component: HrClientRequests,
});

function HrClientRequests() {
  return (
    <WithDepartment code="hr">
      {(dept) => (
        <div className="pipeline-scope">
          <EngagementBoard departmentId={dept.id} />
        </div>
      )}
    </WithDepartment>
  );
}
