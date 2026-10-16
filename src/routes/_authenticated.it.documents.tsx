import { createFileRoute } from "@tanstack/react-router";
import { DepartmentDocumentsPage } from "@/features/documents/documents-library";

export const Route = createFileRoute("/_authenticated/it/documents")({
  head: () => ({ meta: [{ title: "IT — Documents — AIMS" }] }),
  component: () => <DepartmentDocumentsPage code="it" />,
});
