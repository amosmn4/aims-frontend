import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import { PageHeader } from "@/components/app-shell";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  useFinanceReports,
  useCreateFinanceReport,
  useAuthorProfiles,
} from "@/features/finance/use-finance-reports";
import {
  REPORT_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  buildSnapshot,
  defaultPeriodFor,
  defaultTitleFor,
  type FinanceReportStatus,
  type FinanceReportType,
} from "@/features/finance/finance-report-snapshot";
import {
  useInvoices,
  usePayments,
  useServiceLines,
  useClients,
} from "@/features/finance/use-finance-data";
import { useCompanyCurrency } from "@/features/finance/money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/finance/reports/")({
  head: () => ({ meta: [{ title: "Finance reports — AIMS" }] }),
  component: FinanceReportsIndex,
});

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function FinanceReportsIndex() {
  const { user, hasRole, isAdminOrCeo, canWriteDepartment } = useAuth();
  const canAuthor = canWriteDepartment("finance") && (isAdminOrCeo || hasRole("finance"));
  const reportsQ = useFinanceReports();
  const [statusFilter, setStatusFilter] = useState<"all" | FinanceReportStatus>("all");
  const authorIds = useMemo(
    () =>
      (reportsQ.data ?? []).flatMap(
        (r) => [r.created_by, r.submitted_by, r.reviewed_by].filter(Boolean) as string[],
      ),
    [reportsQ.data],
  );
  const profilesQ = useAuthorProfiles(authorIds);
  const [openNew, setOpenNew] = useState(false);

  const reports = reportsQ.data ?? [];
  // My drafts and reports sent back to me come first.
  const needsMe = (r: (typeof reports)[number]) =>
    r.created_by === user?.id && (r.status === "draft" || r.status === "changes_requested");
  const visible = reports
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .sort((a, b) => Number(needsMe(b)) - Number(needsMe(a)));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finance reports"
        description="Reports Finance sends to the CEO. The figures are captured for you; add your commentary, then submit for review."
        actions={
          canAuthor ? (
            <Button onClick={() => setOpenNew(true)}>
              <Plus className="mr-1 h-4 w-4" /> New finance report
            </Button>
          ) : undefined
        }
      />
      {!canAuthor && <ViewOnlyBanner area="finance reports" action="write reports" />}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-52">
          <Label htmlFor="report-status-filter" className="text-xs">
            Status
          </Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "all" | FinanceReportStatus)}
          >
            <SelectTrigger id="report-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(STATUS_LABELS) as FinanceReportStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {reportsQ.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Loading reports" />
          </div>
        ) : reportsQ.isError ? (
          <LoadError
            what="finance reports"
            error={reportsQ.error}
            onRetry={() => reportsQ.refetch()}
            className="m-3"
          />
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-8 text-sm text-muted-foreground">
            <span>No finance reports yet</span>
            {canAuthor && (
              <Button size="sm" onClick={() => setOpenNew(true)}>
                <Plus className="mr-1 h-4 w-4" /> New finance report
              </Button>
            )}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-8 text-sm text-muted-foreground">
            <span>No matches</span>
            <Button size="sm" variant="outline" onClick={() => setStatusFilter("all")}>
              Clear filters
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {visible.map((r) => {
              const author = profilesQ.data?.get(r.created_by);
              const reviewer = r.reviewed_by ? profilesQ.data?.get(r.reviewed_by) : null;
              return (
                <li key={r.id}>
                  <Link
                    to="/finance/reports/$id"
                    params={{ id: r.id }}
                    className="flex flex-wrap items-center gap-3 p-3 transition-colors hover:bg-secondary/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{r.title}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLES[r.status]}`}
                        >
                          {STATUS_LABELS[r.status]}
                        </span>
                        {needsMe(r) && (
                          <span className="text-xs font-medium text-primary">Needs you</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {REPORT_TYPE_LABELS[r.report_type] ?? r.report_type} ·{" "}
                        {formatDate(r.period_start)} – {formatDate(r.period_end)}
                        {author && <> · By {author.full_name ?? author.email}</>}
                        {reviewer && <> · Reviewed by {reviewer.full_name ?? reviewer.email}</>}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      Created {formatDate(r.created_at)}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {openNew && <NewReportDialog onClose={() => setOpenNew(false)} />}
    </div>
  );
}

type ReportErrors = Partial<Record<"start" | "end" | "title", string>>;

function NewReportDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const invoicesQ = useInvoices();
  const paymentsQ = usePayments();
  const slQ = useServiceLines();
  const clientsQ = useClients();
  const companyCurrency = useCompanyCurrency();
  const create = useCreateFinanceReport();

  const [initial] = useState(() => {
    const p = defaultPeriodFor("monthly_financial");
    return {
      type: "monthly_financial" as FinanceReportType,
      start: localIso(p.start),
      end: localIso(p.end),
      title: defaultTitleFor("monthly_financial", p.start, p.end),
    };
  });
  const [type, setType] = useState<FinanceReportType>(initial.type);
  const [startStr, setStartStr] = useState(initial.start);
  const [endStr, setEndStr] = useState(initial.end);
  const [title, setTitle] = useState(initial.title);
  const [narrative, setNarrative] = useState("");
  const [errors, setErrors] = useState<ReportErrors>({});
  const dirty =
    type !== initial.type ||
    startStr !== initial.start ||
    endStr !== initial.end ||
    title !== initial.title ||
    !!narrative.trim();
  const { guardClose } = useUnsavedChanges(dirty);

  const dataReady = !!(invoicesQ.data && paymentsQ.data && slQ.data && clientsQ.data);
  const dataFailed = [invoicesQ, paymentsQ, slQ, clientsQ].find((q) => q.isError);

  const onTypeChange = (t: FinanceReportType) => {
    setType(t);
    const p = defaultPeriodFor(t);
    setStartStr(localIso(p.start));
    setEndStr(localIso(p.end));
    setTitle(defaultTitleFor(t, p.start, p.end));
    setErrors({});
  };

  const save = async (submit: boolean) => {
    if (!dataReady) return;
    const found: ReportErrors = {};
    if (!startStr) found.start = "Choose the first day of the period";
    if (!endStr) found.end = "Choose the last day of the period";
    else if (startStr && endStr < startStr) found.end = "The end can't be before the start";
    if (!title.trim()) found.title = "Give the report a title";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (submit) {
      const ok = await confirmDialog({
        title: "Send this report to the CEO?",
        description: "You can't edit it again unless the CEO asks for changes.",
        confirmLabel: "Submit to CEO",
      });
      if (!ok) return;
    }
    const start = new Date(`${startStr}T00:00:00`);
    const end = new Date(`${endStr}T23:59:59.999`);
    const snapshot = buildSnapshot({
      type,
      periodStart: start,
      periodEnd: end,
      currency: companyCurrency,
      invoices: invoicesQ.data!,
      payments: paymentsQ.data!,
      serviceLines: slQ.data!,
      clients: clientsQ.data!,
    });
    try {
      const row = await create.mutateAsync({
        report_type: type,
        period_start: startStr,
        period_end: endStr,
        title: title.trim(),
        narrative,
        snapshot,
        submit,
      });
      toast.success(submit ? "Report submitted to CEO" : "Draft saved");
      onClose();
      navigate({ to: "/finance/reports/$id", params: { id: row.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save report");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New finance report</DialogTitle>
          <DialogDescription>
            Figures for the period are captured from invoices and payments in {companyCurrency}.
          </DialogDescription>
        </DialogHeader>
        <RequiredNote />
        <div className="space-y-3">
          <FormField id="new-report-type" label="Report type" required>
            <Select value={type} onValueChange={(v) => onTypeChange(v as FinanceReportType)}>
              <SelectTrigger id="new-report-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(REPORT_TYPE_LABELS) as [FinanceReportType, string][]).map(
                  ([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="new-report-start" label="Period start" required error={errors.start}>
              <Input
                id="new-report-start"
                type="date"
                value={startStr}
                aria-invalid={!!errors.start}
                onChange={(e) => setStartStr(e.target.value)}
              />
            </FormField>
            <FormField id="new-report-end" label="Period end" required error={errors.end}>
              <Input
                id="new-report-end"
                type="date"
                value={endStr}
                min={startStr || undefined}
                aria-invalid={!!errors.end}
                onChange={(e) => setEndStr(e.target.value)}
              />
            </FormField>
          </div>
          <FormField id="new-report-title" label="Title" required error={errors.title}>
            <Input
              id="new-report-title"
              value={title}
              aria-invalid={!!errors.title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>
          <FormField
            id="new-report-narrative"
            label="Finance commentary"
            hint="You can add this later, before you submit."
          >
            <Textarea
              id="new-report-narrative"
              rows={5}
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Key highlights, differences from plan, risks, actions taken…"
            />
          </FormField>
          {dataFailed ? (
            <LoadError
              what="the figures for this report"
              error={dataFailed.error}
              onRetry={() => {
                void invoicesQ.refetch();
                void paymentsQ.refetch();
                void slQ.refetch();
                void clientsQ.refetch();
              }}
            />
          ) : (
            !dataReady && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the latest figures…
              </p>
            )
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => guardClose(onClose)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => save(false)}
            disabled={!dataReady || create.isPending}
          >
            Save as draft
          </Button>
          <Button onClick={() => save(true)} disabled={!dataReady || create.isPending}>
            {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Submit to CEO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
