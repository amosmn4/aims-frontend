import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  RotateCw,
  Save,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format-date";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { confirmDialog } from "@/components/confirm-dialog";
import { promptDialog } from "@/components/prompt-dialog";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentsPanel } from "@/features/documents/attachments-panel";
import { ReportConversation } from "./report-conversation";
import { ReportFigures } from "./report-figures";
import { ReportSectionEditor, SectionCard } from "./report-sections";
import {
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
  formatReportPeriod,
  isSectionEmpty,
  lowerFirst,
  missingSections,
  monthLabel,
  personName,
  reviewerLabel,
  sendLabel,
} from "./report-format";
import {
  useDeleteReport,
  useRefreshReportFigures,
  useReportAiStatus,
  useReportAssist,
  useReviewReport,
  useSendReportMessage,
  useUpdateReport,
  type AssistIssue,
  type ReportDetail,
  type ReportFigure,
  type ReportSection,
  type UpdateReportInput,
} from "./use-reports";

type BannerTone = "info" | "warning" | "locked";

const BANNER_TONE: Record<BannerTone, string> = {
  info: "border-primary/30 bg-primary/5",
  warning: "border-warning/40 bg-warning/10",
  locked: "border-border bg-muted/50",
};

function Banner({
  tone,
  title,
  children,
  icon,
}: {
  tone: BannerTone;
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border p-3 text-sm", BANNER_TONE[tone])} role="status">
      <p className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </p>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: ReportDetail["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        REPORT_STATUS_TONE[status],
      )}
    >
      {REPORT_STATUS_LABEL[status]}
    </span>
  );
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Writes, reads and decides on a report — departmental, project or individual. */
export function ReportEditor({
  report,
  onLeave,
}: {
  report: ReportDetail;
  /** Where the back link goes. The unsaved-changes guard runs first. */
  onLeave?: () => void;
}) {
  const { user } = useAuth();
  const update = useUpdateReport();
  const remove = useDeleteReport();
  const review = useReviewReport();
  const refresh = useRefreshReportFigures();
  const assist = useReportAssist();
  const sendMessage = useSendReportMessage();
  const aiQ = useReportAiStatus();

  const [figures, setFigures] = useState<ReportFigure[]>(report.figures);
  const [sections, setSections] = useState<ReportSection[]>(report.sections);
  const [dirty, setDirty] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [issues, setIssues] = useState<AssistIssue[] | null>(null);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const stamp = useRef(report.updatedAt);

  const { guardClose } = useUnsavedChanges(dirty);

  // Takes the server's copy back only when the person has nothing unsaved.
  useEffect(() => {
    if (stamp.current === report.updatedAt) return;
    stamp.current = report.updatedAt;
    if (dirtyRef.current) return;
    setFigures(report.figures);
    setSections(report.sections);
  }, [report]);

  const markDirty = () => {
    dirtyRef.current = true;
    setDirty(true);
  };
  const markClean = () => {
    dirtyRef.current = false;
    setDirty(false);
  };

  const readOnly = !report.canEdit;
  const aiEnabled = !!aiQ.data?.configured && !readOnly;
  const mine = report.createdBy === user?.id;
  const goesTo = reviewerLabel(report.reviewerKind, report.department?.name);
  const missing = missingSections(sections);
  const period = formatReportPeriod(report.periodStart, report.periodEnd);
  const previousLabel = monthLabel(
    new Date(new Date(report.periodStart).getTime() - 86_400_000).toISOString(),
  ).split(" ")[0];

  const changeFigures = (next: ReportFigure[]) => {
    setFigures(next);
    markDirty();
  };
  const changeSection = (next: ReportSection) => {
    setSections((current) => current.map((s) => (s.id === next.id ? next : s)));
    markDirty();
  };

  const save = async (extra: UpdateReportInput = {}) => {
    const saved = await update.mutateAsync({ id: report.id, figures, sections, ...extra });
    markClean();
    return saved;
  };

  const saveDraft = async () => {
    try {
      await save();
      toast.success("Saved. You can finish it later.");
    } catch (e) {
      toast.error(errorText(e, "Couldn't save the report"));
    }
  };

  const send = async () => {
    if (missing.length > 0) {
      toast.error(`Fill in ${missing.join(" and ")} before sending this report.`);
      return;
    }
    const resend = report.status === "changes_requested";
    const note = await promptDialog({
      title: resend
        ? "Send the updated report again?"
        : `Send this report to ${lowerFirst(goesTo)}?`,
      description: resend
        ? "The same conversation carries on — nothing you have said is lost."
        : "They are notified, and can approve it or ask for changes. You can't edit it while they read it.",
      label: "Add a short note (not required)",
      inputType: "textarea",
      placeholder: "Anything you want them to read first…",
      confirmLabel: sendLabel(report.status, report.reviewerKind, report.department?.name),
    });
    if (note === null) return;
    try {
      await save({ submit: true, note: note.trim() || undefined });
      toast.success(`Sent to ${lowerFirst(goesTo)}`);
    } catch (e) {
      toast.error(errorText(e, "Couldn't send the report"));
    }
  };

  const deleteDraft = async () => {
    const ok = await confirmDialog({
      title: `Delete “${report.title}”?`,
      description: "The draft and its attached files go with it. This can't be undone.",
      confirmLabel: "Delete this draft",
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(report.id);
      markClean();
      toast.success("Draft deleted");
      onLeave?.();
    } catch (e) {
      toast.error(errorText(e, "Couldn't delete the draft"));
    }
  };

  const refreshFigures = async () => {
    try {
      if (dirtyRef.current) await save();
      await refresh.mutateAsync(report.id);
      markClean();
      toast.success("Figures pulled in again. Anything you changed was kept.");
    } catch (e) {
      toast.error(errorText(e, "Couldn't get the figures again"));
    }
  };

  const decide = async (decision: "approve" | "request_changes") => {
    const note = reviewNote.trim();
    if (decision === "request_changes" && !note) {
      setReviewError("Say what needs to change — it is the only thing they will see.");
      return;
    }
    try {
      await review.mutateAsync({ id: report.id, decision, note: note || undefined });
      setReviewNote("");
      setReviewError("");
      toast.success(decision === "approve" ? "Report approved" : "Sent back with your note");
    } catch (e) {
      toast.error(errorText(e, "Couldn't save your decision"));
    }
  };

  const draftSection = async (sectionId: string) => {
    setBusyJob(sectionId);
    try {
      const result = await assist.mutateAsync({
        id: report.id,
        job: "draft_narrative",
        target: sectionId,
      });
      const targetId = result.sectionId ?? sectionId;
      setSections((current) =>
        current.map((s) =>
          s.id === targetId ? { ...s, body: result.text ?? "", source: "ai" } : s,
        ),
      );
      markDirty();
      toast.success("Drafted. Read it through and make it yours.");
    } catch (e) {
      toast.error(errorText(e, "Couldn't draft that"));
    } finally {
      setBusyJob(null);
    }
  };

  const explainFigure = async (figureKey: string) => {
    setBusyJob(figureKey);
    try {
      const result = await assist.mutateAsync({
        id: report.id,
        job: "explain_change",
        target: figureKey,
      });
      const key = result.figureKey ?? figureKey;
      setFigures((current) =>
        current.map((f) => (f.key === key ? { ...f, note: result.text ?? "" } : f)),
      );
      markDirty();
      toast.success("A likely explanation — check it before you send.");
    } catch (e) {
      toast.error(errorText(e, "Couldn't explain that change"));
    } finally {
      setBusyJob(null);
    }
  };

  const checkReport = async () => {
    setBusyJob("check");
    try {
      if (dirtyRef.current) await save();
      const result = await assist.mutateAsync({ id: report.id, job: "check" });
      setIssues(result.issues ?? []);
    } catch (e) {
      toast.error(errorText(e, "Couldn't check the report"));
    } finally {
      setBusyJob(null);
    }
  };

  const figuresSection = sections.find((s) => s.type === "figures");
  const bodySections = sections.filter((s) => s.type !== "figures");
  const subjectLine =
    report.kind === "individual"
      ? personName(report.subjectUser, "You")
      : (report.department?.name ?? report.subjectName);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {onLeave && (
        <button
          type="button"
          onClick={() => void guardClose(onLeave)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to reports
        </button>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{report.title}</h1>
            <StatusPill status={report.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {subjectLine} · {period} · written by {personName(report.creator)}
            {report.submissionCount > 1 ? ` · sent ${report.submissionCount} times` : ""}
          </p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={refreshFigures}
              disabled={refresh.isPending || update.isPending}
            >
              {refresh.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="mr-1 h-4 w-4" />
              )}
              Get the figures again
            </Button>
            {report.status === "draft" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={deleteDraft}
                disabled={remove.isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete this draft
              </Button>
            )}
          </div>
        )}
      </header>

      {report.status === "changes_requested" && report.lastReviewNote && (
        <div className="rounded-lg border-2 border-warning/60 bg-warning/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {goesTo} asked for changes
            {report.reviewedAt ? ` on ${formatDate(report.reviewedAt)}` : ""}
          </p>
          <blockquote className="mt-2 border-l-2 border-warning/60 pl-3 text-base whitespace-pre-wrap">
            {report.lastReviewNote}
          </blockquote>
          {report.canEdit && (
            <p className="mt-2 text-sm text-muted-foreground">
              Make the changes, then press “Update and send again”.
            </p>
          )}
        </div>
      )}

      {report.status === "submitted" && (
        <Banner
          tone="locked"
          icon={<Lock className="h-4 w-4" aria-hidden="true" />}
          title={`This report is with ${lowerFirst(goesTo)}`}
        >
          You can't change it while it is being read. If something is wrong, say so below and they
          can send it back.
        </Banner>
      )}

      {report.status === "approved" && (
        <Banner
          tone="locked"
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          title={`Approved${report.reviewedAt ? ` on ${formatDate(report.reviewedAt)}` : ""} — locked`}
        >
          Approved reports can't be edited. If something needs correcting, say so below and note it
          in next month's report.
        </Banner>
      )}

      {report.status === "draft" && !mine && (
        <Banner
          tone="locked"
          icon={<Lock className="h-4 w-4" aria-hidden="true" />}
          title={`${personName(report.creator)} is preparing this report`}
        >
          One person sends a department's report. Read the draft and add a comment if something is
          missing.
        </Banner>
      )}

      {report.status === "draft" && mine && report.kind === "individual" && (
        <Banner tone="info" title={`AIMS filled in your figures from your work in ${period}`}>
          Check them, change anything that is wrong, then answer the questions below. Nobody sees
          this until you send it.
        </Banner>
      )}

      <div className="grid gap-4 min-[720px]:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-3">
          {figuresSection && (
            <SectionCard title={figuresSection.title}>
              {figuresSection.hint && !readOnly && (
                <p className="mb-2 text-xs text-muted-foreground">{figuresSection.hint}</p>
              )}
              <ReportFigures
                figures={figures}
                readOnly={readOnly}
                previousLabel={previousLabel}
                onChange={changeFigures}
                aiEnabled={aiEnabled}
                onExplain={explainFigure}
                explainingKey={busyJob}
                onRefresh={refreshFigures}
                refreshing={refresh.isPending}
              />
            </SectionCard>
          )}

          {bodySections.map((section) => (
            <ReportSectionEditor
              key={section.id}
              section={section}
              readOnly={readOnly}
              aiEnabled={aiEnabled}
              drafting={busyJob === section.id}
              onChange={changeSection}
              onDraft={() => void draftSection(section.id)}
            />
          ))}
        </div>

        <aside className="h-fit space-y-4 rounded-lg border bg-muted/30 p-4">
          <div>
            <SectionHeading>Before you send</SectionHeading>
            <ul className="space-y-1.5 text-sm">
              {sections.map((s) => {
                const done = !isSectionEmpty(s);
                return (
                  <li key={s.id} className="flex items-start gap-2">
                    {done ? (
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          s.required ? "text-warning" : "text-muted-foreground",
                        )}
                        aria-hidden="true"
                      />
                    )}
                    <span className={done ? "text-muted-foreground" : ""}>
                      {s.title}
                      {!done && s.required && <span className="text-warning"> — still needed</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {aiEnabled && (
            <div>
              <SectionHeading>Help</SectionHeading>
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={checkReport}
                disabled={busyJob === "check"}
              >
                {busyJob === "check" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                Check before sending
              </Button>
              {issues !== null && (
                <div className="mt-2 rounded-md border bg-card p-2 text-xs">
                  {issues.length === 0 ? (
                    <p className="text-muted-foreground">
                      Nothing looks wrong. The writing matches the figures.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {issues.map((issue, i) => (
                        <li key={i}>
                          <p className="font-medium">{issue.where}</p>
                          <p className="text-muted-foreground">{issue.problem}</p>
                          <p className="text-muted-foreground">Try: {issue.fix}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <SectionHeading>The period</SectionHeading>
            <p className="text-sm">{period}</p>
          </div>

          <div>
            <SectionHeading>Goes to</SectionHeading>
            <p className="text-sm">{goesTo}</p>
            {report.department && report.reviewerKind === "department_head" && (
              <p className="text-xs text-muted-foreground">{report.department.name}</p>
            )}
          </div>
        </aside>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={saveDraft}
            disabled={update.isPending || refresh.isPending}
          >
            {update.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Save and finish later
          </Button>
          <Button size="sm" onClick={send} disabled={update.isPending}>
            <Send className="mr-1 h-4 w-4" />
            {sendLabel(report.status, report.reviewerKind, report.department?.name)}
          </Button>
        </div>
      )}

      {report.canReview && (
        <section
          className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4"
          aria-label="Your decision"
        >
          <h2 className="text-sm font-semibold">Your decision</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Approve it, or send it back with a note saying what to change.{" "}
            {personName(report.creator)} is told either way.
          </p>
          <label htmlFor="report-review-note" className="sr-only">
            Say something back
          </label>
          <Textarea
            id="report-review-note"
            rows={3}
            placeholder="Say something back…"
            value={reviewNote}
            onChange={(e) => {
              setReviewNote(e.target.value);
              if (reviewError) setReviewError("");
            }}
            aria-invalid={!!reviewError}
          />
          {reviewError && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {reviewError}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => decide("approve")} disabled={review.isPending}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => decide("request_changes")}
              disabled={review.isPending}
            >
              <AlertTriangle className="mr-1 h-4 w-4" /> Send back for changes
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Sending back needs a reason — it is the only thing they will see.
          </p>
        </section>
      )}

      <ReportConversation
        messages={report.messages.map((m) => ({
          id: m.id,
          kind: m.kind,
          body: m.body,
          parentId: m.parentId,
          createdAt: m.createdAt,
          authorName: personName(m.author, "AIMS"),
        }))}
        canPost={report.status !== "draft"}
        sending={sendMessage.isPending}
        placeholder={report.canReview ? "Message the writer…" : `Message ${lowerFirst(goesTo)}…`}
        onSend={(body, parentId) =>
          sendMessage
            .mutateAsync({ id: report.id, body, parentId })
            .then(() => toast.success("Message sent"))
            .catch((e: unknown) => toast.error(errorText(e, "Couldn't send the message")))
        }
      />

      <div className="rounded-lg border bg-card p-4">
        <AttachmentsPanel
          resourceType="department_report"
          resourceId={report.id}
          canManage={report.canEdit}
        />
      </div>
    </div>
  );
}
