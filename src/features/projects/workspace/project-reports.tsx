import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  useReport,
  useReports,
  useStartReport,
  type ReportRow,
} from "@/features/reports/use-reports";
import { REPORT_STATUS_LABEL, REPORT_STATUS_TONE } from "@/features/reports/report-format";
import type { Project } from "@/features/projects/use-projects";
import { FormField } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReportEditor } from "@/features/reports/report-editor";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { Initials } from "./initials";

const REPORT_PATH = "/reports/$reportId" as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (value: string, days: number) => {
  const d = new Date(`${value}T00:00:00`);
  d.setDate(d.getDate() + days);
  return iso(d);
};

/** "1–28 Sep 2026", "25 Aug – 28 Sep 2026" */
function rangeLabel(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS[em - 1]} ${ey}`;
  if (sy === ey) return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
  return `${sd} ${MONTHS[sm - 1]} ${sy} – ${ed} ${MONTHS[em - 1]} ${ey}`;
}

type PeriodChoice = "since_last" | "week" | "month" | "custom";

function periodFor(
  choice: PeriodChoice,
  lastEnd: string | null,
  custom: { start: string; end: string },
  sharedTeam = false,
) {
  const today = iso(new Date());
  const now = new Date();
  if (choice === "since_last" && lastEnd) return { start: addDays(lastEnd, 1), end: today };
  if (choice === "week") {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { start: iso(monday), end: sharedTeam ? addDays(iso(monday), 6) : today };
  }
  if (choice === "custom") return custom;
  return {
    start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
    end: sharedTeam ? iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) : today,
  };
}

/** Company teams prepare one shared report per period for the CEO. */
export function ProjectReports({ project, canWrite }: { project: Project; canWrite: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reportsQ = useReports({ kind: "project", subjectId: project.id });
  const [choosing, setChoosing] = useState(false);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const sharedTeam = project.scope === "company";
  const openReport = (id: string) =>
    sharedTeam ? setActiveReport(id) : void navigate({ to: REPORT_PATH, params: { reportId: id } });
  const reports = reportsQ.data ?? [];
  const lastEnd =
    reports
      .map((r) => r.periodEnd.slice(0, 10))
      .sort()
      .at(-1) ?? null;

  return (
    <div className="ws-panel !mt-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3>Reports</h3>
          <p className="text-xs text-muted-foreground">
            {sharedTeam
              ? "One report per period. Everyone edits it; anyone can send it to the CEO."
              : "Record progress and share it with the project team."}
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setChoosing(true)}>
            <Plus className="mr-1 h-4 w-4" /> {sharedTeam ? "Open team report" : "Write report"}
          </Button>
        )}
      </div>

      {reportsQ.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : reportsQ.isError ? (
        <LoadError what="reports" error={reportsQ.error} onRetry={() => reportsQ.refetch()} />
      ) : reports.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No reports yet.
          {canWrite &&
            (sharedTeam
              ? " Open a team report to start from the work logged here."
              : " Press Write report to start from the work logged here.")}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {reports.map((r) => (
            <ReportLine
              key={r.id}
              report={r}
              mine={r.createdBy === user?.id}
              sharedTeam={sharedTeam}
              canWrite={canWrite}
              onOpen={() => openReport(r.id)}
            />
          ))}
        </ul>
      )}

      {activeReport && (
        <TeamReportDialog reportId={activeReport} onClose={() => setActiveReport(null)} />
      )}

      {choosing && (
        <WriteReportDialog
          project={project}
          lastEnd={lastEnd}
          onClose={() => setChoosing(false)}
          onStarted={openReport}
        />
      )}
    </div>
  );
}

function ReportLine({
  report: r,
  mine,
  sharedTeam,
  canWrite,
  onOpen,
}: {
  report: ReportRow;
  mine: boolean;
  sharedTeam: boolean;
  canWrite: boolean;
  onOpen: () => void;
}) {
  const who = r.creator.fullName ?? r.creator.email;
  const draft = r.status === "draft";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-wrap items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-secondary/50"
      >
        {!sharedTeam && <Initials name={who} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{r.title}</span>
          <span className="block text-xs text-muted-foreground">
            {sharedTeam ? "Team report" : who} ·{" "}
            {rangeLabel(r.periodStart.slice(0, 10), r.periodEnd.slice(0, 10))}
            {r.submittedAt && !draft ? ` · shared ${formatDate(r.submittedAt)}` : ""}
          </span>
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            REPORT_STATUS_TONE[r.status],
          )}
        >
          {draft ? "Draft" : REPORT_STATUS_LABEL[r.status]}
        </span>
        <span className="rounded-md border px-2.5 py-1 text-xs font-medium">
          {canWrite &&
          (sharedTeam || mine) &&
          (draft || r.status === "shared" || r.status === "changes_requested")
            ? "Edit"
            : "Read"}
        </span>
      </button>
    </li>
  );
}

function WriteReportDialog({
  project,
  lastEnd,
  onClose,
  onStarted,
}: {
  project: Project;
  lastEnd: string | null;
  onClose: () => void;
  onStarted: (id: string) => void;
}) {
  const start = useStartReport();
  const today = iso(new Date());
  const sharedTeam = project.scope === "company";
  const canContinue = !sharedTeam && !!lastEnd && lastEnd < today;
  const [choice, setChoice] = useState<PeriodChoice>(canContinue ? "since_last" : "month");
  const [custom, setCustom] = useState({ start: project.start_date ?? today, end: today });
  const [error, setError] = useState<string>();
  const period = periodFor(choice, lastEnd, custom, sharedTeam);

  const options: { value: PeriodChoice; label: string; hint?: string }[] = [
    ...(canContinue
      ? [
          {
            value: "since_last" as const,
            label: "Since the last report",
            hint: rangeLabel(addDays(lastEnd!, 1), today),
          },
        ]
      : []),
    {
      value: "week",
      label: "This week",
      hint: rangeLabel(
        periodFor("week", null, custom, sharedTeam).start,
        periodFor("week", null, custom, sharedTeam).end,
      ),
    },
    {
      value: "month",
      label: sharedTeam ? "This month" : "This month so far",
      hint: rangeLabel(
        periodFor("month", null, custom, sharedTeam).start,
        periodFor("month", null, custom, sharedTeam).end,
      ),
    },
    { value: "custom", label: "Choose dates" },
  ];

  const go = async () => {
    if (!period.start || !period.end || period.end < period.start) {
      setError("Choose a start date on or before the end date.");
      return;
    }
    setError(undefined);
    try {
      const created = await start.mutateAsync({
        kind: "project",
        template: "project_progress",
        subjectId: project.id,
        periodType: choice === "month" ? "monthly" : "other",
        periodStart: period.start,
        periodEnd: period.end,
        title: `${project.name}: progress, ${rangeLabel(period.start, period.end)}`,
      });
      onClose();
      onStarted(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the report");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{sharedTeam ? "Open team report" : "Write a report"}</DialogTitle>
          <DialogDescription>
            {sharedTeam
              ? "Choose a period. An existing team report opens automatically."
              : "Choose a period and review the progress recorded in AIMS."}
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="sr-only">Period</legend>
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2",
                choice === o.value && "border-primary bg-primary/5",
              )}
            >
              <input
                type="radio"
                name="report-period"
                value={o.value}
                checked={choice === o.value}
                onChange={() => setChoice(o.value)}
                className="mt-1 accent-primary"
              />
              <span className="text-sm">
                <span className="block font-medium">{o.label}</span>
                {o.hint && <span className="block text-xs text-muted-foreground">{o.hint}</span>}
              </span>
            </label>
          ))}
        </fieldset>
        {choice === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <FormField id="rp-start" label="From">
              <Input
                id="rp-start"
                type="date"
                value={custom.start}
                onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
              />
            </FormField>
            <FormField id="rp-end" label="To" error={error}>
              <Input
                id="rp-end"
                type="date"
                value={custom.end}
                onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
              />
            </FormField>
          </div>
        )}
        {error && choice !== "custom" && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} disabled={start.isPending}>
            {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {sharedTeam ? "Open report" : "Start report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeamReportDialog({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const reportQ = useReport(reportId);
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  return (
    <Dialog open onOpenChange={(open) => !open && guardClose(onClose)}>
      <DialogContent className="max-h-[92dvh] sm:max-w-6xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Team report</DialogTitle>
          <DialogDescription>Prepare and submit the shared project report.</DialogDescription>
        </DialogHeader>
        {reportQ.isError ? (
          <LoadError
            what="the team report"
            error={reportQ.error}
            onRetry={() => reportQ.refetch()}
          />
        ) : reportQ.data ? (
          <ReportEditor report={reportQ.data} onLeave={onClose} onDirtyChange={setDirty} />
        ) : (
          <p role="status" className="py-8 text-center text-sm text-muted-foreground">
            Loading the team report...
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
