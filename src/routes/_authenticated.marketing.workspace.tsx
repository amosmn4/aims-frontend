import { createFileRoute } from "@tanstack/react-router";
import { WithDepartment } from "@/components/nav/with-department";
import { DepartmentWorkspaceContent } from "./_authenticated.departments.$deptId";

export const Route = createFileRoute("/_authenticated/marketing/workspace")({
  head: () => ({ meta: [{ title: "Clients & contracts — AIMS" }] }),
  component: MarketingClientsContracts,
});

function MarketingClientsContracts() {
  return (
    <WithDepartment code="marketing">
      {(dept) => <DepartmentWorkspaceContent deptId={dept.id} scoped />}
    </WithDepartment>
  );
}
