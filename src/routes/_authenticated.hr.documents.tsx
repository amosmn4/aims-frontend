import { createFileRoute } from "@tanstack/react-router";
import { DepartmentDocumentsPage } from "@/features/documents/documents-library";

export const Route = createFileRoute("/_authenticated/hr/documents")({
  head: () => ({ meta: [{ title: "HR — Documents — AIMS" }] }),
  component: () => <DepartmentDocumentsPage code="hr" />,
});
