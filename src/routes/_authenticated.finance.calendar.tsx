import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { WithDepartment } from "@/components/nav/with-department";
import { DeadlineCalendarView } from "./_authenticated.calendar";

export const Route = createFileRoute("/_authenticated/finance/calendar")({
  head: () => ({ meta: [{ title: "Calendar — AIMS" }] }),
  component: FinanceCalendar,
});

function FinanceCalendar() {
  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Deadlines and events for Finance. Select a day to add an event."
      />
      <WithDepartment code="finance">
        {(dept) => <DeadlineCalendarView departmentId={dept.id} />}
      </WithDepartment>
    </div>
  );
}
