import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { DeadlineCalendarView } from "./_authenticated.calendar";

export const Route = createFileRoute("/_authenticated/tender/calendar")({
  head: () => ({ meta: [{ title: "Tender — Calendar — AIMS" }] }),
  component: TenderCalendar,
});

function TenderCalendar() {
  const departmentsQ = useDepartments();
  const dept = departmentsQ.data?.find((d) => d.code === "tender");
  if (!dept) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return <DeadlineCalendarView departmentId={dept.id} />;
}
