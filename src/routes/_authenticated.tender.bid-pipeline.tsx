import { createFileRoute } from "@tanstack/react-router";
import { TenderPipelineBoard } from "./_authenticated.pipeline.tenders";

export const Route = createFileRoute("/_authenticated/tender/bid-pipeline")({
  head: () => ({ meta: [{ title: "Tender — Bid Pipeline — AIMS" }] }),
  component: () => (
    <div className="pipeline-scope">
      <TenderPipelineBoard />
    </div>
  ),
});
