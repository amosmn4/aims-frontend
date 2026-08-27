import { createFileRoute } from "@tanstack/react-router";
import { OperationsReport } from "./_authenticated.reports.departments.operations";

export const Route = createFileRoute("/_authenticated/operations/reports")({
  head: () => ({ meta: [{ title: "Operations — Reports — AIMS" }] }),
  component: OperationsReport,
});
