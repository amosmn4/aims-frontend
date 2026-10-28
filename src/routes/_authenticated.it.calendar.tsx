import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { WithDepartment } from "@/components/nav/with-department";
import { DeadlineCalendarView } from "./_authenticated.calendar";

export const Route = createFileRoute("/_authenticated/it/calendar")({
  head: () => ({ meta: [{ title: "Calendar — AIMS" }] }),
  component: ItCalendar,
});

function ItCalendar() {
  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Deadlines and events for IT. Select a day to add an event."
      />
      <WithDepartment code="it">
        {(dept) => <DeadlineCalendarView departmentId={dept.id} />}
      </WithDepartment>
    </div>
  );
}
