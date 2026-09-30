import { createFileRoute } from "@tanstack/react-router";
import { WithDepartment } from "@/components/nav/with-department";
import { DepartmentWorkspaceContent } from "./_authenticated.departments.$deptId";

export const Route = createFileRoute("/_authenticated/tender/workspace")({
  head: () => ({ meta: [{ title: "Clients & contracts — AIMS" }] }),
  component: TenderClientsContracts,
});

function TenderClientsContracts() {
  return (
    <WithDepartment code="tender">
      {(dept) => <DepartmentWorkspaceContent deptId={dept.id} scoped />}
    </WithDepartment>
  );
}
