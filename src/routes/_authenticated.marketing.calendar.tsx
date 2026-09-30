import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { WithDepartment } from "@/components/nav/with-department";
import { DeadlineCalendarView } from "./_authenticated.calendar";

export const Route = createFileRoute("/_authenticated/marketing/calendar")({
  head: () => ({ meta: [{ title: "Calendar — AIMS" }] }),
  component: MarketingCalendar,
});

function MarketingCalendar() {
  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Deadlines and events for Marketing. Select a day to add an event."
      />
      <WithDepartment code="marketing">
        {(dept) => <DeadlineCalendarView departmentId={dept.id} />}
      </WithDepartment>
    </div>
  );
}
