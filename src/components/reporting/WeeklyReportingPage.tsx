import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { plainText, validDate } from "@/lib/text";
import { useQueryClient } from "@tanstack/react-query";
import UndoOutlined from "@mui/icons-material/UndoOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import { useSubmissionSchedules } from "@/lib/reporting";
import { WeeklyEditor } from "@/components/weekly/WeeklyEditor";
import { WeeklyEntryView } from "@/components/weekly/WeeklyEntryView";
import { useAccount } from "@/lib/account";
import { api } from "@/lib/api";
import { loadWorkspace, perform } from "@/lib/workspace";
import {
  useWeekly,
  weeklyTime,
  weeklyStatus,
  type WeeklyDetail,
  type WeeklyPhase,
  type WeeklyHistory,
} from "@/lib/weekly";
import { confirmDialog } from "@/production/components/confirm-dialog";
import { ReportingHeader, ReportingPanel, ReportingTag, ReportingPagination } from "./ReportingUI";

export function WeeklyReportingPage({
  phase,
  week,
  onWeek,
}: {
  phase: WeeklyPhase;
  week: string;
  onWeek: (week: string) => void;
}) {
  const { account } = useAccount();
  const client = useQueryClient();
  const query = useWeekly<WeeklyDetail>(`reports/${week}/${account?.id ?? ""}`);
  const data = query.data;
  const entry = data?.[phase];
  const schedules = useSubmissionSchedules();
  const schedule = schedules.data?.find(
    (row) => row.kind === phase && row.target === week && row.status === "pending",
  );
  const history = useWeekly<{ id: string; action: string; createdAt: string }[]>(
    `submissions/${entry?.id ?? ""}/history`,
    !!entry,
  );
  const [page, setPage] = useState(1);
  const [weekInput, setWeekInput] = useState(week);
  const submissions = useWeekly<WeeklyHistory>(`submissions?phase=${phase}&page=${page}`);
  const [busy, setBusy] = useState(false);
  const action = async (kind: "recall" | "delete") => {
    if (
      !entry ||
      !(await confirmDialog({
        title: kind === "recall" ? "Recall this submission?" : "Delete this draft?",
        description:
          kind === "recall"
            ? "The original submission stays in your history. You can edit and submit again."
            : "This removes the unsubmitted draft and cancels its schedule.",
        confirmLabel: kind === "recall" ? "Recall submission" : "Delete draft",
        destructive: kind === "delete",
      }))
    )
      return;
    setBusy(true);
    try {
      if (
        await perform(
          async () => {
            await api(`/weekly/submissions/${entry.id}${kind === "recall" ? "/recall" : ""}`, {
              method: kind === "recall" ? "POST" : "DELETE",
              body: JSON.stringify({ version: entry.version }),
            });
          },
          kind === "recall" ? "Submission recalled" : "Draft deleted",
        )
      ) {
        await client.invalidateQueries({ queryKey: ["weekly"] });
        await client.invalidateQueries({ queryKey: ["submission-schedules"] });
        await loadWorkspace();
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <ReportingHeader
        title={`Weekly ${phase}`}
        eyebrow={`Staff workspace | ${phase === "plan" ? "Planning" : "Weekly reporting"}`}
        subtitle={
          phase === "plan"
            ? "Create your weekly commitments. Submit immediately or schedule delivery."
            : "Report against your weekly tasks. Explain outcomes and blockers."
        }
        action={
          <ReportingTag status={schedule ? "scheduled" : weeklyStatus(entry ?? null)}>
            {schedule ? "Scheduled" : weeklyStatus(entry ?? null)}
          </ReportingTag>
        }
      />
      {query.isPending && <p role="status">Loading weekly {phase}...</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {data && (
        <>
          {schedule && (
            <p className="notice" role="status">
              Scheduled for {weeklyTime(schedule.runAt)} EAT. Your latest saved draft will submit
              automatically, with a reminder one hour before.
            </p>
          )}
          {!data.configured && (
            <div className="notice">
              The CEO must configure weekly reporting before you can save or submit.
            </div>
          )}
          {entry?.submittedAt && !entry.editable ? (
            <>
              <label className="field">
                Reporting week
                <input
                  aria-label="Reporting week"
                  type="date"
                  value={weekInput}
                  onChange={(event) => setWeekInput(event.target.value)}
                />
                <button
                  type="button"
                  className="btn secondary sm"
                  disabled={!validDate(weekInput)}
                  onClick={() => onWeek(weekInput)}
                >
                  Apply week
                </button>
              </label>
              <WeeklyEntryView entry={entry} />
              <p className="notice">The editing window for this submission has closed.</p>
            </>
          ) : (
            <WeeklyEditor
              key={`${week}-${phase}-${entry?.version ?? 0}`}
              inline
              startActions={
                <div className="flex flex-wrap gap-2">
                  {entry?.submittedAt && (
                    <button
                      type="button"
                      className="btn secondary sm"
                      disabled={busy || !entry.editable}
                      onClick={() => void action("recall")}
                    >
                      <UndoOutlined fontSize="inherit" /> Recall {phase}
                    </button>
                  )}
                  {entry && !entry.submittedAt && !entry.returnedAt && !entry.recalledAt && (
                    <button
                      type="button"
                      className="btn danger sm"
                      disabled={
                        busy ||
                        history.isPending ||
                        !!history.error ||
                        !!history.data?.some((event) => event.action === "ops.weekly.submitted")
                      }
                      onClick={() => void action("delete")}
                    >
                      <DeleteOutline fontSize="inherit" /> Delete draft
                    </button>
                  )}
                </div>
              }
              detail={data}
              phase={phase}
              onClose={() => {
                void query.refetch();
              }}
              onWeekChange={onWeek}
            />
          )}
          {entry?.reviewComment && (
            <div className="notice">
              <strong>CEO feedback: </strong>
              {entry.reviewComment}
            </div>
          )}
          <ReportingPanel title={`${phase === "plan" ? "Plan" : "Report"} submission timeline`}>
            {submissions.error && <p role="alert">{submissions.error.message}</p>}
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Submission</th>
                    <th>Week</th>
                    <th>Updated</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.data?.items.map((submission) => (
                    <tr key={submission.id}>
                      <td>
                        <Link
                          className="font-semibold hover:underline"
                          to="/reporting"
                          search={{
                            view: "detail",
                            week: submission.weekStart,
                            phase,
                            staff: submission.staffId,
                          }}
                        >
                          {plainText(submission.submission.title) || `Weekly ${phase}`}
                        </Link>
                      </td>
                      <td>{submission.weekStart}</td>
                      <td>{weeklyTime(submission.updatedAt)}</td>
                      <td>
                        <ReportingTag>{weeklyStatus(submission)}</ReportingTag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!submissions.data?.items.length && (
              <p className="report-empty">Your saved drafts and submissions will appear here.</p>
            )}
            <ReportingPagination
              page={submissions.data?.page ?? page}
              total={submissions.data?.total ?? 0}
              limit={submissions.data?.limit ?? 20}
              onPage={setPage}
            />
          </ReportingPanel>
        </>
      )}
    </>
  );
}
