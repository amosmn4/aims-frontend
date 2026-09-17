import { createFileRoute } from "@tanstack/react-router";
import { WithDepartment } from "@/components/nav/with-department";
import { DepartmentWorkspaceContent } from "./_authenticated.departments.$deptId";

export const Route = createFileRoute("/_authenticated/it/workspace")({
  head: () => ({ meta: [{ title: "Clients & contracts — AIMS" }] }),
  component: ItClientsContracts,
});

function ItClientsContracts() {
  return (
    <WithDepartment code="it">
      {(dept) => <DepartmentWorkspaceContent deptId={dept.id} scoped />}
    </WithDepartment>
  );
}
