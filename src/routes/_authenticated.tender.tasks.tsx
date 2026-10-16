import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { WithDepartment } from "@/components/nav/with-department";
import { DepartmentTaskBoard } from "./_authenticated.projects.department";

export const Route = createFileRoute("/_authenticated/tender/tasks")({
  head: () => ({ meta: [{ title: "Tasks — AIMS" }] }),
  component: TenderTasks,
});

function TenderTasks() {
  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Every task on Tender projects. Choose Mine to see only yours."
      />
      <WithDepartment code="tender">
        {(dept) => <DepartmentTaskBoard departmentId={dept.id} />}
      </WithDepartment>
    </div>
  );
}
