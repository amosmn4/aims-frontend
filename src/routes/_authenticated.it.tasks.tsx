import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { WithDepartment } from "@/components/nav/with-department";
import { DepartmentTaskBoard } from "./_authenticated.projects.department";

export const Route = createFileRoute("/_authenticated/it/tasks")({
  head: () => ({ meta: [{ title: "Tasks — AIMS" }] }),
  component: ItTasks,
});

function ItTasks() {
  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Every task on IT projects. Choose Mine to see only yours."
      />
      <WithDepartment code="it">
        {(dept) => <DepartmentTaskBoard departmentId={dept.id} />}
      </WithDepartment>
    </div>
  );
}
