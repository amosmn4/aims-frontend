import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Inbox, Loader2, Mail, Sparkles } from "lucide-react";
import { apiJson } from "@/lib/api-client";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useCompanySettings } from "@/features/settings/use-company-settings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { LoadError } from "@/components/load-error";
import { cn } from "@/lib/utils";
import { downloadBoardPack } from "./board-pack-pdf";
import { actionNeeded, reportPath } from "./report-rows";
import {
  DELTA_TONE,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
  figureDelta,
  formatReportPeriod,
  monthLabel as monthName,
  movedALot,
  personName,
} from "./report-format";
import {
  useReportAiStatus,
  useReportAssist,
  useReports,
  type ReportRow,
  type ReportStatus,
} from "./use-reports";
import {
  REPORT_EMAILS,
  useReportEmailSubscriptions,
  useSetReportEmailSubscription,
} from "./use-department-reports";

/** One thing sent to the CEO: a department's month, a project's close, or finance. */
interface InboxItem {
  kind: "department_report" | "finance_report";
  id: string;
  title: string;
  /** Null on a project report — it names a project, not a department. */
  department: { id: string | null; name: string; code: string } | null;
  periodStart: string;
  periodEnd: string;
  status: ReportStatus;
  resubmitted: boolean;
  submittedAt: string | null;
  updatedAt: string;
  author: { id: string; fullName: string | null; email: string } | null;
  lastMessage: { body: string; authorName: string | null } | null;
  figures: unknown;
  summary: string | null;
  /** What the report is about, and who is expected to decide on it. */
  reportKind?: "department" | "project" | "individual";
  decidedBy?: "ceo" | "department_head";
  subjectName?: string | null;
}

type View = "waiting" | "with_heads" | "with_departments" | "approved" | "all";

const VIEWS: { id: View; label: string; match: (r: InboxItem) => boolean }[] = [
  {
    id: "waiting",
    label: "Waiting on you",
    // A report a department head owns is not yours to decide on.
    match: (r) => r.status === "submitted" && r.decidedBy !== "department_head",
  },
  {
    id: "with_heads",
    label: "With heads",
    match: (r) => r.status === "submitted" && r.decidedBy === "department_head",
  },
  {
    id: "with_departments",
    label: "Back with departments",
    match: (r) => r.status === "changes_requested",
  },
  { id: "approved", label: "Approved", match: (r) => r.status === "approved" },
  { id: "all", label: "All", match: () => true },
];

const monthKey = (iso: string) => iso.slice(0, 7);
const labelForKey = (key: string) => monthName(`${key}-01`);

const openReport = (item: InboxItem): string =>
  item.kind === "finance_report" ? `/finance/reports/${item.id}` : reportPath(item.id);

