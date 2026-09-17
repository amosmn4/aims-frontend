import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileArchive, KanbanSquare, Loader2, Plus, Search } from "lucide-react";
import { RequireDepartmentAccess } from "@/components/require-role";
import { RowActions } from "@/components/row-actions";
import { confirmDialog } from "@/components/confirm-dialog";
import { usePermissions } from "@/lib/permissions";
import { formatDate } from "@/lib/format-date";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { ClientPicker } from "@/features/clients/client-picker";
import { EditTenderDialog } from "@/features/tender/edit-tender-dialog";
import {
  useTenders,
  useTenderPipelineSummary,
  useTenderTimeMetrics,
  useSaveTender,
  useDeleteTender,
  TENDER_STAGES,
  TENDER_STAGE_LABELS,
  TENDER_STAGE_STYLES,
  type TenderStage,
  type TenderRow,
} from "@/features/tender/use-tender";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import { useTenderDepartmentOptions } from "@/features/tender/forward-tender-dialog";
import { useServiceLines } from "@/features/finance/use-finance-data";
import { formatCurrency } from "@/features/finance/finance";
import { FunnelChart } from "@/components/funnel-chart";
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter";
import { usePagination } from "@/hooks/use-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PaginationBar } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { OwnWorkPanels } from "@/features/my-work/own-work-panels";
export const Route = createFileRoute("/_authenticated/tender/")({
  head: () => ({ meta: [{ title: "Tenders — AIMS" }] }),
  component: () => (
    <RequireDepartmentAccess
      code="tender"
      message="The Tender workspace is for the Tender team, people granted Tender access and the CEO."
    >
      <TenderWorkspace />
    </RequireDepartmentAccess>
  ),
});

const FUNNEL_STAGES: TenderStage[] = [
  "identified",
  "applying",
  "submitted",
  "won",
  "lost",
  "withdrawn",
  "cancelled",
];
const FUNNEL_COLORS: Record<string, string> = {
  identified: "#8C8C8C",
  applying: "#085599",
  submitted: "#F5821F",
  won: "#2E9E4F",
  lost: "#D64545",
  withdrawn: "#94a3b8",
  cancelled: "#6B5490",
};

