import { createFileRoute } from "@tanstack/react-router";
import { ItReport } from "./_authenticated.reports.departments.it";

export const Route = createFileRoute("/_authenticated/it/reports")({
  head: () => ({ meta: [{ title: "IT — Reports — AIMS" }] }),
  component: ItReport,
});
