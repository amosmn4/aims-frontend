import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, MessageSquarePlus, History } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import {
  useInvoices,
  usePayments,
  useClients,
  useFollowUps,
  useCreateFollowUp,
  paymentsByInvoice,
  type FollowUpType,
} from "@/features/finance/use-finance-data";
import {
  computeAging,
  daysBetween,
  formatCurrency,
  invoiceOutstanding,
} from "@/features/finance/finance";

const FOLLOW_UP_LABELS: Record<FollowUpType, string> = {
  reminder_sent: "Reminder sent",
  promise_to_pay: "Promise to pay",
  escalated: "Escalated",
};

const FOLLOW_UP_STYLES: Record<FollowUpType, string> = {
  reminder_sent: "bg-primary/10 text-primary",
  promise_to_pay: "bg-warning/15 text-warning",
  escalated: "bg-destructive/15 text-destructive",
};

export const Route = createFileRoute("/_authenticated/finance/debtors")({
  head: () => ({ meta: [{ title: "Debtors — AIMS" }] }),
  component: DebtorsPage,
});

function DebtorsPage() {
  const invoicesQ = useInvoices();
  const paymentsQ = usePayments();
  const clientsQ = useClients();
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [bucketFilter, setBucketFilter] = useState<string>("all");

  const loading = invoicesQ.isLoading || paymentsQ.isLoading || clientsQ.isLoading;

  const clients = useMemo(() => clientsQ.data ?? [], [clientsQ.data]);
  const invoices = useMemo(() => invoicesQ.data ?? [], [invoicesQ.data]);
  const payments = useMemo(() => paymentsQ.data ?? [], [paymentsQ.data]);
  const paidMap = useMemo(() => paymentsByInvoice(payments), [payments]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const aging = useMemo(() => computeAging(invoices, paidMap), [invoices, paidMap]);
  const totalOutstanding = aging.reduce((s, b) => s + b.amount, 0);

  const openInvoices = useMemo(() => {
    const today = new Date();
    return invoices
      .filter((i) => i.status !== "paid" && i.status !== "void" && i.status !== "draft")
      .map((i) => {
        const paid = paidMap.get(i.id) ?? 0;
        const out = invoiceOutstanding(i, paid);
        const days = daysBetween(today, new Date(i.due_date));
        const bucket =
          days <= 0
            ? "Current"
            : days <= 30
              ? "1-30 days"
              : days <= 60
                ? "31-60 days"
                : days <= 90
                  ? "61-90 days"
                  : "90+ days";
        return { inv: i, paid, out, days, bucket };
      })
      .filter((r) => r.out > 0.01);
  }, [invoices, paidMap]);

  const filtered = openInvoices.filter((r) => {
    if (clientFilter !== "all" && r.inv.client_id !== clientFilter) return false;
    if (bucketFilter !== "all" && r.bucket !== bucketFilter) return false;
    return true;
  });

  // By-client rollup
  const byClient = useMemo(() => {
    const m = new Map<
      string,
      {
        name: string;
        current: number;
        d30: number;
        d60: number;
        d90: number;
        d90plus: number;
        total: number;
      }
    >();
    for (const r of openInvoices) {
      const c = clientMap.get(r.inv.client_id);
      const cur = m.get(r.inv.client_id) ?? {
        name: c?.name ?? "Unknown",
        current: 0,
        d30: 0,
        d60: 0,
        d90: 0,
        d90plus: 0,
        total: 0,
      };
      if (r.days <= 0) cur.current += r.out;
      else if (r.days <= 30) cur.d30 += r.out;
      else if (r.days <= 60) cur.d60 += r.out;
      else if (r.days <= 90) cur.d90 += r.out;
      else cur.d90plus += r.out;
      cur.total += r.out;
      m.set(r.inv.client_id, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [openInvoices, clientMap]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {aging.map((b) => {
          const pct = totalOutstanding > 0 ? (b.amount / totalOutstanding) * 100 : 0;
          const tone =
            b.label === "Current"
              ? "text-success"
              : b.label === "1-30 days"
                ? "text-primary"
                : b.label === "31-60 days"
                  ? "text-warning"
                  : "text-destructive";
          return (
            <div key={b.label} className="rounded-lg border bg-card p-4">
              <div className={`text-xs uppercase tracking-wider font-semibold ${tone}`}>
                {b.label}
              </div>
              <div className="mt-2 text-lg font-semibold tabular-nums">
                {formatCurrency(b.amount)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {b.count} inv · {pct.toFixed(0)}%
              </div>
            </div>
          );
        })}
        <div className="rounded-lg border bg-primary/5 border-primary/20 p-4">
          <div className="text-xs uppercase tracking-wider font-semibold text-primary">Total</div>
          <div className="mt-2 text-lg font-semibold tabular-nums">
            {formatCurrency(totalOutstanding)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {openInvoices.length} open invoices
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">Outstanding by client</h2>
        {byClient.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No outstanding debtors.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">1-30</TableHead>
                  <TableHead className="text-right">31-60</TableHead>
                  <TableHead className="text-right">61-90</TableHead>
                  <TableHead className="text-right">90+</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byClient.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.current)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.d30)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-warning">
                      {formatCurrency(r.d60)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {formatCurrency(r.d90)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive font-semibold">
                      {formatCurrency(r.d90plus)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatCurrency(r.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <h2 className="font-semibold mr-auto">Open invoices</h2>
          <div className="w-56">
            <Label className="text-xs">Client</Label>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Label className="text-xs">Bucket</Label>
            <Select value={bucketFilter} onValueChange={setBucketFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Current">Current</SelectItem>
                <SelectItem value="1-30 days">1-30 days</SelectItem>
                <SelectItem value="31-60 days">31-60 days</SelectItem>
                <SelectItem value="61-90 days">61-90 days</SelectItem>
                <SelectItem value="90+ days">90+ days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No open invoices.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Days overdue</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered
                .sort((a, b) => b.days - a.days)
                .map((r) => (
                  <TableRow key={r.inv.id}>
                    <TableCell className="font-mono text-xs">{r.inv.invoice_number}</TableCell>
                    <TableCell>{clientMap.get(r.inv.client_id)?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.inv.due_date}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.days > 0 ? r.days : 0}
                    </TableCell>
                    <TableCell>{r.bucket}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(r.out, r.inv.currency_code)}
                    </TableCell>
                    <TableCell>
                      <FollowUpDialog invoiceId={r.inv.id} invoiceNumber={r.inv.invoice_number} />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function FollowUpDialog({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: string;
  invoiceNumber: string;
}) {
  const [open, setOpen] = useState(false);
  const followUpsQ = useFollowUps(open ? invoiceId : undefined);
  const createFollowUp = useCreateFollowUp();

  const [type, setType] = useState<FollowUpType>("reminder_sent");
  const [channel, setChannel] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [notes, setNotes] = useState("");

  const handleLog = async () => {
    try {
      await createFollowUp.mutateAsync({
        invoiceId,
        type,
        channel: type === "reminder_sent" ? channel || undefined : undefined,
        promisedDate: type === "promise_to_pay" ? promisedDate || undefined : undefined,
        notes: notes || undefined,
      });
      toast.success("Follow-up logged");
      setChannel("");
      setPromisedDate("");
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log follow-up");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <MessageSquarePlus className="h-4 w-4 mr-1" /> Follow-up
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Collection follow-up · {invoiceNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FollowUpType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(FOLLOW_UP_LABELS) as [FollowUpType, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type === "reminder_sent" && (
            <div>
              <Label className="text-xs">Channel</Label>
              <Input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Email / Phone / In-person"
              />
            </div>
          )}
          {type === "promise_to_pay" && (
            <div>
              <Label className="text-xs">Promised date</Label>
              <Input
                type="date"
                value={promisedDate}
                onChange={(e) => setPromisedDate(e.target.value)}
              />
            </div>
          )}
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button
            size="sm"
            onClick={handleLog}
            disabled={createFollowUp.isPending}
            className="w-full"
          >
            {createFollowUp.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Log follow-up
          </Button>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-semibold flex items-center gap-1 mb-2">
            <History className="h-3.5 w-3.5" /> History
          </div>
          {followUpsQ.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : (followUpsQ.data ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">No follow-ups logged yet.</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(followUpsQ.data ?? []).map((f) => (
                <div key={f.id} className="text-xs flex items-start gap-2">
                  <Badge className={FOLLOW_UP_STYLES[f.type]} variant="secondary">
                    {FOLLOW_UP_LABELS[f.type]}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-muted-foreground">
                      {new Date(f.created_at).toLocaleString()}
                      {f.channel && <> · {f.channel}</>}
                      {f.promised_date && <> · Promised {f.promised_date}</>}
                    </div>
                    {f.notes && <div className="mt-0.5">{f.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