function firstSentence(text: string | null, max = 200) {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const line = (clean.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? clean).trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** The figure that moved most, so a row says why it is worth opening. */
function headlineMove(row: ReportRow | undefined) {
  let best: {
    label: string;
    text: string;
    direction: "up" | "down" | "flat";
    size: number;
  } | null = null;
  for (const figure of row?.figures ?? []) {
    if (!movedALot(figure)) continue;
    const delta = figureDelta(figure);
    if (!delta || delta.percent === null) continue;
    const size = Math.abs(delta.percent);
    if (best && size <= best.size) continue;
    best = { label: figure.label, text: delta.text, direction: delta.direction, size };
  }
  return best;
}

function useReportsInbox() {
  return useQuery({
    queryKey: ["reports-inbox"],
    queryFn: () => apiJson<InboxItem[]>("/reports-inbox"),
  });
}

/** The CEO's reports inbox, board pack and scheduled report emails. */
export function ReportsInbox() {
  const inboxQ = useReportsInbox();
  const rowsQ = useReports();
  const aiQ = useReportAiStatus();
  const assist = useReportAssist();
  const departmentsQ = useDepartments();
  const settingsQ = useCompanySettings();
  const [view, setView] = useState<View>("waiting");
  const [brief, setBrief] = useState<string | null>(null);

  const items = useMemo(() => inboxQ.data ?? [], [inboxQ.data]);
  const rows = items.filter(VIEWS.find((v) => v.id === view)!.match);
  const byId = useMemo(() => new Map((rowsQ.data ?? []).map((r) => [r.id, r])), [rowsQ.data]);

  const months = useMemo(() => {
    const keys = new Set(
      items.filter((r) => r.status === "approved").map((r) => monthKey(r.periodEnd)),
    );
    const prev = new Date();
    prev.setDate(1);
    prev.setMonth(prev.getMonth() - 1);
    keys.add(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`);
    return [...keys].sort().reverse();
  }, [items]);
  const [packMonth, setPackMonth] = useState<string>("");
  const selectedMonth = packMonth || months[0] || "";
  const coreDepartments = (departmentsQ.data ?? []).filter((d) =>
    ["operations", "finance", "hr", "it", "marketing", "tender"].includes(d.code),
  );
  const approvedInMonth = items.filter(
    (r) => r.status === "approved" && monthKey(r.periodEnd) === selectedMonth,
  );

  // The briefing reads across approved reports; any one of them can carry the request.
  const briefSubject =
    approvedInMonth.find((r) => r.kind === "department_report")?.id ??
    items.find((r) => r.status === "approved" && r.kind === "department_report")?.id ??
    null;

  const askForBrief = () => {
    if (!briefSubject) {
      toast.error("No report has been approved yet, so there is nothing to read across");
      return;
    }
    assist.mutate(
      { id: briefSubject, job: "brief" },
      {
        onSuccess: (result) => setBrief(result.text ?? ""),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't write the briefing"),
      },
    );
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card" aria-labelledby="inbox-heading">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 pb-2 pt-3">
          <div>
            <h2 id="inbox-heading" className="flex items-center gap-2 text-sm font-semibold">
              <Inbox className="h-4 w-4 text-primary" aria-hidden="true" /> Reports sent to you
            </h2>
            <p className="text-xs text-muted-foreground">
              What the departments and projects sent you, and what is still out.
            </p>
          </div>
          {aiQ.data?.configured && selectedMonth && (
            <Button size="sm" variant="outline" disabled={assist.isPending} onClick={askForBrief}>
              {assist.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="mr-1 h-4 w-4" aria-hidden="true" />
              )}
              Brief me on {labelForKey(selectedMonth)}
            </Button>
          )}
        </div>
        <div
          className="flex gap-1 overflow-x-auto border-b px-4"
          role="tablist"
          aria-label="Filter reports"
        >
          {VIEWS.filter(
            // "With heads" only appears once heads actually review something.
            (v) => v.id !== "with_heads" || items.some((r) => r.decidedBy === "department_head"),
          ).map((v) => {
            const count = items.filter(v.match).length;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                  view === v.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {v.label}
                <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-xs text-muted-foreground">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {inboxQ.isError ? (
          <LoadError
            what="the reports sent to you"
            error={inboxQ.error}
            onRetry={() => inboxQ.refetch()}
            className="m-4"
          />
        ) : inboxQ.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? "Nobody has sent you a report yet."
              : view === "waiting"
                ? "Nothing is waiting on you — you're up to date."
                : view === "with_departments"
                  ? "Nothing is back with a department for changes."
                  : view === "approved"
                    ? "No reports approved yet."
                    : "No reports yet."}
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((item) => (
              <InboxRow key={`${item.kind}-${item.id}`} item={item} row={byId.get(item.id)} />
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4" aria-labelledby="pack-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="pack-heading" className="text-sm font-semibold">
              Monthly board pack
            </h2>
            <label
              className="flex items-center gap-2 text-xs text-muted-foreground"
              htmlFor="pack-month"
            >
              Month
              <select
                id="pack-month"
                className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
                value={selectedMonth}
                onChange={(e) => setPackMonth(e.target.value)}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {labelForKey(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            One document made from each department's approved report for the month.
          </p>
          <ul className="mt-3 divide-y">
            {coreDepartments.map((d) => {
              const ready = approvedInMonth.some((r) => r.department?.code === d.code);
              return (
                <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{d.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      ready ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
                    )}
                  >
                    {ready ? "Approved — in the pack" : "No approved report yet"}
                  </span>
                </li>
              );
            })}
          </ul>
          <Button
            className="mt-3"
            size="sm"
            disabled={!selectedMonth || approvedInMonth.length === 0}
            onClick={() => {
              downloadBoardPack({
                monthLabel: labelForKey(selectedMonth),
                companyName: settingsQ.data?.companyName ?? "AIMS",
                departments: coreDepartments,
                reports: approvedInMonth,
              });
              toast.success("Board pack downloaded");
            }}
          >
            <Download className="mr-1 h-4 w-4" /> Download board pack (PDF)
          </Button>
        </section>

        <ReportEmails />
      </div>

      <Dialog open={brief !== null} onOpenChange={(open) => !open && setBrief(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Your briefing on {labelForKey(selectedMonth)}</DialogTitle>
            <DialogDescription>
              Drawn from the approved reports only. Check anything you plan to act on.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto text-sm leading-relaxed">
            {(brief || "Nothing came back.").split(/\n{2,}/).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InboxRow({ item, row }: { item: InboxItem; row: ReportRow | undefined }) {
  // A person's report names them; a project report names its project in the title.
  const subject =
    item.subjectName ??
    item.department?.name ??
    (item.reportKind === "project" ? "Project report" : "Report");
  // Anything a head owns is here to read, not to decide on.
  const theirs = item.decidedBy === "department_head";
  const decision = row ? actionNeeded(row) : null;
  const fallback = decision ? null : firstSentence(item.summary);
  const moved = headlineMove(row);
  const status = item.status === "submitted" && item.resubmitted ? "Sent again" : null;

  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3 hover:bg-secondary/30">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {subject} · {formatReportPeriod(item.periodStart, item.periodEnd)} · sent by{" "}
          {personName(item.author, "AIMS")}
          {item.resubmitted && " · sent again after your note"}
        </p>
        {theirs && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.reportKind === "individual" ? "Their own report" : "Progress report"} — their head
            decides. Here so you can read it.
          </p>
        )}
        {decision && (
          <p className="mt-1 text-xs text-warning">
            <span className="font-medium">Wants a decision: </span>
            {firstSentence(decision)}
          </p>
        )}
        {fallback && <p className="mt-1 text-xs">{fallback}</p>}
        {moved && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {moved.label}{" "}
            <span className={DELTA_TONE[moved.direction]}>
              {moved.direction === "up" ? "up" : "down"} {moved.text}
            </span>{" "}
            on the period before
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
            REPORT_STATUS_TONE[item.status],
          )}
        >
          {status ?? REPORT_STATUS_LABEL[item.status]}
        </span>
        <Button asChild size="sm" variant={item.status === "submitted" ? "default" : "outline"}>
          <Link to={openReport(item)}>{item.status === "submitted" ? "Read it" : "Open"}</Link>
        </Button>
      </div>
    </li>
  );
}

function ReportEmails() {
  const subsQ = useReportEmailSubscriptions();
  const setSub = useSetReportEmailSubscription();
  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="emails-heading">
      <h2 id="emails-heading" className="flex items-center gap-2 text-sm font-semibold">
        <Mail className="h-4 w-4 text-primary" aria-hidden="true" /> Reports sent to your email
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose what arrives in your inbox and when.
      </p>
      <ul className="mt-3 divide-y">
        {REPORT_EMAILS.map((e) => {
          const enabled = subsQ.data?.find((s) => s.reportKey === e.key)?.enabled ?? false;
          return (
            <li key={e.key} className="flex items-center justify-between gap-3 py-2">
              <label htmlFor={`email-${e.key}`} className="text-sm">
                {e.label}
                <span className="block text-xs text-muted-foreground">{e.when}</span>
              </label>
              <Switch
                id={`email-${e.key}`}
                checked={enabled}
                disabled={subsQ.isLoading || setSub.isPending}
                onCheckedChange={(checked) =>
                  setSub.mutate(
                    { reportKey: e.key, enabled: checked },
                    {
                      onSuccess: () =>
                        toast.success(
                          checked
                            ? `${e.label} will be emailed to you`
                            : `${e.label} emails turned off`,
                        ),
                      onError: (err) =>
                        toast.error(err instanceof Error ? err.message : "Couldn't save"),
                    },
                  )
                }
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
