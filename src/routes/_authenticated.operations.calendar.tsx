import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { WithDepartment } from "@/components/nav/with-department";
import { DeadlineCalendarView } from "./_authenticated.calendar";

export const Route = createFileRoute("/_authenticated/operations/calendar")({
  head: () => ({ meta: [{ title: "Calendar — AIMS" }] }),
  component: OperationsCalendar,
});

function OperationsCalendar() {
  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Deadlines and events for Operations. Select a day to add an event."
      />
      <WithDepartment code="operations">
        {(dept) => <DeadlineCalendarView departmentId={dept.id} />}
      </WithDepartment>
    </div>
  );
}
