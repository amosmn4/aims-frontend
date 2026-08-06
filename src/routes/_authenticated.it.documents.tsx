import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { DocumentsLibrary } from "./_authenticated.documents";

export const Route = createFileRoute("/_authenticated/it/documents")({
  head: () => ({ meta: [{ title: "IT — Documents — AIMS" }] }),
  component: ItDocuments,
});

function ItDocuments() {
  const departmentsQ = useDepartments();
  const dept = departmentsQ.data?.find((d) => d.code === "it");
  if (!dept) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return <DocumentsLibrary departmentId={dept.id} />;
}
