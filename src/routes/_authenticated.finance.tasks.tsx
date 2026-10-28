import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { WithDepartment } from "@/components/nav/with-department";
import { DepartmentTaskBoard } from "./_authenticated.projects.department";

export const Route = createFileRoute("/_authenticated/finance/tasks")({
  head: () => ({ meta: [{ title: "Tasks — AIMS" }] }),
  component: FinanceTasks,
});

function FinanceTasks() {
  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Every task on Finance projects. Choose Mine to see only yours."
      />
      <WithDepartment code="finance">
        {(dept) => <DepartmentTaskBoard departmentId={dept.id} />}
      </WithDepartment>
    </div>
  );
}
