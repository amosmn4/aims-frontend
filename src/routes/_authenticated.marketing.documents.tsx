import { createFileRoute } from "@tanstack/react-router";
import { DepartmentDocumentsPage } from "@/features/documents/documents-library";

export const Route = createFileRoute("/_authenticated/marketing/documents")({
  head: () => ({ meta: [{ title: "Marketing — Documents — AIMS" }] }),
  component: () => <DepartmentDocumentsPage code="marketing" />,
});
