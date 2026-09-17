import { createFileRoute } from "@tanstack/react-router";
import { WithDepartment } from "@/components/nav/with-department";
import { DepartmentWorkspaceContent } from "./_authenticated.departments.$deptId";

export const Route = createFileRoute("/_authenticated/operations/workspace")({
  head: () => ({ meta: [{ title: "Clients & contracts — AIMS" }] }),
  component: OperationsClientsContracts,
});

function OperationsClientsContracts() {
  return (
    <WithDepartment code="operations">
      {(dept) => <DepartmentWorkspaceContent deptId={dept.id} scoped />}
    </WithDepartment>
  );
}
