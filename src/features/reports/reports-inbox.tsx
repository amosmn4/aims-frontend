import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Inbox, Loader2, Mail } from "lucide-react";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useCompanySettings } from "@/features/settings/use-company-settings";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LoadError } from "@/components/load-error";
import { cn } from "@/lib/utils";
import { ReportStatusPill } from "./department-reports-panel";
import { downloadBoardPack } from "./board-pack-pdf";
import {
  REPORT_EMAILS,
  formatPeriod,
  reportLink,
  useReportEmailSubscriptions,
  useReportsInbox,
  useSetReportEmailSubscription,
  type InboxItem,
} from "./use-department-reports";

type View = "waiting" | "with_departments" | "approved" | "all";

const VIEWS: { id: View; label: string; match: (r: InboxItem) => boolean }[] = [
  { id: "waiting", label: "Waiting for you", match: (r) => r.status === "submitted" },
  {
    id: "with_departments",
    label: "With departments",
    match: (r) => r.status === "changes_requested",
  },
  { id: "approved", label: "Approved", match: (r) => r.status === "approved" },
  { id: "all", label: "All", match: () => true },
];

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/** The CEO's reports inbox, board pack and scheduled report emails. */
export function ReportsInbox() {
  const inboxQ = useReportsInbox();
  const departmentsQ = useDepartments();
  const settingsQ = useCompanySettings();
  const [view, setView] = useState<View>("waiting");
  const items = inboxQ.data ?? [];
  const rows = items.filter(VIEWS.find((v) => v.id === view)!.match);

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

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card" aria-labelledby="inbox-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 pt-3">
          <h2 id="inbox-heading" className="flex items-center gap-2 pb-2 text-sm font-semibold">
            <Inbox className="h-4 w-4 text-primary" aria-hidden="true" /> Department reports
          </h2>
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter reports">
            {VIEWS.map((v) => {
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
        </div>
        {inboxQ.isError ? (
          <LoadError
            what="department reports"
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
              ? "No department has sent a report yet."
              : view === "waiting"
                ? "Nothing is waiting for you — you're up to date."
                : view === "with_departments"
                  ? "No reports are waiting on a department's changes."
                  : view === "approved"
                    ? "No reports approved yet."
                    : "No reports yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Report</th>
                  <th className="px-4 py-2 font-medium">Department</th>
                  <th className="px-4 py-2 font-medium">Latest message</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.kind}-${r.id}`} className="border-t hover:bg-secondary/30">
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{r.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatPeriod(r.periodStart, r.periodEnd)} ·{" "}
                        {r.author?.fullName || r.author?.email || "AIMS"}
                        {r.resubmitted && " · resubmitted after your note"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{r.department.name}</td>
                    <td className="max-w-xs px-4 py-2.5 text-xs text-muted-foreground">
                      {r.lastMessage ? (
                        <span className="line-clamp-2">
                          <b className="font-medium text-foreground">
                            {r.lastMessage.authorName || "AIMS"}:
                          </b>{" "}
                          {r.lastMessage.body}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <ReportStatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        asChild
                        size="sm"
                        variant={r.status === "submitted" ? "default" : "outline"}
                      >
                        <Link to={reportLink(r.kind, r.id)}>
                          {r.status === "submitted" ? "Review report" : "Open report"}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                    {monthLabel(m)}
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
              const ready = approvedInMonth.some((r) => r.department.code === d.code);
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
                monthLabel: monthLabel(selectedMonth),
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
    </div>
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
