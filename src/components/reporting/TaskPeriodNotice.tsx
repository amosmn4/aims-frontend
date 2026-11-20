import { isDemo } from "@/lib/api";
import { reportingWeek, useWeekly, type WeeklyDetail } from "@/lib/weekly";
import { validDate } from "@/lib/text";

export function TaskPeriodNotice({ period, staff }: { period: string; staff: string }) {
  const week = validDate(period) ? reportingWeek(new Date(`${period}T12:00:00Z`)) : "";
  const query = useWeekly<WeeklyDetail>(`reports/${week}/${staff}`, !!week && !!staff);
  if (!period)
    return (
      <span>
        A period is optional. Choose a date within the week to link this task to its plan.
      </span>
    );
  if (isDemo) return <span>This task will use the selected reporting week.</span>;
  if (query.isPending) return <span role="status">Checking the plan for this period...</span>;
  if (query.error)
    return (
      <span role="alert">
        The plan could not be checked. Its link will be checked when you save.
      </span>
    );
  if (!query.data?.plan)
    return (
      <span role="status">
        No plan exists for this period. The task will be saved and included automatically when the
        plan is created.
      </span>
    );
  if (query.data.plan.submittedAt && !query.data.plan.editable)
    return (
      <span role="status">
        This plan is closed. Choose another period or leave the period empty.
      </span>
    );
  return <span role="status">This task will be added to the plan for the week of {week}.</span>;
}
