import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { WithDepartment } from "@/components/nav/with-department";
import { DeadlineCalendarView } from "./_authenticated.calendar";

export const Route = createFileRoute("/_authenticated/tender/calendar")({
  head: () => ({ meta: [{ title: "Calendar — AIMS" }] }),
  component: TenderCalendar,
});

function TenderCalendar() {
  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Deadlines and events for Tender. Select a day to add an event."
      />
      <WithDepartment code="tender">
        {(dept) => <DeadlineCalendarView departmentId={dept.id} />}
      </WithDepartment>
    </div>
  );
}
