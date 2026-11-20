import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAccount } from "@/lib/account";
import { useWorkspace } from "@/lib/workspace";
import { WeeklySubmissionBody } from "@/components/weekly/WeeklyEntryView";
import {
  useWeekly,
  weeklyStatus,
  weeklyTime,
  type WeeklyDetail,
  type WeeklySubmission,
} from "@/lib/weekly";
import { reportingDate, type ReportingRow } from "@/lib/reporting";
import { ReportingHeader, ReportingPanel, ReportingTag } from "./ReportingUI";

export function ReportingDetail({ row, onBack }: { row: ReportingRow; onBack: () => void }) {
  const { account } = useAccount();
  const { deptName } = useWorkspace();
  const client = useQueryClient();
  const live = useWeekly<WeeklyDetail>(
    `reports/${row.period}/${row.staffId}`,
    !!row.entry && !row.historical,
  );
  const entry = row.historical
    ? row.entry
    : (live.data?.[row.type === "plan" ? "plan" : "report"] ?? row.entry);
  const status = row.historical
    ? "Historical version"
    : entry
      ? weeklyStatus(entry)
      : row.status.replaceAll("_", " ");
  const history = useWeekly<
    {
      id: string;
      action: string;
      createdAt: string;
      newValue: {
        comment?: string;
        submission?: WeeklySubmission;
        previousSubmission?: WeeklySubmission;
      };
    }[]
  >(`submissions/${entry?.id ?? ""}/history`, !!entry);
  const [decision, setDecision] = useState("review");
  const [comment, setComment] = useState("");
  const review = useMutation({
    mutationFn: () =>
      api(`/weekly/submissions/${entry!.id}/${decision}`, {
        method: "POST",
        body: JSON.stringify({ version: entry!.version, comment }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["weekly"] });
      toast.success("Review saved and staff notified");
      setComment("");
    },
  });
  return (
    <>
      <button className="btn secondary sm report-back" onClick={onBack}>
        <ArrowBackOutlined fontSize="inherit" /> Back to submissions
      </button>
      <ReportingHeader
        title={row.title}
        eyebrow={`${account?.role === "ceo" ? "CEO" : "Staff"} workspace | Submission review`}
        subtitle={`${row.name} | ${deptName(row.dept ?? "")} | ${row.period.length === 7 ? row.period : reportingDate(row.period)}`}
        action={<ReportingTag status={status}>{status}</ReportingTag>}
      />
      {live.error && <p role="alert">{live.error.message}</p>}
      <div className="detailgrid">
        <div>
          <ReportingPanel title="Submission overview">
            <div className="report-facts">
              <div>
                <small>Staff member</small>
                <strong>{row.name}</strong>
              </div>
              <div>
                <small>Department</small>
                <strong>{deptName(row.dept ?? "")}</strong>
              </div>
              <div>
                <small>Period</small>
                <strong>{row.period}</strong>
              </div>
              <div>
                <small>Submitted</small>
                <strong>{weeklyTime(row.date)}</strong>
              </div>
            </div>
            {row.historical && (
              <div className="notice">
                This is a retained submission snapshot. Reviews apply to the latest submitted
                version.
              </div>
            )}
            {entry ? (
              <WeeklySubmissionBody submission={entry.submission} />
            ) : (
              <>
                <p>{row.summary}</p>
                <Link to="/reports" hash={`report-${row.id}`} className="btn primary">
                  Open monthly report and attachments
                </Link>
              </>
            )}
          </ReportingPanel>
        </div>
        <div>
          {account?.role === "ceo" && entry && (
            <ReportingPanel title="CEO review">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  review.mutate();
                }}
              >
                <label className="field">
                  Decision
                  <select
                    aria-label="Review decision"
                    value={decision}
                    onChange={(event) => setDecision(event.target.value)}
                    disabled={review.isPending || row.historical || !entry.submittedAt}
                  >
                    <option value="review">Reviewed</option>
                    <option value="return">Needs attention</option>
                  </select>
                </label>
                <label className="field">
                  Comments / feedback
                  <textarea
                    aria-label="CEO feedback"
                    maxLength={5000}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    disabled={review.isPending || row.historical || !entry.submittedAt}
                    placeholder="Add feedback for this staff member..."
                  />
                </label>
                <button
                  className="btn primary report-full"
                  disabled={
                    review.isPending ||
                    live.isPending ||
                    row.historical ||
                    !entry.submittedAt ||
                    (decision === "review" && !!entry.reviewedAt) ||
                    (decision === "return" && comment.trim().length < 5)
                  }
                >
                  {review.isPending ? "Saving review..." : "Save review and notify staff"}
                </button>
                {review.error && <p role="alert">{review.error.message}</p>}
                {decision === "return" && (
                  <p className="tiny muted">
                    Explain the correction needed in at least five characters.
                  </p>
                )}
              </form>
            </ReportingPanel>
          )}
          {(entry?.reviewComment || entry?.returnComment) && (
            <ReportingPanel title="Latest feedback">
              <p>{entry.reviewComment ?? entry.returnComment}</p>
            </ReportingPanel>
          )}
          <ReportingPanel title="Review history">
            {history.isPending && entry && <p role="status">Loading history...</p>}
            {history.error && <p role="alert">{history.error.message}</p>}
            {history.data?.map((item) => (
              <div className="comment" key={item.id}>
                <strong>{item.action.replace("ops.weekly.", "").replaceAll("_", " ")}</strong>
                {item.newValue.comment && <p>{item.newValue.comment}</p>}
                <small>{weeklyTime(item.createdAt)}</small>
                {(item.newValue.submission || item.newValue.previousSubmission) && (
                  <details>
                    <summary>Submitted snapshot</summary>
                    <WeeklySubmissionBody
                      submission={(item.newValue.submission ?? item.newValue.previousSubmission)!}
                    />
                  </details>
                )}
              </div>
            ))}
          </ReportingPanel>
        </div>
      </div>
    </>
  );
}
