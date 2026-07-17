import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Plus, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useInvoices,
  usePayments,
  useClients,
  useServiceLines,
  useCreateClient,
  useCreateInvoice,
  useRecordPayment,
  paymentsByInvoice,
} from "@/features/finance/use-finance-data";
import {
  formatCurrency,
  invoiceOutstanding,
  invoiceStatus,
  STATUS_STYLES,
} from "@/features/finance/finance";

export const Route = createFileRoute("/_authenticated/finance/invoices")({
  head: () => ({ meta: [{ title: "Invoicing & Billing — AIMS" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const invoicesQ = useInvoices();
  const paymentsQ = usePayments();
  const clientsQ = useClients();
  const serviceLinesQ = useServiceLines();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);

  const clients = useMemo(() => clientsQ.data ?? [], [clientsQ.data]);
  const serviceLines = useMemo(() => serviceLinesQ.data ?? [], [serviceLinesQ.data]);
  const invoices = useMemo(() => invoicesQ.data ?? [], [invoicesQ.data]);
  const payments = useMemo(() => paymentsQ.data ?? [], [paymentsQ.data]);
  const paidMap = useMemo(() => paymentsByInvoice(payments), [payments]);

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      const paid = paidMap.get(i.id) ?? 0;
      const s = invoiceStatus(i, paid);
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (clientFilter !== "all" && i.client_id !== clientFilter) return false;
      return true;
    });
  }, [invoices, paidMap, statusFilter, clientFilter]);

  const totals = useMemo(() => {
    let billed = 0;
    let paid = 0;
    let outstanding = 0;
    for (const i of filtered) {
      const p = paidMap.get(i.id) ?? 0;
      billed += Number(i.total);
      paid += p;
      outstanding += invoiceOutstanding(i, p);
    }
    return { billed, paid, outstanding };
  }, [filtered, paidMap]);

  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const slMap = new Map(serviceLines.map((s) => [s.id, s]));

  const loading = invoicesQ.isLoading || paymentsQ.isLoading || clientsQ.isLoading;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <SummaryCard label="Billed" value={formatCurrency(totals.billed)} />
        <SummaryCard label="Collected" value={formatCurrency(totals.paid)} tone="positive" />
        <SummaryCard
          label="Outstanding"
          value={formatCurrency(totals.outstanding)}
          tone="warning"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="w-44">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
        </div>
        <div className="flex gap-2">
          <NewClientDialog onCreated={() => clientsQ.refetch()} />
          <NewInvoiceDialog
            clients={clients}
            serviceLines={serviceLines}
            onCreated={() => invoicesQ.refetch()}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No invoices match these filters.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Service line</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => {
                const paid = paidMap.get(inv.id) ?? 0;
                const s = invoiceStatus(inv, paid);
                const client = clientMap.get(inv.client_id);
                const sl = inv.service_line_id ? slMap.get(inv.service_line_id) : null;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell>{client?.name ?? "—"}</TableCell>
                    <TableCell>
                      {sl?.name ?? "—"}
                      {inv.is_recurring && (
                        <span className="ml-2 text-[0.625rem] uppercase text-primary">Recurring</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{inv.issue_date}</TableCell>
                    <TableCell className="text-xs">{inv.due_date}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(inv.total, inv.currency_code)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(paid, inv.currency_code)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(invoiceOutstanding(inv, paid), inv.currency_code)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[0.625rem] uppercase font-semibold ${STATUS_STYLES[s] ?? ""}`}
                      >
                        {s}
                      </span>
                    </TableCell>
                    <TableCell>
                      {s !== "paid" && s !== "void" && (
                        <Button size="sm" variant="ghost" onClick={() => setPayingInvoice(inv.id)}>
                          <DollarSign className="h-4 w-4 mr-1" /> Pay
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <RecordPaymentDialog
        invoiceId={payingInvoice}
        invoice={invoices.find((i) => i.id === payingInvoice) ?? null}
        alreadyPaid={payingInvoice ? (paidMap.get(payingInvoice) ?? 0) : 0}
        onClose={() => setPayingInvoice(null)}
        onSaved={() => {
          setPayingInvoice(null);
          paymentsQ.refetch();
        }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "warning";
}) {
  const toneCls =
    tone === "positive" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}

function NewClientDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [country, setCountry] = useState("Kenya");
  const [currency, setCurrency] = useState("KES");
  const createClient = useCreateClient();

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      await createClient.mutateAsync({
        name: name.trim(),
        code: code.trim() || undefined,
        country,
        currencyCode: currency,
      });
      toast.success("Client created");
      setName("");
      setCode("");
      setCountry("Kenya");
      setCurrency("KES");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add client</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div>
              <Label>Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={createClient.isPending || !name.trim()}>
            {createClient.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewInvoiceDialog({
  clients,
  serviceLines,
  onCreated,
}: {
  clients: { id: string; name: string; currency_code: string }[];
  serviceLines: { id: string; name: string; is_recurring: boolean }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [serviceLineId, setServiceLineId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [subtotal, setSubtotal] = useState("");
  const [tax, setTax] = useState("0");
  const [directCost, setDirectCost] = useState("0");
  const [notes, setNotes] = useState("");
  const createInvoice = useCreateInvoice();

  const client = clients.find((c) => c.id === clientId);
  const sl = serviceLines.find((s) => s.id === serviceLineId);

  const handleSave = async () => {
    if (!invoiceNumber || !clientId || !subtotal) {
      toast.error("Invoice number, client and subtotal are required");
      return;
    }
    try {
      const sub = Number(subtotal);
      const t = Number(tax || 0);
      await createInvoice.mutateAsync({
        invoiceNumber: invoiceNumber.trim(),
        clientId,
        serviceLineId: serviceLineId || undefined,
        issueDate,
        dueDate,
        currencyCode: client?.currency_code ?? "KES",
        subtotal: sub,
        tax: t,
        directCost: Number(directCost || 0),
        isRecurring: sl?.is_recurring ?? false,
        notes: notes || undefined,
      });
      toast.success("Invoice created");
      setInvoiceNumber("");
      setClientId("");
      setServiceLineId("");
      setSubtotal("");
      setTax("0");
      setDirectCost("0");
      setNotes("");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" /> New invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Invoice #</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div>
              <Label>Client</Label>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Service line</Label>
              <Select value={serviceLineId} onValueChange={setServiceLineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service line" />
                </SelectTrigger>
                <SelectContent>
                  {serviceLines.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.is_recurring ? "· Recurring" : "· One-off"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Issue date</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Subtotal</Label>
              <Input
                type="number"
                step="0.01"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
              />
            </div>
            <div>
              <Label>Tax (VAT)</Label>
              <Input
                type="number"
                step="0.01"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
              />
            </div>
            <div>
              <Label>Direct cost</Label>
              <Input
                type="number"
                step="0.01"
                value={directCost}
                onChange={(e) => setDirectCost(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="text-sm text-muted-foreground">
            Total:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(
                Number(subtotal || 0) + Number(tax || 0),
                client?.currency_code ?? "KES",
              )}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={createInvoice.isPending}>
            {createInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({
  invoiceId,
  invoice,
  alreadyPaid,
  onClose,
  onSaved,
}: {
  invoiceId: string | null;
  invoice: { total: number; currency_code: string; invoice_number: string } | null;
  alreadyPaid: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("");
  const recordPayment = useRecordPayment();

  const outstanding = invoice ? Number(invoice.total) - alreadyPaid : 0;

  const handleSave = async () => {
    if (!invoiceId || !amount) return;
    try {
      await recordPayment.mutateAsync({
        invoiceId,
        amount: Number(amount),
        paidOn,
        method: method || undefined,
      });
      toast.success("Payment recorded");
      setAmount("");
      setMethod("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <Dialog open={!!invoiceId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        {invoice && (
          <div className="text-sm text-muted-foreground mb-2">
            Invoice <span className="font-mono">{invoice.invoice_number}</span> · outstanding{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(outstanding, invoice.currency_code)}
            </span>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Paid on</Label>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <div>
              <Label>Method</Label>
              <Input
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="Bank / M-Pesa / Cash"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={recordPayment.isPending || !amount}>
            {recordPayment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Record
            payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
