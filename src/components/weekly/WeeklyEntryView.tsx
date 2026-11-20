import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { SafeHtml } from "@/production/components/safe-html";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { documentBlob, downloadBlob } from "@/lib/file-storage";
import { useAccount } from "@/lib/account";
import { TaskDeliverables } from "@/components/TaskDeliverables";
import { plainText } from "@/lib/text";
import {
  useWeekly,
  weeklyLabels,
  weeklyStatus,
  weeklyTime,
  leaveDays,
  type WeeklyEntry,
  type WeeklySubmission,
} from "@/lib/weekly";

export function WeeklySubmissionBody({ submission }: { submission: WeeklySubmission }) {
  const { documents } = useWorkspace();
  return (
    <div className="space-y-4 text-sm">
      {submission.title && <h3 className="font-semibold">{plainText(submission.title)}</h3>}
      {submission.summary && (
        <div>
          <strong>Objective / executive summary</strong>
          <SafeHtml html={submission.summary} className="blog-content mt-1 text-sm" />
        </div>
      )}
      {submission.note && (
        <div>
          <strong>Notes</strong>
          <SafeHtml html={submission.note} className="blog-content mt-1 text-sm" />
        </div>
      )}
      {!!submission.leave?.length && (
        <div className="rounded-lg border bg-muted/20 p-3">
          <strong>Recorded leave | {leaveDays(submission.leave)} calendar days</strong>
          {submission.leave.map((row) => (
            <p key={`${row.start}:${row.end}`}>
              {row.start} to {row.end}
              {row.note ? ` | ${row.note}` : ""}
            </p>
          ))}
        </div>
      )}
      {submission.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="p-2">Task</th>
                <th className="p-2">Status</th>
                <th className="p-2">Due day</th>
                <th className="p-2">Priority</th>
                {submission.items.some((item) => item.detail) && <th className="p-2">Notes</th>}
              </tr>
            </thead>
            <tbody>
              {submission.items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="p-2 align-top font-medium">
                    {plainText(item.title)}
                    {!!item.subtasks?.length && <TaskDeliverables items={item.subtasks} />}
                    {item.outcome && (
                      <div className="mt-3">
                        <strong>Outcome</strong>
                        <SafeHtml html={item.outcome} className="blog-content font-normal" />
                      </div>
                    )}
                  </td>
                  <td className="p-2 align-top">{weeklyLabels[item.status]}</td>
                  <td className="p-2 align-top">
                    {item.due
                      ? new Date(`${item.due}T12:00:00Z`).toLocaleDateString("en-GB", {
                          weekday: "long",
                          day: "numeric",
                          month: "short",
                        })
                      : "Not set"}
                  </td>
                  <td className="p-2 align-top">{item.priority ?? "Medium"}</td>
                  {submission.items.some((row) => row.detail) && (
                    <td className="p-2 align-top">
                      {item.detail ? (
                        <SafeHtml html={item.detail} className="blog-content text-sm" />
                      ) : (
                        ""
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {submission.noWorkReason && (
        <div className="whitespace-pre-wrap">
          <strong>No work / absence: </strong>
          <SafeHtml html={submission.noWorkReason} className="blog-content" />
        </div>
      )}
      {submission.blockers && (
        <div className="whitespace-pre-wrap">
          <strong>Blockers and support: </strong>
          <SafeHtml html={submission.blockers} className="blog-content" />
        </div>
      )}
      {submission.nextWeek && (
        <div className="whitespace-pre-wrap">
          <strong>Next week: </strong>
          <SafeHtml html={submission.nextWeek} className="blog-content" />
        </div>
      )}
      {!!submission.attachments?.length && (
        <div className="space-y-2 border-t pt-3">
          <h3 className="font-semibold">Attachments</h3>
          {submission.attachments.map((id) => {
            const doc = documents.find((item) => item.id === id);
            return doc ? (
              <button
                key={id}
                type="button"
                className="block text-left text-primary underline"
                onClick={async () => {
                  try {
                    downloadBlob(await documentBlob(doc), doc.name);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Download failed.");
                  }
                }}
              >
                {doc.name}
              </button>
            ) : (
              <p key={id} className="text-muted-foreground">
                An attachment is no longer available.
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
export function WeeklyEntryView({ entry }: { entry: WeeklyEntry }) {
  const { account } = useAccount();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [showHistory, setShowHistory] = useState(false);
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
  >(`submissions/${entry.id}/history`, showHistory);
  const mutation = useMutation({
    mutationFn: (action: "review" | "return") =>
      api(`/weekly/submissions/${entry.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ version: entry.version, comment }),
      }),
    onSuccess: async () => {
      setComment("");
      await queryClient.invalidateQueries({ queryKey: ["weekly"] });
      toast.success("Weekly submission updated");
    },
  });
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">
          {entry.phase === "plan" ? "Weekly plan" : "Weekly report"}
        </h2>
        <Pill>{weeklyStatus(entry)}</Pill>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Submitted: {weeklyTime(entry.submittedAt)}
      </p>
      {entry.submittedAt ? (
        <WeeklySubmissionBody submission={entry.submission} />
      ) : (
        <p className="text-sm">The author has not submitted this record.</p>
      )}
      {entry.reviewComment && (
        <p className="mt-4 whitespace-pre-wrap rounded-lg border bg-muted p-3 text-sm">
          <strong>CEO review: </strong>
          {entry.reviewComment}
        </p>
      )}
      {entry.returnComment && (
        <p className="mt-4 whitespace-pre-wrap rounded-lg border p-3 text-sm">
          <strong>Correction requested: </strong>
          {entry.returnComment}
        </p>
      )}
      {account?.role === "ceo" && entry.submittedAt && (
        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate("review");
          }}
        >
          <label className="field-label">
            CEO feedback
            <textarea
              aria-label="CEO feedback"
              className="field-input min-h-24"
              maxLength={5000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {!entry.reviewedAt && <Button disabled={mutation.isPending}>Mark reviewed</Button>}
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending || comment.trim().length < 5}
              onClick={() => mutation.mutate("return")}
            >
              Return for correction
            </Button>
          </div>
          {mutation.error && (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          )}
        </form>
      )}
      <Button
        type="button"
        variant="link"
        className="mt-3 px-0"
        onClick={() => setShowHistory((value) => !value)}
      >
        {showHistory ? "Hide submission history" : "View submission history"}
      </Button>
      {showHistory && (
        <div className="mt-3 space-y-3">
          {history.isPending && <p role="status">Loading history...</p>}
          {history.error && <p role="alert">{history.error.message}</p>}
          {history.data?.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {item.action.replace("ops.weekly.", "").replaceAll("_", " ")} |{" "}
                {weeklyTime(item.createdAt)}
              </p>
              {item.newValue.comment && (
                <p className="mt-2 whitespace-pre-wrap">{item.newValue.comment}</p>
              )}
              {(item.newValue.submission || item.newValue.previousSubmission) && (
                <details className="mt-2">
                  <summary className="cursor-pointer">Submitted snapshot</summary>
                  <div className="mt-3">
                    <WeeklySubmissionBody
                      submission={(item.newValue.submission ?? item.newValue.previousSubmission)!}
                    />
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
