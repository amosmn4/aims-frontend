import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import {
  useComplianceRecords,
  useCreateComplianceRecord,
  useMarkFiled,
  type ComplianceStatus,
  type ComplianceRecord,
} from "@/features/finance/use-payroll-compliance";
import { useClients, type Client } from "@/features/finance/use-finance-data";
import { useFinanceAccess } from "@/features/finance/money";
import { StatTile } from "@/features/finance/stat-tile";

export const Route = createFileRoute("/_authenticated/finance/payroll-compliance")({
  head: () => ({ meta: [{ title: "Payroll compliance — AIMS Finance" }] }),
  component: PayrollCompliancePage,
});

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  pending: "Not filed yet",
  filed_on_time: "Filed on time",
  filed_late: "Filed late",
  overdue: "Overdue",
};

const STATUS_STYLES: Record<ComplianceStatus, string> = {
  pending: "bg-secondary text-secondary-foreground",
  filed_on_time: "bg-success/15 text-success",
  filed_late: "bg-warning/15 text-warning",
  overdue: "bg-destructive/15 text-destructive",
};

const localIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong. Please try again.";
const monthLabel = (period: string) =>
  new Date(`${period.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });

function PayrollCompliancePage() {
  const recordsQ = useComplianceRecords();
  const clientsQ = useClients();
  const { canWrite } = useFinanceAccess();
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | ComplianceStatus>("all");
  const [filing, setFiling] = useState<ComplianceRecord | null>(null);

  const records = useMemo(() => recordsQ.data ?? [], [recordsQ.data]);
  const summary = useMemo(
    () => ({
      onTime: records.filter((r) => r.effective_status === "filed_on_time").length,
      pending: records.filter((r) => r.effective_status === "pending").length,
      overdue: records.filter((r) => r.effective_status === "overdue").length,
      late: records.filter((r) => r.effective_status === "filed_late").length,
    }),
    [records],
  );
  const filtered = records.filter(
    (r) => statusFilter === "all" || r.effective_status === statusFilter,
  );
  const noRecords = records.length === 0 ? "No filings yet" : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll compliance"
        description="Track clients' statutory payroll filings such as PAYE, NSSF and SHIF, and whether each was filed on time."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-4 w-4" /> New filing
            </Button>
          ) : undefined
        }
      />
      {!canWrite && (
        <ViewOnlyBanner area="payroll compliance" action="add filings or mark them filed" />
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Overdue"
          value={summary.overdue}
          tone={summary.overdue ? "danger" : "default"}
          emptyText={noRecords}
        />
        <StatTile label="Not filed yet" value={summary.pending} emptyText={noRecords} />
        <StatTile
          label="Filed late"
          value={summary.late}
          tone={summary.late ? "warning" : "default"}
          emptyText={noRecords}
        />
        <StatTile
          label="Filed on time"
          value={summary.onTime}
          tone={summary.onTime ? "positive" : "default"}
          emptyText={noRecords}
        />
      </div>

      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <h2 className="mr-auto font-semibold">Filings</h2>
          <div className="w-full sm:w-48">
            <Label htmlFor="compliance-status-filter" className="text-xs">
              Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "all" | ComplianceStatus)}
            >
              <SelectTrigger id="compliance-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(STATUS_LABELS) as ComplianceStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {recordsQ.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Loading filings" />
          </div>
        ) : recordsQ.isError ? (
          <LoadError what="filings" error={recordsQ.error} onRetry={() => recordsQ.refetch()} />
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
            <span>No filings yet</span>
            {canWrite && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="mr-1 h-4 w-4" /> New filing
              </Button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
            <span>No matches</span>
            <Button size="sm" variant="outline" onClick={() => setStatusFilter("all")}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Filing</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  {canWrite && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.client_name}</TableCell>
                    <TableCell>{r.filing_type}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {monthLabel(r.period)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDate(r.due_date)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLES[r.effective_status]} variant="secondary">
                        {STATUS_LABELS[r.effective_status]}
                      </Badge>
                      {r.filed_date && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Filed {formatDate(r.filed_date)}
                        </div>
                      )}
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        {!r.filed_date && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setFiling(r)}
                            aria-label={`Mark ${r.filing_type} for ${r.client_name}, ${monthLabel(r.period)}, as filed`}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" /> Mark filed
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {creating && (
        <NewFilingDialog clients={clientsQ.data ?? []} onClose={() => setCreating(false)} />
      )}
      {filing && (
        <MarkFiledDialog key={filing.id} record={filing} onClose={() => setFiling(null)} />
      )}
    </div>
  );
}

function MarkFiledDialog({ record, onClose }: { record: ComplianceRecord; onClose: () => void }) {
  const markFiled = useMarkFiled();
  const [filedDate, setFiledDate] = useState(localIso());
  const [error, setError] = useState<string>();

  const handleMarkFiled = async () => {
    if (!filedDate) {
      setError("Choose the date it was filed");
      return;
    }
    try {
      await markFiled.mutateAsync({ id: record.id, filedDate });
      toast.success("Marked as filed");
      onClose();
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark {record.filing_type} as filed</DialogTitle>
          <DialogDescription>
            {record.client_name} · {monthLabel(record.period)} · due {formatDate(record.due_date)}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleMarkFiled();
          }}
        >
          <FormField id="filed-date" label="Filed on" required error={error}>
            <Input
              id="filed-date"
              type="date"
              value={filedDate}
              aria-invalid={!!error}
              onChange={(e) => {
                setFiledDate(e.target.value);
                setError(undefined);
              }}
            />
          </FormField>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={markFiled.isPending}>
              {markFiled.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark as filed
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type FilingDraft = {
  clientId: string;
  filingType: string;
  month: string;
  dueDate: string;
  notes: string;
};
type FilingErrors = Partial<Record<keyof FilingDraft | "form", string>>;

function NewFilingDialog({ clients, onClose }: { clients: Client[]; onClose: () => void }) {
  const [initial] = useState<FilingDraft>(() => ({
    clientId: "",
    filingType: "",
    month: localIso().slice(0, 7),
    dueDate: localIso(new Date(Date.now() + 14 * 86400000)),
    notes: "",
  }));
  const [draft, setDraft] = useState<FilingDraft>(initial);
  const [errors, setErrors] = useState<FilingErrors>({});
  const createRecord = useCreateComplianceRecord();
  const { guardClose } = useUnsavedChanges(JSON.stringify(draft) !== JSON.stringify(initial));

  const update = (patch: Partial<FilingDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e, form: undefined };
      for (const k of Object.keys(patch)) delete next[k as keyof FilingDraft];
      return next;
    });
  };

  const handleSave = async () => {
    const found: FilingErrors = {};
    if (!draft.clientId) found.clientId = "Choose the client";
    if (!draft.filingType.trim()) found.filingType = "Say which filing this is, e.g. PAYE";
    if (!draft.month) found.month = "Choose the payroll month";
    if (!draft.dueDate) found.dueDate = "Choose the due date";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      await createRecord.mutateAsync({
        clientId: draft.clientId,
        filingType: draft.filingType.trim(),
        period: `${draft.month}-01`,
        dueDate: draft.dueDate,
        notes: draft.notes.trim() || undefined,
      });
      toast.success("Filing added");
      onClose();
    } catch (err) {
      const message = errorMessage(err);
      setErrors({ form: message });
      toast.error(message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New filing</DialogTitle>
          <DialogDescription>A statutory payroll filing to track for a client.</DialogDescription>
        </DialogHeader>
        <RequiredNote />
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <FormField id="filing-client" label="Client" required error={errors.clientId}>
            <Select value={draft.clientId} onValueChange={(v) => update({ clientId: v })}>
              <SelectTrigger id="filing-client" aria-invalid={!!errors.clientId}>
                <SelectValue placeholder="Choose a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="filing-type" label="Filing" required error={errors.filingType}>
            <Input
              id="filing-type"
              value={draft.filingType}
              aria-invalid={!!errors.filingType}
              onChange={(e) => update({ filingType: e.target.value })}
              placeholder="PAYE, NSSF or SHIF"
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="filing-month" label="Payroll month" required error={errors.month}>
              <Input
                id="filing-month"
                type="month"
                value={draft.month}
                aria-invalid={!!errors.month}
                onChange={(e) => update({ month: e.target.value })}
              />
            </FormField>
            <FormField id="filing-due" label="Due date" required error={errors.dueDate}>
              <Input
                id="filing-due"
                type="date"
                value={draft.dueDate}
                aria-invalid={!!errors.dueDate}
                onChange={(e) => update({ dueDate: e.target.value })}
              />
            </FormField>
          </div>
          <FormField id="filing-notes" label="Notes">
            <Input
              id="filing-notes"
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </FormField>
          {errors.form && (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => guardClose(onClose)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRecord.isPending}>
              {createRecord.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add filing
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
