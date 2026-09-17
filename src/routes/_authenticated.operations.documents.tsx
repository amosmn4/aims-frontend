import { createFileRoute } from "@tanstack/react-router";
import { DepartmentDocumentsPage } from "@/features/documents/documents-library";

export const Route = createFileRoute("/_authenticated/operations/documents")({
  head: () => ({ meta: [{ title: "Operations — Documents — AIMS" }] }),
  component: () => <DepartmentDocumentsPage code="operations" />,
});
