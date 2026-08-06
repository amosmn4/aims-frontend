import { createFileRoute } from "@tanstack/react-router";
import { TenderReport } from "./_authenticated.reports.departments.tender";

export const Route = createFileRoute("/_authenticated/tender/reports")({
  head: () => ({ meta: [{ title: "Tender — Reports — AIMS" }] }),
  component: TenderReport,
});
