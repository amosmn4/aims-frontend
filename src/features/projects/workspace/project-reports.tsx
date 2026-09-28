import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useReports, useStartReport, type ReportRow } from "@/features/reports/use-reports";
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
) {
  const today = iso(new Date());
  const now = new Date();
  if (choice === "since_last" && lastEnd) return { start: addDays(lastEnd, 1), end: today };
  if (choice === "week") {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { start: iso(monday), end: today };
  }
  if (choice === "custom") return custom;
  return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end: today };
}

/** Reports about a project: anyone on it writes one for any period and shares it with the team. */
export function ProjectReports({ project, canWrite }: { project: Project; canWrite: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reportsQ = useReports({ kind: "project", subjectId: project.id });
  const [choosing, setChoosing] = useState(false);
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
            Anyone on the project writes one for whatever period suits, and shares it with the team.
            AIMS fills in the figures, decisions and discussions.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setChoosing(true)}>
            <Plus className="mr-1 h-4 w-4" /> Write report
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
          {canWrite && " Press Write report and AIMS drafts one from what the team has logged."}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {reports.map((r) => (
            <ReportLine key={r.id} report={r} mine={r.createdBy === user?.id} />
          ))}
        </ul>
      )}

      {choosing && (
        <WriteReportDialog
          project={project}
          lastEnd={lastEnd}
          onClose={() => setChoosing(false)}
          onStarted={(id) => navigate({ to: REPORT_PATH, params: { reportId: id } })}
        />
      )}
    </div>
  );
}

function ReportLine({ report: r, mine }: { report: ReportRow; mine: boolean }) {
  const who = r.creator.fullName ?? r.creator.email;
  const draft = r.status === "draft";
  return (
    <li>
      <Link
        to={REPORT_PATH}
        params={{ reportId: r.id }}
        className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary/50"
      >
        <Initials name={who} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{r.title}</span>
          <span className="block text-xs text-muted-foreground">
            {who} · {rangeLabel(r.periodStart.slice(0, 10), r.periodEnd.slice(0, 10))}
            {r.submittedAt && !draft ? ` · shared ${formatDate(r.submittedAt)}` : ""}
          </span>
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            REPORT_STATUS_TONE[r.status],
          )}
        >
          {draft ? "Not shared yet" : REPORT_STATUS_LABEL[r.status]}
        </span>
        <span className="rounded-md border px-2.5 py-1 text-xs font-medium">
          {mine && (draft || r.status === "shared") ? "Open to edit" : "Read"}
        </span>
      </Link>
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
  const canContinue = !!lastEnd && lastEnd < today;
  const [choice, setChoice] = useState<PeriodChoice>(canContinue ? "since_last" : "month");
  const [custom, setCustom] = useState({ start: project.start_date ?? today, end: today });
  const [error, setError] = useState<string>();
  const period = periodFor(choice, lastEnd, custom);

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
      hint: rangeLabel(periodFor("week", null, custom).start, today),
    },
    {
      value: "month",
      label: "This month so far",
      hint: rangeLabel(periodFor("month", null, custom).start, today),
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
        title: `${project.name} — progress, ${rangeLabel(period.start, period.end)}`,
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
          <DialogTitle>Write a report</DialogTitle>
          <DialogDescription>
            Pick the period it covers. AIMS fills in what was finished, decided and discussed in it;
            you edit and add before sharing.
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
            Start report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
