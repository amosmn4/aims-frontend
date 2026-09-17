import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { confirmDialog } from "@/components/confirm-dialog";
import { LoadError } from "@/components/load-error";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { DepartmentReportForm } from "@/features/reports/department-report-form";
import { ReportConversation } from "@/features/reports/report-conversation";
import { ReportStatusPill } from "@/features/reports/department-reports-panel";
import {
  PERIOD_TYPE_LABEL,
  formatPeriod,
  useAddReportMessage,
  useDeleteDepartmentReport,
  useDepartmentReport,
  useReviewDepartmentReport,
  useUpdateDepartmentReport,
} from "@/features/reports/use-department-reports";

export const Route = createFileRoute("/_authenticated/department-reports/$reportId")({
  head: () => ({ meta: [{ title: "Report — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: DepartmentReportPage,
});

const DEPT_REPORTS_ROUTE: Record<string, string> = {
  finance: "/finance/reports",
  hr: "/hr/reports",
  it: "/it/reports",
  marketing: "/marketing/reports",
  tender: "/tender/reports",
  operations: "/operations/reports",
};

function DepartmentReportPage() {
  const { reportId } = Route.useParams();
  const navigate = useNavigate();
  const { isAdminOrCeo, hasCapability } = useAuth();
  const reportQ = useDepartmentReport(reportId);
  const review = useReviewDepartmentReport();
  const addMessage = useAddReportMessage();
  const update = useUpdateDepartmentReport();
  const remove = useDeleteDepartmentReport();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");

  if (reportQ.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const r = reportQ.data;
  const status = (reportQ.error as { status?: number } | null)?.status;
  if (reportQ.isError && status !== 404 && status !== 403) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to reports
        </Link>
        <LoadError what="this report" error={reportQ.error} onRetry={() => reportQ.refetch()} />
      </div>
    );
  }
  if (!r) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-sm font-medium">This report isn't available</p>
        <p className="mt-1 text-xs text-muted-foreground">
          It may have been deleted, or it belongs to another department.
        </p>
        <Link to="/reports" className="mt-3 inline-block text-sm text-primary hover:underline">
          Go to Reports
        </Link>
      </div>
    );
  }

  const backTo = isAdminOrCeo ? "/reports" : (DEPT_REPORTS_ROUTE[r.department.code] ?? "/reports");
  const decide = async (decision: "approve" | "request_changes") => {
    if (decision === "request_changes" && !note.trim()) {
      setNoteError("Tell the department what needs to change.");
      return;
    }
    try {
      await review.mutateAsync({ id: r.id, decision, note: note.trim() || undefined });
      setNote("");
      setNoteError("");
      toast.success(
        decision === "approve"
          ? "Report approved"
          : `Sent back to ${r.department.name} with your note`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save your decision");
    }
  };
  const submitDraft = async () => {
    const ok = await confirmDialog({
      title: "Send this report to the CEO?",
      description: "The CEO is notified and can approve it or ask for changes.",
      confirmLabel: "Submit to CEO",
    });
    if (!ok) return;
    try {
      await update.mutateAsync({ id: r.id, submit: true });
      toast.success("Report sent to the CEO");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't submit the report");
    }
  };
  const deleteDraft = async () => {
    const ok = await confirmDialog({
      title: `Delete "${r.title}"?`,
      description: "This draft and its attached files will be removed. This can't be undone.",
      confirmLabel: "Delete draft",
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(r.id);
      toast.success("Draft deleted");
      navigate({ to: backTo });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the draft");
    }
  };

  const lastReviewNote = [...r.messages].reverse().find((m) => m.kind === "changes_requested");
  const canEdit = r.canEdit && hasCapability("submit_reports");

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to reports
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{r.title}</h1>
            <ReportStatusPill status={r.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {r.department.name} · {PERIOD_TYPE_LABEL[r.periodType]} ·{" "}
            {formatPeriod(r.periodStart, r.periodEnd)} · prepared by{" "}
            {r.creator.fullName || r.creator.email}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {r.status === "draft" && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={deleteDraft}>
                <Trash2 className="mr-1 h-4 w-4" /> Delete draft
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-4 w-4" />{" "}
              {r.status === "changes_requested" ? "Update and resubmit report" : "Edit report"}
            </Button>
            {r.status === "draft" && (
              <Button size="sm" onClick={submitDraft} disabled={update.isPending}>
                <Send className="mr-1 h-4 w-4" /> Submit to CEO
              </Button>
            )}
          </div>
        )}
      </header>

      {r.status === "changes_requested" && lastReviewNote && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-medium">The CEO asked for changes</p>
          <p className="mt-1 whitespace-pre-wrap">{lastReviewNote.body}</p>
          {canEdit && (
            <p className="mt-1 text-xs text-muted-foreground">
              Click “Update and resubmit report” when you've made them.
            </p>
          )}
        </div>
      )}

      <section className="rounded-lg border bg-card p-4" aria-label="Key figures">
        <h2 className="mb-3 text-sm font-semibold">Key figures</h2>
        {r.figures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No figures were added to this report.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3 lg:grid-cols-4">
            {r.figures.map((f, i) => (
              <div key={i} className="bg-card p-3">
                <dt className="text-xs font-medium text-muted-foreground">{f.label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {r.summary && (
          <div className="mt-4">
            <h3 className="mb-1 text-xs font-semibold text-muted-foreground">Summary</h3>
            <p className="whitespace-pre-wrap text-sm">{r.summary}</p>
          </div>
        )}
      </section>

      {r.canReview && (
        <section
          className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4"
          aria-label="Your decision"
        >
          <h2 className="text-sm font-semibold">Your decision</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Approve the report, or send it back with a note. {r.department.name} is notified either
            way.
          </p>
          <label htmlFor="review-note" className="sr-only">
            Note to the department
          </label>
          <Textarea
            id="review-note"
            rows={3}
            placeholder="Note to the department (needed when asking for changes)"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (noteError) setNoteError("");
            }}
            aria-invalid={!!noteError}
          />
          {noteError && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {noteError}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => decide("approve")} disabled={review.isPending}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Approve report
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => decide("request_changes")}
              disabled={review.isPending}
            >
              <AlertTriangle className="mr-1 h-4 w-4" /> Request changes
            </Button>
          </div>
        </section>
      )}

      <ReportConversation
        messages={r.messages.map((m) => ({
          id: m.id,
          kind: m.kind,
          body: m.body,
          parentId: m.parentId,
          createdAt: m.createdAt,
          authorName: m.author.fullName || m.author.email || "AIMS",
        }))}
        canPost={r.status !== "draft"}
        sending={addMessage.isPending}
        placeholder={isAdminOrCeo ? `Message ${r.department.name}…` : "Message the CEO…"}
        onSend={(body, parentId) =>
          addMessage
            .mutateAsync({ id: r.id, body, parentId })
            .then(() => toast.success("Message sent"))
            .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't send the message"))
        }
      />

      <div className="rounded-lg border bg-card p-4">
        <AttachmentsPanel resourceType="department_report" resourceId={r.id} canManage={canEdit} />
      </div>

      {editing && (
        <DepartmentReportForm
          department={{ id: r.departmentId, name: r.department.name }}
          report={r}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
