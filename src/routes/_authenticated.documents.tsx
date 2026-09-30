import { createFileRoute } from "@tanstack/react-router";
import { CompanyDocuments } from "@/features/documents/documents-library";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Documents — AIMS" }] }),
  component: CompanyDocuments,
});
