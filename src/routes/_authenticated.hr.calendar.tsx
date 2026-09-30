import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { WithDepartment } from "@/components/nav/with-department";
import { DeadlineCalendarView } from "./_authenticated.calendar";

export const Route = createFileRoute("/_authenticated/hr/calendar")({
  head: () => ({ meta: [{ title: "Calendar — AIMS" }] }),
  component: HrCalendar,
});

function HrCalendar() {
  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Deadlines and events for HR. Select a day to add an event."
      />
      <WithDepartment code="hr">
        {(dept) => <DeadlineCalendarView departmentId={dept.id} />}
      </WithDepartment>
    </div>
  );
}
