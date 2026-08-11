import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { DepartmentWorkspaceContent } from "./_authenticated.departments.$deptId";

export const Route = createFileRoute("/_authenticated/finance/workspace")({
  head: () => ({ meta: [{ title: "Finance — Workspace — AIMS" }] }),
  component: FinanceWorkspace,
});

function FinanceWorkspace() {
  const departmentsQ = useDepartments();
  const dept = departmentsQ.data?.find((d) => d.code === "finance");
  if (!dept) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return <DepartmentWorkspaceContent deptId={dept.id} scoped />;
}
