import { useState } from "react";
import { Link } from "@tanstack/react-router";
import InboxOutlined from "@mui/icons-material/InboxOutlined";
import { useAccount } from "@/lib/account";
import { useWorkspace } from "@/lib/workspace";
import { useWeekly, weeklyTime } from "@/lib/weekly";
import {
  plainText,
  reportingDate,
  type ReportingRow,
  type ReportingView,
  type ReportingWorkspace,
} from "@/lib/reporting";
import { ReportingDetail } from "./ReportingDetail";
import {
  ReportingHeader,
  ReportingPanel,
  ReportingStats,
  ReportingTag,
  ReportingPagination,
} from "./ReportingUI";

export type ReportingFilters = {
  from: string;
  to: string;
  page: number;
  type: string;
  status: string;
  department: string;
  search: string;
  staff?: string | undefined;
};
export function ReportingWorkspacePage({
  view,
  filters,
  onFilter,
}: {
  view: ReportingView;
  filters: ReportingFilters;
  onFilter: (value: Partial<ReportingFilters>) => void;
}) {
  const { account } = useAccount();
  const { departments, deptName } = useWorkspace();
  const [selected, setSelected] = useState<ReportingRow | null>(null);
  const ceo = account?.role === "ceo";
  const apiView =
    view === "team-plans"
      ? "plans"
      : view === "team-reports"
        ? "reports"
        : view === "overview"
          ? "overview"
          : view === "performance"
            ? "performance"
            : "submissions";
  const { staff, ...rest } = filters;
  const params = new URLSearchParams({ ...rest, page: String(filters.page), view: apiView });
  if (staff) params.set("staff", staff);
  const query = useWeekly<ReportingWorkspace>(`workspace?${params}`);
  const data = query.data;
  const title =
    view === "overview"
      ? "Reporting overview"
      : view === "team-plans"
        ? "Team plans"
        : view === "team-reports"
          ? "Team reports"
          : view === "performance"
            ? "Staff performance"
            : ceo
              ? "Submission inbox"
              : "My submissions";
  if (selected) return <ReportingDetail row={selected} onBack={() => setSelected(null)} />;
  const pagination = data && (
    <ReportingPagination
      page={data.page}
      total={data.total}
      limit={data.limit}
      onPage={(page) => onFilter({ page })}
    />
  );
  const open = (row: ReportingRow) => setSelected(row);
  const inbox = (rows: ReportingRow[]) => (
    <>
      {rows.map((row) => (
        <div
          className={`inboxitem ${row.status === "submitted" && !row.historical ? "unread" : ""}`}
          key={row.id}
        >
          <span className="inboxicon">
            <InboxOutlined fontSize="small" />
          </span>
          <div className="inboxbody">
            <strong>
              {row.name} <span className="muted">{row.event.toLowerCase()}</span>
            </strong>
            <p>
              {row.title} | {row.period}
            </p>
            <div className="inboxmeta">
              {row.taskCount} tasks | {weeklyTime(row.date)}
            </div>
          </div>
          <div className="inboxactions">
            <ReportingTag status={row.status}>
              {row.historical
                ? "Previous version"
                : row.status === "submitted"
                  ? "New"
                  : row.status}
            </ReportingTag>
            <button className="btn secondary sm" onClick={() => open(row)}>
              Open review
            </button>
          </div>
        </div>
      ))}
      {!rows.length && <p className="report-empty">No submissions match these filters.</p>}
    </>
  );
  return (
    <>
      <ReportingHeader
        title={title}
        eyebrow={`${ceo ? "CEO" : "Staff"} workspace | ${view === "overview" ? "Management overview" : view === "performance" ? "Team delivery" : "Reporting"}`}
        subtitle={
          view === "overview"
            ? "A clear view of team commitments, delivery and reporting compliance."
            : view === "performance"
              ? "Track planning, reporting and task completion for the selected period."
              : ceo
                ? "Review team submissions and provide timely feedback."
                : "Review everything you have sent or scheduled for the CEO."
        }
        action={
          ceo && (
            <Link to="/weekly-brief" className="btn secondary">
              CEO email briefs
            </Link>
          )
        }
      />
      <div className="report-toolbar report-period">
        <label className="field">
          From
          <input
            aria-label="From date"
            type="date"
            value={filters.from}
            max={filters.to}
            onChange={(event) => {
              if (event.target.value) onFilter({ from: event.target.value, page: 1 });
            }}
          />
        </label>
        <label className="field">
          To
          <input
            aria-label="To date"
            type="date"
            value={filters.to}
            min={filters.from}
            onChange={(event) => {
              if (event.target.value) onFilter({ to: event.target.value, page: 1 });
            }}
          />
        </label>
        <label className="field">
          Department
          <select
            aria-label="Department"
            value={filters.department}
            onChange={(event) => onFilter({ department: event.target.value, page: 1 })}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option value={department.id} key={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        {ceo && (
          <Link to="/weekly-settings" className="btn secondary sm">
            Reporting schedules
          </Link>
        )}
      </div>
      {query.isPending && <p role="status">Loading reporting...</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {data && (
        <>
          {view === "overview" && (
            <>
              <ReportingStats
                items={[
                  {
                    label: "Active staff",
                    value: data.metrics.staff,
                    note: "Staff expected to report",
                  },
                  {
                    label: "Plans received",
                    value: data.metrics.plans,
                    note: `${data.metrics.expectedPlans} expected in this period`,
                  },
                  {
                    label: "Reports received",
                    value: data.metrics.reports,
                    note: `${data.metrics.expectedReports} expected in this period`,
                  },
                  {
                    label: "Awaiting review",
                    value: data.metrics.awaiting,
                    note: "Submissions requiring your review",
                  },
                ]}
              />
              <div className="report-grid">
                <div>
                  <ReportingPanel
                    title="Needs your attention"
                    action={
                      <Link
                        className="btn secondary sm"
                        to="/reporting"
                        search={{
                          view: "submissions",
                          from: filters.from,
                          to: filters.to,
                          status: "new",
                        }}
                      >
                        View all submissions
                      </Link>
                    }
                  >
                    {inbox(data.rows.filter((row) => row.status === "submitted").slice(0, 4))}
                  </ReportingPanel>
                  <ReportingPanel
                    title="Team submission status"
                    action={
                      <Link
                        className="btn secondary sm"
                        to="/reporting"
                        search={{ view: "performance", from: filters.from, to: filters.to }}
                      >
                        View team
                      </Link>
                    }
                  >
                    <div className="tablewrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Staff member</th>
                            <th>Department</th>
                            <th>Weekly plans</th>
                            <th>Weekly reports</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.performance.map((person) => (
                            <tr key={person.id}>
                              <td>
                                <b>{person.name}</b>
                              </td>
                              <td>{deptName(person.dept ?? "")}</td>
                              <td>
                                <ReportingTag
                                  status={
                                    person.plans >= person.expectedPlans && person.plans
                                      ? "submitted"
                                      : "draft"
                                  }
                                >
                                  {person.plans} / {person.expectedPlans}
                                </ReportingTag>
                              </td>
                              <td>
                                <ReportingTag
                                  status={
                                    person.reports >= person.expectedReports && person.reports
                                      ? "submitted"
                                      : "draft"
                                  }
                                >
                                  {person.reports} / {person.expectedReports}
                                </ReportingTag>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Link
                      className="btn secondary sm"
                      to="/reporting"
                      search={{ view: "performance", from: filters.from, to: filters.to }}
                    >
                      All staff and pagination
                    </Link>
                  </ReportingPanel>
                </div>
                <div>
                  <ReportingPanel title="Reporting compliance">
                    <div className="report-compliance-value">
                      {data.metrics.expectedPlans
                        ? Math.min(
                            100,
                            Math.round((data.metrics.plans / data.metrics.expectedPlans) * 100),
                          )
                        : 0}
                      %
                    </div>
                    <div className="progress">
                      <i
                        style={{
                          width: `${data.metrics.expectedPlans ? Math.min(100, (data.metrics.plans / data.metrics.expectedPlans) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <p className="tiny muted">Staff who have submitted a weekly plan.</p>
                    <div className="metricline">
                      <span>Plans submitted</span>
                      <b>
                        {data.metrics.plans} / {data.metrics.expectedPlans}
                      </b>
                    </div>
                    <div className="metricline">
                      <span>Reports submitted</span>
                      <b>
                        {data.metrics.reports} / {data.metrics.expectedReports}
                      </b>
                    </div>
                    <div className="metricline">
                      <span>Overdue reports</span>
                      <b>{data.metrics.overdueReports}</b>
                    </div>
                  </ReportingPanel>
                  <ReportingPanel title="Latest management activity">
                    {data.activity.map((event) => (
                      <div className="activity" key={event.id}>
                        <span className="dot" />
                        <div>
                          <strong>
                            {event.name} | {event.action}
                          </strong>
                          <p>{weeklyTime(event.date)}</p>
                        </div>
                      </div>
                    ))}
                    {!data.activity.length && (
                      <p className="report-empty">No activity in this period.</p>
                    )}
                  </ReportingPanel>
                </div>
              </div>
            </>
          )}
          {view !== "overview" && (
            <ReportingPanel>
              <div className="report-toolbar">
                {view !== "performance" && (
                  <>
                    <select
                      aria-label="Submission type"
                      value={filters.type}
                      onChange={(event) => onFilter({ type: event.target.value, page: 1 })}
                    >
                      <option value="">All submission types</option>
                      {view !== "team-reports" && <option value="plan">Weekly plans</option>}
                      {view !== "team-plans" && (
                        <>
                          <option value="report">Weekly reports</option>
                          <option value="monthly">Monthly reports</option>
                        </>
                      )}
                    </select>
                    <select
                      aria-label="Submission status"
                      value={filters.status}
                      onChange={(event) => onFilter({ status: event.target.value, page: 1 })}
                    >
                      <option value="">All statuses</option>
                      <option value="new">Awaiting review</option>
                      <option value="submitted">Submitted</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="returned">Needs attention</option>
                      <option value="recalled">Recalled</option>
                      {!ceo && (
                        <>
                          <option value="draft">Draft</option>
                          <option value="scheduled">Scheduled</option>
                        </>
                      )}
                    </select>
                  </>
                )}
                <input
                  aria-label="Search reporting"
                  className="search"
                  placeholder={
                    view === "performance"
                      ? "Search staff..."
                      : "Search staff, titles or content..."
                  }
                  value={filters.search}
                  onChange={(event) => onFilter({ search: event.target.value, page: 1 })}
                />
              </div>
              {view === "submissions" && ceo ? (
                inbox(data.rows)
              ) : view === "performance" ? (
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Staff member</th>
                        <th>Department</th>
                        <th>Plans submitted</th>
                        <th>Task completion</th>
                        <th>Reports submitted</th>
                        <th>Last activity</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.performance.map((person) => (
                        <tr key={person.id}>
                          <td>
                            <b>{person.name}</b>
                          </td>
                          <td>{deptName(person.dept ?? "")}</td>
                          <td>
                            {person.plans} / {person.expectedPlans}
                          </td>
                          <td>
                            <div className="report-between">
                              <b>{person.completion}%</b>
                              <span className="muted">
                                {person.completed}/{person.tasks}
                              </span>
                            </div>
                            <div className="progress">
                              <i style={{ width: `${person.completion}%` }} />
                            </div>
                          </td>
                          <td>
                            {person.reports} / {person.expectedReports}
                          </td>
                          <td>{weeklyTime(person.activity)}</td>
                          <td>
                            <Link
                              className="btn secondary sm"
                              to="/reporting"
                              search={{
                                view: "submissions",
                                staff: person.id,
                                from: filters.from,
                                to: filters.to,
                              }}
                            >
                              Profile
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        {ceo && (
                          <>
                            <th>Staff member</th>
                            <th>Department</th>
                          </>
                        )}
                        <th>{view === "team-plans" ? "Weekly focus" : "Submission"}</th>
                        <th>Period</th>
                        <th>{view === "team-reports" ? "Task outcomes" : "Tasks / updates"}</th>
                        <th>{view === "team-reports" ? "Summary" : "Date / time"}</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr key={row.id}>
                          {ceo && (
                            <>
                              <td>
                                <b>{row.name}</b>
                              </td>
                              <td>{deptName(row.dept ?? "")}</td>
                            </>
                          )}
                          <td>
                            <b>{row.title}</b>
                            {view === "team-plans" && (
                              <small className="report-cell-note">{plainText(row.summary)}</small>
                            )}
                            <small className="report-cell-note">
                              {row.type === "monthly" ? "Monthly report" : row.event}
                            </small>
                          </td>
                          <td>
                            {row.period.length === 7 ? row.period : reportingDate(row.period)}
                          </td>
                          <td>
                            {view === "team-reports" && row.entry ? (
                              <>
                                <span className="report-cell-note">
                                  {row.entry.counts["completed"] ?? 0} completed
                                </span>
                                <span className="report-cell-note">
                                  {row.entry.counts["in_progress"] ?? 0} in progress
                                </span>
                                <span className="report-cell-note">
                                  {row.entry.counts["blocked"] ?? 0} blocked
                                </span>
                              </>
                            ) : (
                              `${row.taskCount} tasks${row.updates ? ` | ${row.updates} updates` : ""}`
                            )}
                          </td>
                          <td className="report-summary-cell">
                            {view === "team-reports"
                              ? plainText(row.summary) || "No summary"
                              : weeklyTime(row.scheduledAt ?? row.date)}
                          </td>
                          <td>
                            <ReportingTag status={row.status}>
                              {row.historical ? "Previous version" : row.status}
                            </ReportingTag>
                          </td>
                          <td>
                            <button className="btn secondary sm" onClick={() => open(row)}>
                              {ceo ? "Review" : "View"}
                            </button>
                            {!ceo && !row.historical && row.entry && (
                              <Link
                                className="btn secondary sm"
                                to="/reporting"
                                search={{
                                  view: row.type === "plan" ? "weekly-plan" : "weekly-report",
                                  week: row.period,
                                }}
                              >
                                Edit
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!data.total && <p className="report-empty">No results match these filters.</p>}
              {pagination}
              {filters.staff && (
                <button
                  className="btn secondary sm"
                  onClick={() => onFilter({ staff: undefined, page: 1 })}
                >
                  Clear staff filter
                </button>
              )}
            </ReportingPanel>
          )}
        </>
      )}
    </>
  );
}
