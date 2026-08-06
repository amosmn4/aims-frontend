import { createFileRoute } from "@tanstack/react-router";
import { EngagementBoard } from "./_authenticated.pipeline.engagements";

export const Route = createFileRoute("/_authenticated/operations/requests")({
  head: () => ({ meta: [{ title: "Operations — Client Requests — AIMS" }] }),
  component: () => (
    <div className="pipeline-scope">
      <EngagementBoard />
    </div>
  ),
});
