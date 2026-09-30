import { createFileRoute } from "@tanstack/react-router";
import { EngagementBoard } from "./_authenticated.pipeline.engagements";

export const Route = createFileRoute("/_authenticated/tender/requests")({
  head: () => ({ meta: [{ title: "Client requests — AIMS" }] }),
  component: () => (
    <div className="pipeline-scope">
      <EngagementBoard />
    </div>
  ),
});
