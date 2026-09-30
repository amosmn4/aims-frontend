import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { WithDepartment } from "@/components/nav/with-department";
import { DepartmentTaskBoard } from "./_authenticated.projects.department";

export const Route = createFileRoute("/_authenticated/marketing/tasks")({
  head: () => ({ meta: [{ title: "Tasks — AIMS" }] }),
  component: MarketingTasks,
});

function MarketingTasks() {
  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Every task on Marketing projects. Choose Mine to see only yours."
      />
      <WithDepartment code="marketing">
        {(dept) => <DepartmentTaskBoard departmentId={dept.id} />}
      </WithDepartment>
    </div>
  );
}
