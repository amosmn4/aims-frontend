import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader, Pill, Stat } from "@/components/kit";
import { useWorkspace } from "@/lib/workspace";
import { SearchField } from "@/components/RecordDialog";
import { Button } from "@/components/ui/button";
import { WeeklyEditor } from "@/components/weekly/WeeklyEditor";
import { WeeklyEntryView } from "@/components/weekly/WeeklyEntryView";
import { useAccount } from "@/lib/account";
import { isDemo } from "@/lib/api";
import {
  reportingWeek,
  useWeekly,
  weeklyStatus,
  type WeeklyDetail,
  type WeeklyOverview,
  type WeeklyPhase,
} from "@/lib/weekly";

export const Route = createFileRoute("/weekly-reports")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { week?: string; staff?: string; phase?: WeeklyPhase } => ({
    ...(typeof search["week"] === "string" ? { week: search["week"] } : {}),
    ...(typeof search["staff"] === "string" ? { staff: search["staff"] } : {}),
    ...(search["phase"] === "plan" || search["phase"] === "report"
      ? { phase: search["phase"] }
      : {}),
  }),
  head: () => ({
    meta: [{ title: "Weekly reporting | Amsol Ops" }, { name: "robots", content: "noindex" }],
  }),
  component: WeeklyReports,
});
function WeeklyReports() {
  const { account } = useAccount();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const week = search.week ?? reportingWeek();
  const phase = search.phase ?? "plan";
  const ceo = account?.role === "ceo";
  const staff = ceo ? search.staff : account?.id;
  const overview = useWeekly<WeeklyOverview>(`reports?week=${encodeURIComponent(week)}`);
  const detail = useWeekly<WeeklyDetail>(
    `reports/${encodeURIComponent(week)}/${encodeURIComponent(staff ?? "")}`,
    !!staff,
  );
  const [reload, setReload] = useState(0);
  const { departments, deptName } = useWorkspace();
  const [staffSearch, setStaffSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const staffRows = (overview.data?.staff ?? []).filter(
    (person) =>
      (!department || person.dept === department) &&
      person.name.toLowerCase().includes(staffSearch.toLowerCase()) &&
      (!status ||
        (status === "review"
          ? !!person[phase]?.submittedAt && !person[phase]?.reviewedAt
          : status === "submitted"
            ? !!person[phase]?.submittedAt
            : !person[phase]?.submittedAt && person.expected[phase])),
  );
  if (isDemo)
    return (
      <Card>
        Weekly reporting uses the connected backend. Sign in to the live workspace to submit plans
        and reports.
      </Card>
    );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Weekly reporting"
        subtitle="Plan the week, report its results, and retain each submitted version."
        action={
          ceo ? (
            <Link to="/weekly-brief" search={{ week, phase }} className="action-button">
              CEO email briefs
            </Link>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-end gap-4">
        <label className="field-label">
          Reporting week
          <input
            aria-label="Reporting week"
            className="field-input"
            type="date"
            value={week}
            step={7}
            onChange={(event) => {
              if (event.target.value)
                void navigate({
                  search: {
                    ...search,
                    week: reportingWeek(new Date(`${event.target.value}T12:00:00Z`)),
                  },
                });
            }}
          />
        </label>
        <div className="flex gap-2">
          {(["plan", "report"] as const).map((value) => (
            <Button
              key={value}
              variant={phase === value ? "default" : "outline"}
              onClick={() => {
                void navigate({ search: { ...search, week, phase: value } });
              }}
            >
              {value === "plan" ? "Weekly plans" : "Weekly reports"}
            </Button>
          ))}
        </div>
        {ceo && (
          <Link to="/weekly-settings" className="text-sm text-primary underline">
            Reporting schedules
          </Link>
        )}
      </div>
      {overview.error && (
        <p role="alert" className="rounded-lg border p-4">
          {overview.error.message}
        </p>
      )}
      {overview.isPending && <p role="status">Loading weekly reporting...</p>}
      {overview.data && !overview.data.configured && (
        <Card>
          {ceo ? (
            <p>
              Set submission deadlines and the two email schedules in{" "}
              <Link to="/weekly-settings" className="text-primary underline">
                Reporting schedules
              </Link>{" "}
              before staff begin submitting.
            </p>
          ) : (
            <p>The CEO has not configured weekly reporting yet.</p>
          )}
        </Card>
      )}
      {ceo && overview.data && (
        <Card>
          <h2 className="mb-4 font-display text-xl font-semibold">Staff submissions</h2>
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <Stat label="Staff in view" value={staffRows.length} />
            <Stat
              label="Submitted"
              value={staffRows.filter((person) => person[phase]?.submittedAt).length}
            />
            <Stat
              label="Awaiting review"
              value={
                staffRows.filter(
                  (person) => person[phase]?.submittedAt && !person[phase]?.reviewedAt,
                ).length
              }
            />
            <Stat
              label="Missing"
              value={
                staffRows.filter((person) => person.expected[phase] && !person[phase]?.submittedAt)
                  .length
              }
            />
          </div>
          <div className="mb-4 flex flex-wrap gap-3">
            <label className="field-label">
              Department
              <select
                className="field-input"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Status
              <select
                className="field-input"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">All</option>
                <option value="review">Awaiting review</option>
                <option value="submitted">Submitted</option>
                <option value="missing">Missing submission</option>
              </select>
            </label>
          </div>
          <SearchField
            value={staffSearch}
            onChange={setStaffSearch}
            placeholder="Search staff within these filters"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Staff</th>
                  <th className="p-3">Weekly plan</th>
                  <th className="p-3">Weekly report</th>
                  <th className="p-3">Task outcomes</th>
                </tr>
              </thead>
              <tbody>
                {staffRows.map((person) => (
                  <tr key={person.id} className="border-b">
                    <td className="p-3">
                      <Link
                        to="/weekly-reports"
                        search={{ week, staff: person.id, phase }}
                        className="font-medium text-primary underline"
                      >
                        {person.name}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {person.dept ? deptName(person.dept) : "No department"}
                      </p>
                    </td>
                    <td className="p-3">
                      <Pill>{weeklyStatus(person.plan, person.expected.plan)}</Pill>
                    </td>
                    <td className="p-3">
                      <Pill>{weeklyStatus(person.report, person.expected.report)}</Pill>
                    </td>
                    <td className="p-3 text-xs">
                      {person[phase]?.submittedAt
                        ? `${person[phase]!.submission.items.length} tasks | ${person[phase]!.submission.items.filter((item) => item.status === "completed").length} completed | ${person[phase]!.submission.items.filter((item) => item.priority === "Urgent").length} urgent`
                        : "Awaiting submission"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!staffRows.length && (
              <p className="p-4 text-sm text-muted-foreground">
                No staff submissions are expected for this week.
              </p>
            )}
          </div>
        </Card>
      )}
      {detail.error && <p role="alert">{detail.error.message}</p>}
      {detail.isLoading && staff && <p role="status">Loading submission...</p>}
      {detail.data && (!ceo || staffRows.some((person) => person.id === staff)) && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">
            {detail.data.person.name} | {week}
          </h2>
          {staff === account?.id &&
          detail.data.configured &&
          !detail.data[phase]?.submittedAt &&
          !detail.data[phase]?.reviewedAt ? (
            <WeeklyEditor
              key={`${staff}:${week}:${phase}:${reload}:${detail.data[phase]?.id ?? "new"}`}
              detail={detail.data}
              phase={phase}
              onReload={() => {
                void detail.refetch().then(() => setReload((value) => value + 1));
              }}
            />
          ) : detail.data[phase] ? (
            <WeeklyEntryView key={`${staff}:${week}:${phase}`} entry={detail.data[phase]!} />
          ) : (
            <Card>No {phase === "plan" ? "weekly plan" : "weekly report"} has been submitted.</Card>
          )}
        </section>
      )}
    </div>
  );
}
