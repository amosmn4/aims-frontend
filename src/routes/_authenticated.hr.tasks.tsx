import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell";
import { WithDepartment } from "@/components/nav/with-department";
import { DepartmentTaskBoard } from "./_authenticated.projects.department";

export const Route = createFileRoute("/_authenticated/hr/tasks")({
  head: () => ({ meta: [{ title: "Tasks — AIMS" }] }),
  validateSearch: z.object({ overdue: z.boolean().optional().catch(undefined) }),
  component: HrTasks,
});

function HrTasks() {
  const { overdue } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Every task on HR projects. Choose Mine to see only yours."
      />
      <WithDepartment code="hr">
        {(dept) => (
          <DepartmentTaskBoard
            departmentId={dept.id}
            overdueOnly={overdue === true}
            onShowAllTasks={() => navigate({ search: {}, replace: true })}
          />
        )}
      </WithDepartment>
    </div>
  );
}
