import { createFileRoute } from "@tanstack/react-router";
import { WithDepartment } from "@/components/nav/with-department";
import { DepartmentWorkspaceContent } from "./_authenticated.departments.$deptId";

export const Route = createFileRoute("/_authenticated/hr/workspace")({
  head: () => ({ meta: [{ title: "Clients & contracts — AIMS" }] }),
  component: HrClientsContracts,
});

function HrClientsContracts() {
  return (
    <WithDepartment code="hr">
      {(dept) => <DepartmentWorkspaceContent deptId={dept.id} scoped />}
    </WithDepartment>
  );
}
