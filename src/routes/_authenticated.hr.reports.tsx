import { createFileRoute } from "@tanstack/react-router";
import { HrReport } from "./_authenticated.reports.departments.hr";

export const Route = createFileRoute("/_authenticated/hr/reports")({
  head: () => ({ meta: [{ title: "HR — Reports — AIMS" }] }),
  component: HrReport,
});
