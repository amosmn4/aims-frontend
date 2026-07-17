import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useComplianceRecords,
  useCreateComplianceRecord,
  useMarkFiled,
  type ComplianceStatus,
  type ComplianceRecord,
} from "@/features/finance/use-payroll-compliance";
import { useClients } from "@/features/finance/use-finance-data";

export const Route = createFileRoute("/_authenticated/finance/payroll-compliance")({
  head: () => ({ meta: [{ title: "Payroll Compliance — AIMS Finance" }] }),
  component: PayrollCompliancePage,
});

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  pending: "Pending",
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

function PayrollCompliancePage() {
  const recordsQ = useComplianceRecords();
  const clientsQ = useClients();

  const summary = useMemo(() => {
    const records = recordsQ.data ?? [];
    return {
      compliant: records.filter((r) => r.effective_status === "filed_on_time").length,
      pending: records.filter((r) => r.effective_status === "pending").length,
      overdue: records.filter((r) => r.effective_status === "overdue").length,
      late: records.filter((r) => r.effective_status === "filed_late").length,
    };
  }, [recordsQ.data]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Filed on time" value={summary.compliant} tone="positive" />
        <SummaryCard label="Pending" value={summary.pending} />
        <SummaryCard label="Filed late" value={summary.late} tone="warning" />
        <SummaryCard label="Overdue" value={summary.overdue} tone="danger" />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Statutory filing compliance</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Financial/compliance oversight of client payroll filings — not the payroll engine
              itself.
            </p>
          </div>
          <NewComplianceDialog clients={clientsQ.data ?? []} onCreated={() => recordsQ.refetch()} />
        </div>

        {recordsQ.isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (recordsQ.data ?? []).length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No compliance records yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Filing</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recordsQ.data ?? []).map((r) => (
                <ComplianceRow key={r.id} record={r} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  const toneCls =
    tone === "positive"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}

function ComplianceRow({ record }: { record: ComplianceRecord }) {
  const markFiled = useMarkFiled();
  const [filedDate, setFiledDate] = useState(new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);

  const handleMarkFiled = async () => {
    try {
      await markFiled.mutateAsync({ id: record.id, filedDate });
      toast.success("Marked as filed");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{record.client_name}</TableCell>
      <TableCell>{record.filing_type}</TableCell>
      <TableCell className="text-xs">{record.period.slice(0, 7)}</TableCell>
      <TableCell className="text-xs">{record.due_date}</TableCell>
      <TableCell>
        <Badge className={STATUS_STYLES[record.effective_status]} variant="secondary">
          {STATUS_LABELS[record.effective_status]}
        </Badge>
      </TableCell>
      <TableCell>
        {!record.filed_date && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Mark filed
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Mark {record.filing_type} as filed</DialogTitle>
              </DialogHeader>
              <div>
                <Label className="text-xs">Filed date</Label>
                <Input
                  type="date"
                  value={filedDate}
                  onChange={(e) => setFiledDate(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button onClick={handleMarkFiled} disabled={markFiled.isPending}>
                  {markFiled.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </TableCell>
    </TableRow>
  );
}

function NewComplianceDialog({
  clients,
  onCreated,
}: {
  clients: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [filingType, setFilingType] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  );
  const createRecord = useCreateComplianceRecord();

  const handleSave = async () => {
    if (!clientId || !filingType) {
      toast.error("Client and filing type are required");
      return;
    }
    try {
      await createRecord.mutateAsync({ clientId, filingType, period, dueDate });
      toast.success("Compliance record created");
      setClientId("");
      setFilingType("");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> New record
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New compliance record</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Filing type</Label>
            <Input
              value={filingType}
              onChange={(e) => setFilingType(e.target.value)}
              placeholder="PAYE / NSSF / SHIF"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Period</Label>
              <Input type="date" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={createRecord.isPending}>
            {createRecord.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
