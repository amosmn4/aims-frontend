import { Link } from "@tanstack/react-router";
import AddOutlined from "@mui/icons-material/AddOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import { TaskStatusBadge } from "@/components/TaskStatusBadge";
import { taskStatusKey } from "@/lib/task-content";
import UndoOutlined from "@mui/icons-material/UndoOutlined";
import { useSubmissionSchedules } from "@/lib/reporting";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "@/lib/account";
import { useRole } from "@/lib/role";
import { api, isDemo } from "@/lib/api";
import { loadWorkspace, perform } from "@/lib/workspace";
import { confirmDialog } from "@/production/components/confirm-dialog";
import {
  reportingWeek,
  reportItems,
  useWeekly,
  weeklyStatus,
  weeklyTime,
  type WeeklyDetail,
} from "@/lib/weekly";
import { reportingDate, weekEnd, type ReportingWorkspace } from "@/lib/reporting";
import { ReportingHeader, ReportingPanel, ReportingStats, ReportingTag } from "./ReportingUI";

export function StaffReportingDashboard() {
  const { account } = useAccount();
  const { me } = useRole();
  const client = useQueryClient();
  const week = reportingWeek();
  const detail = useWeekly<WeeklyDetail>(`reports/${week}/${account?.id ?? ""}`);
  const activity = useWeekly<ReportingWorkspace>(
    `workspace?view=submissions&from=${week}&to=${weekEnd(week)}`,
  );
  const data = detail.data;
  const schedules = useSubmissionSchedules();
  const scheduled = (phase: string) =>
    schedules.data?.some(
      (row) => row.kind === phase && row.target === week && row.status === "pending",
    );
  if (isDemo)
    return (
      <div className="reporting">
        <p>Sign in to the connected workspace to view your reporting dashboard.</p>
      </div>
    );
  if (detail.isPending)
    return (
      <div className="reporting">
        <p role="status">Loading your dashboard...</p>
      </div>
    );
  if (detail.error)
    return (
      <div className="reporting">
        <p role="alert">{detail.error.message}</p>
      </div>
    );
  if (!data) return null;
  const tasks = reportItems(data).map((item) => ({
    ...item,
    status:
      data.tasks.find((task) => task.id === (item.taskId ?? item.id))?.status === "Done"
        ? "completed"
        : item.status,
  }));
  const done = tasks.filter((item) => item.status === "completed").length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const now = new Date(data.now);
  const greeting =
    Number(
      now.toLocaleTimeString("en-GB", {
        timeZone: "Africa/Nairobi",
        hour: "2-digit",
        hour12: false,
      }),
    ) < 12
      ? "Good morning"
      : "Good afternoon";
  const planStatus = scheduled("plan") ? "Scheduled" : weeklyStatus(data.plan);
  const reportStatus = scheduled("report") ? "Scheduled" : weeklyStatus(data.report);
  const recall = async () => {
    if (
      !data.plan ||
      !(await confirmDialog({
        title: "Recall weekly plan?",
        description:
          "Your submitted version stays in the history. Edit the draft and submit it again when ready.",
        confirmLabel: "Recall plan",
      }))
    )
      return;
    if (
      await perform(async () => {
        await api(`/weekly/submissions/${data.plan!.id}/recall`, {
          method: "POST",
          body: JSON.stringify({ version: data.plan!.version }),
        });
      }, "Plan recalled")
    ) {
      await client.invalidateQueries({ queryKey: ["weekly"] });
      await client.invalidateQueries({ queryKey: ["submission-schedules"] });
      await loadWorkspace();
    }
  };
  return (
    <div className="reporting">
      <ReportingHeader
        title={`${greeting}, ${me.name.split(" ")[0]}`}
        eyebrow={`Staff workspace | ${now.toLocaleDateString("en-GB", { timeZone: "Africa/Nairobi", weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
        subtitle="Plan your week, track delivery and keep the CEO informed."
        action={
          <Link className="btn primary" to="/reporting" search={{ view: "weekly-plan", week }}>
            <AddOutlined fontSize="inherit" /> Create weekly plan
          </Link>
        }
      />
      <ReportingStats
        items={[
          { label: "Tasks this week", value: tasks.length, note: "In your active reporting week" },
          {
            label: "Completed",
            value: done,
            note: "Tasks marked complete",
            icon: <CheckOutlined fontSize="inherit" />,
          },
          {
            label: "Plan delivery",
            value: scheduled("plan")
              ? "Scheduled"
              : data.plan?.submittedAt
                ? "Submitted"
                : data.plan?.recalledAt
                  ? "Recalled"
                  : "Not submitted",
            note: data.plan?.submittedAt
              ? "CEO received your plan"
              : "Prepare your weekly commitments",
          },
          {
            label: "Weekly report",
            value: scheduled("report")
              ? "Scheduled"
              : data.report?.reviewedAt
                ? "Reviewed"
                : data.report?.submittedAt
                  ? "Submitted"
                  : "Draft",
            note: `Due ${weeklyTime(data.deadlines.report)}`,
          },
        ]}
      />
      {!data.configured && (
        <div className="notice">
          Weekly reporting schedules have not been configured by the CEO yet.
        </div>
      )}
      <div className="report-grid">
        <div>
          <ReportingPanel
            title="My active weekly plan"
            action={<ReportingTag status={planStatus}>{planStatus}</ReportingTag>}
          >
            <div className="weekbanner">
              <div>
                <strong>
                  {reportingDate(week)} to {reportingDate(data.weekEnd)}
                </strong>
                <small>
                  {data.plan?.submittedAt
                    ? `Initial submission | ${weeklyTime(data.plan.submittedAt)}`
                    : "Your weekly commitments"}
                </small>
              </div>
              <Link
                className="btn secondary sm"
                to="/reporting"
                search={{ view: "weekly-plan", week }}
              >
                Manage plan
              </Link>
            </div>
            <div className="report-between tiny muted">
              <b>Task completion</b>
              <span>
                {done} of {tasks.length} completed
              </span>
            </div>
            <div className="progress">
              <i style={{ width: `${percent}%` }} />
            </div>
            {tasks.slice(0, 5).map((item) => (
              <div
                className="taskrow task-status-edge"
                data-task-status={taskStatusKey(item.status)}
                key={item.id}
              >
                <span className={`taskcheck ${item.status === "completed" ? "done" : ""}`}>
                  {item.status === "completed" && <CheckOutlined fontSize="inherit" />}
                </span>
                <div className="taskbody">
                  <strong>{item.title}</strong>
                  <small>{item.due ? `Due ${reportingDate(item.due)}` : "This week"}</small>
                  <TaskStatusBadge status={item.status} />
                </div>
                <ReportingTag
                  status={item.priority === "High" || item.priority === "Urgent" ? "attention" : ""}
                >
                  {item.priority ?? "Medium"}
                </ReportingTag>
              </div>
            ))}
            {!tasks.length && (
              <p className="report-empty">Add tasks to start planning your week.</p>
            )}
            <div className="notice">
              You can add tasks after submitting your plan. Each update remains traceable in your
              submission history.
            </div>
          </ReportingPanel>
          <ReportingPanel
            title="Recent activity"
            action={
              <Link className="btn secondary sm" to="/reporting" search={{ view: "submissions" }}>
                Full history
              </Link>
            }
          >
            {activity.error && <p role="alert">{activity.error.message}</p>}
            {activity.data?.activity.map((item) => (
              <div className="activity" key={item.id}>
                <span className="dot" />
                <div>
                  <strong>
                    Weekly {item.phase} {item.action}
                  </strong>
                  <p>{weeklyTime(item.date)}</p>
                </div>
              </div>
            ))}
            {activity.data && !activity.data.activity.length && (
              <p className="report-empty">Your reporting activity will appear here.</p>
            )}
          </ReportingPanel>
        </div>
        <div>
          <ReportingPanel
            title="Important dates"
            action={<span className="tiny muted">This week</span>}
          >
            {[
              ["Weekly report due", weeklyTime(data.deadlines.report)],
              ["Close outstanding tasks", reportingDate(data.weekEnd)],
              ["Next planning week", reportingDate(weekEnd(week, 7))],
            ].map(([title, date]) => (
              <div className="activity" key={title}>
                <span className="dot" />
                <div>
                  <strong>{title}</strong>
                  <p>{date}</p>
                </div>
              </div>
            ))}
          </ReportingPanel>
          <ReportingPanel title="Quick actions">
            <div className="quickactions">
              <Link className="btn soft" to="/reporting" search={{ view: "weekly-plan", week }}>
                <AddOutlined fontSize="inherit" /> Add task to this week
              </Link>
              <Link
                className="btn secondary"
                to="/reporting"
                search={{ view: "weekly-report", week }}
              >
                Prepare weekly report
              </Link>
              <button
                className="btn secondary"
                disabled={!data.plan?.submittedAt || !data.plan.editable}
                onClick={() => void recall()}
              >
                <UndoOutlined fontSize="inherit" /> Recall submitted plan
              </button>
            </div>
          </ReportingPanel>
          {data.report?.reviewComment && (
            <ReportingPanel title="CEO feedback">
              <p>{data.report.reviewComment}</p>
              <ReportingTag status={reportStatus}>{reportStatus}</ReportingTag>
            </ReportingPanel>
          )}
        </div>
      </div>
    </div>
  );
}
