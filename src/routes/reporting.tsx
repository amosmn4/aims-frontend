import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount } from "@/lib/account";
import { isDemo } from "@/lib/api";
import {
  reportingWeek,
  useWeekly,
  weeklyStatus,
  type WeeklyDetail,
  type WeeklyPhase,
} from "@/lib/weekly";
import { weekEnd, type ReportingView } from "@/lib/reporting";
import { WeeklyReportingPage } from "@/components/reporting/WeeklyReportingPage";
import { ReportingWorkspacePage } from "@/components/reporting/ReportingWorkspacePage";
import { ReportingDetail } from "@/components/reporting/ReportingDetail";

type ReportingSearch = {
  view?: ReportingView | "detail";
  week?: string;
  from?: string;
  to?: string;
  page?: number;
  type?: string;
  status?: string;
  department?: string;
  search?: string;
  staff?: string | undefined;
  phase?: WeeklyPhase;
};
const views = [
  "overview",
  "weekly-plan",
  "weekly-report",
  "submissions",
  "team-plans",
  "team-reports",
  "performance",
  "detail",
];
export const Route = createFileRoute("/reporting")({
  validateSearch: (raw: Record<string, unknown>): ReportingSearch => ({
    ...(typeof raw["view"] === "string" && views.includes(raw["view"])
      ? { view: raw["view"] as Exclude<ReportingSearch["view"], undefined> }
      : {}),
    ...Object.fromEntries(
      ["week", "from", "to", "type", "status", "department", "search", "staff"].flatMap((key) =>
        typeof raw[key] === "string" ? [[key, raw[key]]] : [],
      ),
    ),
    ...(raw["phase"] === "plan" || raw["phase"] === "report" ? { phase: raw["phase"] } : {}),
    ...(Number.isInteger(Number(raw["page"])) && Number(raw["page"]) > 0
      ? { page: Number(raw["page"]) }
      : {}),
  }),
  head: () => ({
    meta: [{ title: "Reporting | Amsol Ops" }, { name: "robots", content: "noindex" }],
  }),
  component: Reporting,
});
function Reporting() {
  const { account } = useAccount();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const ceo = account?.role === "ceo";
  const view = search.view ?? (ceo ? "overview" : "weekly-plan");
  const selectedWeek = search.week ?? reportingWeek();
  const selectedDate = new Date(`${selectedWeek}T12:00:00Z`);
  const validWeek =
    /^\d{4}-\d{2}-\d{2}$/.test(selectedWeek) &&
    Number.isFinite(selectedDate.getTime()) &&
    selectedDate.toISOString().slice(0, 10) === selectedWeek;
  const week = validWeek ? reportingWeek(selectedDate) : reportingWeek();
  if (!validWeek) return <p role="alert">Choose a valid reporting week.</p>;
  if (isDemo)
    return (
      <div className="reporting">
        <p>Sign in to the connected workspace to use reporting.</p>
      </div>
    );
  if (!account || !["staff", "ceo"].includes(account.role))
    return <p>Reporting access is restricted to staff and CEO accounts.</p>;
  if (!ceo && ["overview", "team-plans", "team-reports", "performance"].includes(view))
    return <p>CEO access is required.</p>;
  return (
    <div className="reporting">
      {view === "detail" ? (
        <DirectDetail
          week={week}
          phase={search.phase ?? "plan"}
          staff={search.staff ?? account.id}
          onBack={() => {
            void navigate({ search: { view: "submissions", from: week, to: weekEnd(week) } });
          }}
        />
      ) : view === "weekly-plan" || view === "weekly-report" ? (
        ceo ? (
          <p>
            Use{" "}
            <Link to="/reporting" search={{ view: "team-plans" }}>
              Team plans
            </Link>{" "}
            to review staff commitments.
          </p>
        ) : (
          <WeeklyReportingPage
            key={`${week}-${view}`}
            phase={view === "weekly-plan" ? "plan" : "report"}
            week={week}
            onWeek={(value) => {
              void navigate({
                search: { ...search, week: reportingWeek(new Date(`${value}T12:00:00Z`)) },
              });
            }}
          />
        )
      ) : (
        <ReportingWorkspacePage
          key={view}
          view={view}
          filters={{
            from: search.from ?? week,
            to: search.to ?? weekEnd(week),
            page: search.page ?? 1,
            type: search.type ?? "",
            status: search.status ?? "",
            department: search.department ?? "",
            search: search.search ?? "",
            staff: search.staff,
          }}
          onFilter={(value) => {
            void navigate({ search: { ...search, ...value } });
          }}
        />
      )}
    </div>
  );
}
function DirectDetail({
  week,
  staff,
  phase,
  onBack,
}: {
  week: string;
  staff: string;
  phase: WeeklyPhase;
  onBack: () => void;
}) {
  const query = useWeekly<WeeklyDetail>(`reports/${week}/${staff}`);
  if (query.isPending) return <p role="status">Loading submission...</p>;
  if (query.error) return <p role="alert">{query.error.message}</p>;
  const entry = query.data?.[phase];
  if (!entry || !query.data) return <p>No submission for this period.</p>;
  return (
    <ReportingDetail
      row={{
        id: entry.id,
        staffId: staff,
        name: query.data.person.name,
        dept: query.data.person.dept,
        type: phase,
        period: week,
        date: entry.submittedAt ?? entry.updatedAt,
        status: weeklyStatus(entry),
        title: entry.submission.title || `Weekly ${phase}`,
        summary: entry.submission.summary,
        taskCount: entry.submission.items.length,
        updates: 0,
        entry,
        historical: false,
        scheduledAt: null,
        event: `Weekly ${phase}`,
      }}
      onBack={onBack}
    />
  );
}
