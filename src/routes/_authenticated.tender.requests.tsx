import { createFileRoute } from "@tanstack/react-router";
import { EngagementBoard } from "./_authenticated.pipeline.engagements";

export const Route = createFileRoute("/_authenticated/tender/requests")({
  head: () => ({ meta: [{ title: "Tender — Client Requests — AIMS" }] }),
  component: () => (
    <div className="pipeline-scope">
      <EngagementBoard />
    </div>
  ),
});
