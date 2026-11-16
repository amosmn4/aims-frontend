import { Link } from "@tanstack/react-router";
import { Card } from "@/components/kit";
import { useAccount } from "@/lib/account";
import { isDemo } from "@/lib/api";
import { useWeekly, weeklyTime, type WeeklyOverview } from "@/lib/weekly";

export function WeeklyReminder() {
  const { account } = useAccount();
  const weekly = useWeekly<WeeklyOverview>("reports");
  if (isDemo || !weekly.data?.configured) return null;
  const data = weekly.data;
  const pending = data.staff.reduce(
    (count, person) =>
      count +
      [person.plan, person.report].filter((entry) => entry?.submittedAt && !entry.reviewedAt)
        .length,
    0,
  );
  const own = data.staff.find((person) => person.id === account?.id);
  return (
    <div className="mb-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Weekly plans and reports</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {account?.role === "ceo"
                ? `${pending} submitted records await review this week.`
                : `Plan: ${own?.plan?.submittedAt ? "Submitted" : `due ${weeklyTime(data.deadlines.plan)}`}. Report: ${own?.report?.submittedAt ? "Submitted" : `due ${weeklyTime(data.deadlines.report)}`}.`}
            </p>
          </div>
          <Link to="/weekly-reports" className="text-sm font-medium text-primary underline">
            {account?.role === "ceo" ? "Review weekly reporting" : "Open my weekly reporting"}
          </Link>
        </div>
      </Card>
    </div>
  );
}
