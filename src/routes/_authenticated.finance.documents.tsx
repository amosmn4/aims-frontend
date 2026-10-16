import { createFileRoute } from "@tanstack/react-router";
import { DepartmentDocumentsPage } from "@/features/documents/documents-library";

export const Route = createFileRoute("/_authenticated/finance/documents")({
  head: () => ({ meta: [{ title: "Finance — Documents — AIMS" }] }),
  component: () => <DepartmentDocumentsPage code="finance" />,
});