// The Tender department dashboard.
export function TenderWorkspace() {
  const navigate = useNavigate();
  const perms = usePermissions();
  const deleteTender = useDeleteTender();
  const [editing, setEditing] = useState<TenderRow | null>(null);
  const [departmentId, setDepartmentId] = useState("all");
  const [serviceLineId, setServiceLineId] = useState("all");
  const [stage, setStage] = useState<TenderStage | "all">("all");
  const [q, setQ] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({});
  // Bumped on "Clear filters" so the period dropdown resets too.
  const [filterResetKey, setFilterResetKey] = useState(0);
  const { page, pageSize, setPage, setPageSize } = usePagination(25);
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  const filters = {
    departmentId: departmentId === "all" ? undefined : departmentId,
    serviceLineId: serviceLineId === "all" ? undefined : serviceLineId,
    stage: stage === "all" ? undefined : stage,
    q: debouncedQ || undefined,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  };
  const hasFilters = Object.values(filters).some(Boolean);

  const clearFilters = () => {
    setDepartmentId("all");
    setServiceLineId("all");
    setStage("all");
    setQ("");
    setDateRange({});
    setFilterResetKey((k) => k + 1);
    setPage(1);
  };

  const tendersQ = useTenders(filters, { page, pageSize });
  // Keep showing the last results while the next filter's page loads.
  const [lastResult, setLastResult] = useState(tendersQ.data);
  if (tendersQ.data && tendersQ.data !== lastResult) setLastResult(tendersQ.data);
  const tendersResult = tendersQ.data ?? lastResult;
  const tenders = tendersResult
    ? Array.isArray(tendersResult)
      ? tendersResult
      : tendersResult.data
    : [];
  const tendersTotal =
    tendersResult && !Array.isArray(tendersResult) ? tendersResult.total : tenders.length;
  const summaryQ = useTenderPipelineSummary({
    departmentId: filters.departmentId,
    serviceLineId: filters.serviceLineId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
  const departmentsQ = useDepartments();
  const serviceLinesQ = useServiceLines();
  const timeMetricsQ = useTenderTimeMetrics({
    departmentId: filters.departmentId,
    serviceLineId: filters.serviceLineId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  const summary = summaryQ.data ?? [];
  const totalTenders = summary.reduce((sum, s) => sum + s.count, 0);
  const activeCount = summary
    .filter((s) => s.stage === "identified" || s.stage === "applying" || s.stage === "submitted")
    .reduce((sum, s) => sum + s.count, 0);
  const pipelineValue = summary
    .filter((s) => s.stage === "identified" || s.stage === "applying" || s.stage === "submitted")
    .reduce((sum, s) => sum + s.total_value, 0);
  const wonCount = summary.find((s) => s.stage === "won")?.count ?? 0;
  const lostCount = summary.find((s) => s.stage === "lost")?.count ?? 0;
  const winRate = wonCount + lostCount > 0 ? wonCount / (wonCount + lostCount) : null;

  // Pass-through funnel: cumulative_count is "how many tenders ever reached at least this
  // stage" (never shrinks as tenders advance, only when one's deleted) — not the live `count`
  // of what's sitting in that exact stage right now, which is what a Kanban column shows.
  const funnelData = FUNNEL_STAGES.map((s) => ({
    stage: TENDER_STAGE_LABELS[s],
    value: summary.find((r) => r.stage === s)?.cumulative_count ?? 0,
    color: FUNNEL_COLORS[s],
  }));

  const removeTender = async (t: TenderRow) => {
    const ok = await confirmDialog({
      title: `Delete "${t.title}"?`,
      description:
        "This removes the tender and everything tracked against it. This can't be undone.",
      confirmLabel: "Delete tender",
      destructive: true,
    });
    if (!ok) return;
    deleteTender.mutate(t.id, {
      onSuccess: () => toast.success("Tender deleted"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
  };

  return (
    <div className="space-y-4">
      {editing && <EditTenderDialog tender={editing} onClose={() => setEditing(null)} />}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Tenders</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every tender being bid for: what's open, deadlines and how often we win.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/tender/bid-pipeline">
              <KanbanSquare className="h-4 w-4 mr-1" /> Open the board
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/tender/documents">
              <FileArchive className="h-4 w-4 mr-1" /> Mandatory documents library
            </Link>
          </Button>
          {perms.canManageTenders && <NewTenderDialog />}
        </div>
      </div>
      {!perms.canManageTenders && <ViewOnlyBanner area="Tenders" />}
      <OwnWorkPanels departmentCode="tender" role="tender" />

      {summaryQ.isError ? (
        <LoadError what="tender totals" error={summaryQ.error} onRetry={() => summaryQ.refetch()} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Open tenders" value={activeCount.toLocaleString()} />
          <KpiCard label="Value being bid" value={formatCurrency(pipelineValue)} />
          <KpiCard
            label="Win rate"
            value={winRate != null ? `${(winRate * 100).toFixed(0)}%` : "—"}
          />
          <KpiCard label="Total tenders" value={totalTenders.toLocaleString()} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-1 rounded-lg border bg-card p-4 min-w-0 overflow-hidden">
          <h2 className="text-sm font-semibold mb-2">How far tenders get</h2>
          {summaryQ.isError ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Totals didn't load.</p>
          ) : summaryQ.isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : totalTenders === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No tenders yet.</div>
          ) : (
            <FunnelChart stages={funnelData} formatValue={(v) => v.toLocaleString()} />
          )}
        </div>

        <div className="lg:col-span-2 rounded-lg border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search title, reference or client"
                aria-label="Search tenders"
                className="pl-7"
              />
            </div>
            <div className="w-40">
              <Select
                value={departmentId}
                onValueChange={(v) => {
                  setDepartmentId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="Department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {(departmentsQ.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select
                value={serviceLineId}
                onValueChange={(v) => {
                  setServiceLineId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="Service line">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All service lines</SelectItem>
                  {(serviceLinesQ.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Select
                value={stage}
                onValueChange={(v) => {
                  setStage(v as TenderStage | "all");
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="Stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {TENDER_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TENDER_STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateRangeFilter
              key={filterResetKey}
              value={dateRange}
              onChange={(r) => {
                setDateRange(r);
                setPage(1);
              }}
            />
          </div>

          {tendersQ.isError && !tendersQ.data ? (
            <LoadError what="tenders" error={tendersQ.error} onRetry={() => tendersQ.refetch()} />
          ) : !tendersResult && tendersQ.isPending ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : tenders.length === 0 && hasFilters ? (
            <div className="py-6 flex flex-col items-center gap-2 text-center">
              <div className="text-sm font-medium">No matches</div>
              <div className="text-xs text-muted-foreground">No tenders match these filters.</div>
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : tenders.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-2 text-center">
              <div className="text-sm font-medium">No tenders yet</div>
              {perms.canManageTenders && <NewTenderDialog />}
            </div>
          ) : (
            <div
              className={`overflow-x-auto transition-opacity ${tendersQ.data ? "" : "opacity-60"}`}
              aria-busy={!tendersQ.data}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    {perms.canManageTenders && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenders.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-secondary/40"
                      onClick={() =>
                        navigate({ to: "/tender/$tenderId", params: { tenderId: t.id } })
                      }
                    >
                      <TableCell className="font-medium">
                        <Link
                          to="/tender/$tenderId"
                          params={{ tenderId: t.id }}
                          className="hover:underline"
                        >
                          {t.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.client_name ?? t.prospect_client_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{t.department_name}</TableCell>
                      <TableCell>
                        <Badge className={TENDER_STAGE_STYLES[t.stage]} variant="secondary">
                          {TENDER_STAGE_LABELS[t.stage]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(t.submission_deadline)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {t.estimated_value != null
                          ? formatCurrency(t.estimated_value, t.currency)
                          : "—"}
                      </TableCell>
                      {perms.canManageTenders && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <RowActions
                            label={t.title}
                            onEdit={() => setEditing(t)}
                            onDelete={() => removeTender(t)}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                page={page}
                pageSize={pageSize}
                total={tendersTotal}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold mb-2">Time to submit &amp; decide</h2>
        {timeMetricsQ.isError ? (
          <LoadError
            what="tender timings"
            error={timeMetricsQ.error}
            onRetry={() => timeMetricsQ.refetch()}
          />
        ) : timeMetricsQ.isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid grid-cols-2 gap-3 md:col-span-1">
              <KpiCard
                label="Avg. days to submit"
                value={
                  timeMetricsQ.data?.avg_days_to_submit != null
                    ? `${timeMetricsQ.data.avg_days_to_submit}d`
                    : "—"
                }
              />
              <KpiCard
                label="Avg. days to decide"
                value={
                  timeMetricsQ.data?.avg_days_to_decision != null
                    ? `${timeMetricsQ.data.avg_days_to_decision}d`
                    : "—"
                }
              />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-muted-foreground mb-1.5">
                Waiting longest to be submitted
              </div>
              {(timeMetricsQ.data?.stalled ?? []).length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">Nothing stalled right now.</div>
              ) : (
                <div className="space-y-1">
                  {(timeMetricsQ.data?.stalled ?? []).slice(0, 5).map((s) => (
                    <Link
                      key={s.id}
                      to="/tender/$tenderId"
                      params={{ tenderId: s.id }}
                      className="flex items-center justify-between text-xs rounded px-2 py-1.5 hover:bg-secondary/50"
                    >
                      <span className="truncate mr-2">{s.title}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <Badge className={TENDER_STAGE_STYLES[s.stage]} variant="secondary">
                          {TENDER_STAGE_LABELS[s.stage]}
                        </Badge>
                        <span className="text-muted-foreground tabular-nums">{s.days}d</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const blankTender = {
  title: "",
  referenceNumber: "",
  departmentId: "",
  clientMode: "existing" as "existing" | "prospect",
  clientId: "",
  prospectClientName: "",
  serviceLineId: "",
  estimatedValue: "",
  submissionDeadline: "",
  description: "",
};
type TenderForm = typeof blankTender;

function NewTenderDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TenderForm>(blankTender);
  const [errors, setErrors] = useState<Partial<Record<keyof TenderForm, string>>>({});
  const departmentsQ = useTenderDepartmentOptions();
  const serviceLinesQ = useServiceLines();
  const save = useSaveTender();
  const dirty = (Object.keys(blankTender) as (keyof TenderForm)[]).some(
    (k) => form[k] !== blankTender[k],
  );
  const { guardClose } = useUnsavedChanges(open && dirty);

  const set = <K extends keyof TenderForm>(key: K, value: TenderForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const close = () => {
    setOpen(false);
    setForm(blankTender);
    setErrors({});
  };

  const submit = () => {
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = "Enter the tender title.";
    if (!form.departmentId) next.departmentId = "Choose the department most likely to deliver it.";
    if (form.estimatedValue && Number(form.estimatedValue) < 0)
      next.estimatedValue = "Value can't be negative.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate(
      {
        title: form.title.trim(),
        reference_number: form.referenceNumber.trim() || undefined,
        department_id: form.departmentId,
        client_id: form.clientMode === "existing" ? form.clientId || undefined : undefined,
        prospect_client_name:
          form.clientMode === "prospect" ? form.prospectClientName.trim() || undefined : undefined,
        service_line_id: form.serviceLineId || undefined,
        estimated_value: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        submission_deadline: form.submissionDeadline || undefined,
        description: form.description.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Tender added");
          close();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "The tender wasn't saved"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : guardClose(close))}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> New tender
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>New tender</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <RequiredNote />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField id="tender-new-title" label="Title" required error={errors.title}>
                <Input
                  id="tender-new-title"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  aria-invalid={!!errors.title}
                />
              </FormField>
              <FormField
                id="tender-new-ref"
                label="Reference number"
                hint="As on the tender notice"
              >
                <Input
                  id="tender-new-ref"
                  value={form.referenceNumber}
                  onChange={(e) => set("referenceNumber", e.target.value)}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                id="tender-new-department"
                label="Department"
                required
                error={errors.departmentId}
              >
                <Select value={form.departmentId} onValueChange={(v) => set("departmentId", v)}>
                  <SelectTrigger id="tender-new-department" aria-invalid={!!errors.departmentId}>
                    <SelectValue placeholder="Choose a department…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(departmentsQ.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="tender-new-client" className="text-sm font-medium">
                    Client
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      set("clientMode", form.clientMode === "existing" ? "prospect" : "existing")
                    }
                    className="text-xs text-primary hover:underline"
                  >
                    {form.clientMode === "existing" ? "Type a company name" : "Pick a client"}
                  </button>
                </div>
                <div className="mt-1">
                  {form.clientMode === "existing" ? (
                    <ClientPicker
                      value={form.clientId}
                      onChange={(v) => set("clientId", v)}
                      allowNone
                      placeholder="Not yet known"
                    />
                  ) : (
                    <Input
                      id="tender-new-client"
                      value={form.prospectClientName}
                      onChange={(e) => set("prospectClientName", e.target.value)}
                      placeholder="Company name (not in the system yet)"
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField id="tender-new-service-line" label="Service line">
                <Select
                  value={form.serviceLineId || "__none__"}
                  onValueChange={(v) => set("serviceLineId", v === "__none__" ? "" : v)}
                >
                  <SelectTrigger id="tender-new-service-line">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(serviceLinesQ.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                id="tender-new-value"
                label="Estimated value"
                error={errors.estimatedValue}
              >
                <Input
                  id="tender-new-value"
                  type="number"
                  min={0}
                  value={form.estimatedValue}
                  onChange={(e) => set("estimatedValue", e.target.value)}
                  aria-invalid={!!errors.estimatedValue}
                />
              </FormField>
              <FormField id="tender-new-deadline" label="Submission deadline">
                <Input
                  id="tender-new-deadline"
                  type="date"
                  value={form.submissionDeadline}
                  onChange={(e) => set("submissionDeadline", e.target.value)}
                />
              </FormField>
            </div>
            <FormField id="tender-new-description" label="Description">
              <Textarea
                id="tender-new-description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardClose(close)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add tender
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
