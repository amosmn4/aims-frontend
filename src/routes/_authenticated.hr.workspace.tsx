import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { DepartmentWorkspaceContent } from "./_authenticated.departments.$deptId";

export const Route = createFileRoute("/_authenticated/hr/workspace")({
  head: () => ({ meta: [{ title: "HR — Workspace — AIMS" }] }),
  component: HrWorkspace,
});

function HrWorkspace() {
  const departmentsQ = useDepartments();
  const dept = departmentsQ.data?.find((d) => d.code === "hr");
  if (!dept) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return <DepartmentWorkspaceContent deptId={dept.id} />;
}
