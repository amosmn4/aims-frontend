import { createFileRoute } from "@tanstack/react-router";
import { MarketingReport } from "./_authenticated.reports.departments.marketing";

export const Route = createFileRoute("/_authenticated/marketing/reports")({
  head: () => ({ meta: [{ title: "Marketing — Reports — AIMS" }] }),
  component: MarketingReport,
});
