import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Ban, Banknote, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { confirmDialog } from "@/components/confirm-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { ActionHint } from "@/components/help-link";
import { LoadError } from "@/components/load-error";
import { RowActions } from "@/components/row-actions";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useInvoices,
  usePayments,
  useClients,
  useServiceLines,
  useCreateInvoice,
  useUpdateInvoice,
  useVoidInvoice,
  useDeleteInvoice,
  useRecordPayment,
  useDeletePayment,
  paymentsByInvoice,
  type Client,
  type ServiceLine,
} from "@/features/finance/use-finance-data";
import {
  CURRENCY_CODES,
  useClientPermissions,
  useContracts,
  type ContractRow,
} from "@/features/clients/use-clients-contracts";
import { MoneyTotal, totalsByCurrency, useCompanyCurrency } from "@/features/finance/money";
import { ClientFormDialog } from "@/features/clients/client-form-dialog";
import { usePermissions } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  formatCurrency,
  invoiceOutstanding,
  invoiceStatus,
  isVoidInvoice,
  STATUS_LABELS,
  STATUS_STYLES,
  type InvoiceRow,
  type PaymentRow,
} from "@/features/finance/finance";

const INVOICE_STATUSES = ["draft", "sent", "partial", "paid", "overdue", "void"] as const;

// Supports links like /finance/invoices?status=overdue&q=INV-1 and ?new=1.
const invoiceSearchSchema = z.object({
  q: z.preprocess((v) => (v == null || v === "" ? undefined : String(v)), z.string().optional()),
  status: z.enum(INVOICE_STATUSES).optional().catch(undefined),
  new: z.preprocess(
    (v) => (v === 1 || v === "1" || v === true ? 1 : undefined),
    z.literal(1).optional(),
  ),
});

export const Route = createFileRoute("/_authenticated/finance/invoices")({
  head: () => ({ meta: [{ title: "Invoices — AIMS" }] }),
  validateSearch: invoiceSearchSchema,
  component: InvoicesPage,
});

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysFromNowIso = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong. Please try again.";

function InvoicesPage() {
  const { canInvoice } = usePermissions();
  const invoicesQ = useInvoices();
  const paymentsQ = usePayments();
  const clientsQ = useClients();
  const serviceLinesQ = useServiceLines();
  const contractsQ = useContracts();
  const deleteInvoice = useDeleteInvoice();
  const urlSearch = Route.useSearch();
  const navigate = Route.useNavigate();
  const statusFilter: string = urlSearch.status ?? "all";
  const [query, setQuery] = useState(urlSearch.q ?? "");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [formTarget, setFormTarget] = useState<InvoiceRow | "new" | null>(null);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const writtenQuery = useRef(urlSearch.q ?? "");

  // Keep ?q= in step with the typed search so the page can be shared or refreshed.
  useEffect(() => {
    if (debouncedQuery === (urlSearch.q ?? "")) return;
    writtenQuery.current = debouncedQuery;
    navigate({
      search: (prev: z.infer<typeof invoiceSearchSchema>) => ({
        ...prev,
        q: debouncedQuery || undefined,
      }),
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [debouncedQuery]);

  // A link such as ?q=INV-1 fills the search box.
  useEffect(() => {
    if ((urlSearch.q ?? "") === writtenQuery.current) return;
    writtenQuery.current = urlSearch.q ?? "";
    setQuery(urlSearch.q ?? "");
  }, [urlSearch.q]);

  // ?new=1 opens the New invoice form once, then drops the flag.
  useEffect(() => {
    if (urlSearch.new !== 1) return;
    if (canInvoice) setFormTarget("new");
    navigate({
      search: (prev: z.infer<typeof invoiceSearchSchema>) => ({ ...prev, new: undefined }),
      replace: true,
    });
  }, [urlSearch.new, canInvoice, navigate]);

  const setStatusFilter = (value: string) =>
    navigate({
      search: (prev: z.infer<typeof invoiceSearchSchema>) => ({
        ...prev,
        status: value === "all" ? undefined : (value as (typeof INVOICE_STATUSES)[number]),
      }),
      replace: true,
    });

  const isFiltered = statusFilter !== "all" || clientFilter !== "all" || !!query.trim();
  const clearFilters = () => {
    setQuery("");
    setClientFilter("all");
    navigate({ search: {}, replace: true });
  };
  const [payingId, setPayingId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const clients = useMemo(() => clientsQ.data ?? [], [clientsQ.data]);
  const serviceLines = useMemo(() => serviceLinesQ.data ?? [], [serviceLinesQ.data]);
  const contracts = useMemo(() => contractsQ.data ?? [], [contractsQ.data]);
  const invoices = useMemo(() => invoicesQ.data ?? [], [invoicesQ.data]);
  const payments = useMemo(() => paymentsQ.data ?? [], [paymentsQ.data]);
  const paidMap = useMemo(() => paymentsByInvoice(payments), [payments]);
  const paymentsFor = useMemo(() => {
    const m = new Map<string, PaymentRow[]>();
    for (const p of payments) m.set(p.invoice_id, [...(m.get(p.invoice_id) ?? []), p]);
    return m;
  }, [payments]);

  const clientNames = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name.toLowerCase()])),
    [clients],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return invoices.filter((i) => {
      const paid = paidMap.get(i.id) ?? 0;
      const s = invoiceStatus(i, paid);
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (clientFilter !== "all" && i.client_id !== clientFilter) return false;
      if (
        needle &&
        !i.invoice_number.toLowerCase().includes(needle) &&
        !(clientNames.get(i.client_id) ?? "").includes(needle)
      )
        return false;
      return true;
    });
  }, [invoices, paidMap, statusFilter, clientFilter, query, clientNames]);

  // Void invoices never count; each currency gets its own total.
  const totals = useMemo(() => {
    const live = filtered.filter((i) => !isVoidInvoice(i));
    const cur = (i: InvoiceRow) => i.currency_code;
    const paidOf = (i: InvoiceRow) => paidMap.get(i.id) ?? 0;
    return {
      billed: totalsByCurrency(live, cur, (i) => Number(i.total)),
      paid: totalsByCurrency(live, cur, paidOf),
      outstanding: totalsByCurrency(live, cur, (i) => invoiceOutstanding(i, paidOf(i))),
    };
  }, [filtered, paidMap]);
  const companyCurrency = useCompanyCurrency();

  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const slMap = new Map(serviceLines.map((s) => [s.id, s]));
  const contractMap = new Map(contracts.map((c) => [c.id, c]));

  const loading = invoicesQ.isLoading || paymentsQ.isLoading || clientsQ.isLoading;
  const failed = [invoicesQ, paymentsQ, clientsQ].find((q) => q.isError);
  const payingInvoice = invoices.find((i) => i.id === payingId) ?? null;
  const voidingInvoice = invoices.find((i) => i.id === voidingId) ?? null;

  const handleDelete = async (inv: InvoiceRow) => {
    const ok = await confirmDialog({
      title: `Delete invoice ${inv.invoice_number}?`,
      description:
        "The invoice will be removed for good. If it was already sent to the client, void it instead so a record is kept.",
      confirmLabel: "Delete invoice",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteInvoice.mutateAsync(inv.id);
      toast.success(`Invoice ${inv.invoice_number} deleted`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Raise invoices to clients, record payments as money comes in, and void invoices raised in error."
        actions={
          <>
            <NewClientDialog onCreated={() => clientsQ.refetch()} />
            {canInvoice && (
              <Button onClick={() => setFormTarget("new")}>
                <Plus className="h-4 w-4 mr-1" /> New invoice
              </Button>
            )}
          </>
        }
      />
      {!canInvoice && <ViewOnlyBanner area="invoices" action="raise invoices or record payments" />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Billed"
          value={<MoneyTotal totals={totals.billed} companyCurrency={companyCurrency} />}
        />
        <SummaryCard
          label="Collected"
          value={<MoneyTotal totals={totals.paid} companyCurrency={companyCurrency} />}
          tone="positive"
        />
        <SummaryCard
          label="Still owed"
          value={<MoneyTotal totals={totals.outstanding} companyCurrency={companyCurrency} />}
          tone="warning"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex w-full flex-wrap gap-3">
          <div className="w-full sm:w-64">
            <Label htmlFor="invoice-search" className="text-xs">
              Search
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="invoice-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Invoice number or client"
                className="pl-8"
              />
            </div>
          </div>
          <div className="w-full sm:w-44">
            <Label htmlFor="invoice-status-filter" className="text-xs">
              Status
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="invoice-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {INVOICE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-56">
            <Label htmlFor="invoice-client-filter" className="text-xs">
              Client
            </Label>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger id="invoice-client-filter">
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
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading invoices" />
          </div>
        ) : failed ? (
          <LoadError
            what="invoices"
            error={failed.error}
            className="m-3"
            onRetry={() => {
              void invoicesQ.refetch();
              void paymentsQ.refetch();
              void clientsQ.refetch();
            }}
          />
        ) : invoices.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <span>No invoices yet</span>
            {canInvoice && (
              <Button size="sm" onClick={() => setFormTarget("new")}>
                <Plus className="h-4 w-4 mr-1" /> New invoice
              </Button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <span>No matches</span>
            {isFiltered && (
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                  <TableHead className="text-right">Still owed</TableHead>
                  <TableHead>Status</TableHead>
                  {canInvoice && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => {
                  const paid = paidMap.get(inv.id) ?? 0;
                  const s = invoiceStatus(inv, paid);
                  const voided = isVoidInvoice(inv);
                  const hasPayments = (paymentsFor.get(inv.id)?.length ?? 0) > 0;
                  const outstanding = invoiceOutstanding(inv, paid);
                  const client = clientMap.get(inv.client_id);
                  const sl = inv.service_line_id ? slMap.get(inv.service_line_id) : null;
                  const contract = inv.contract_id ? contractMap.get(inv.contract_id) : null;
                  const label = `invoice ${inv.invoice_number}`;
                  const payLabel =
                    outstanding > 0.01 ? `Record payment on ${label}` : `View payments on ${label}`;
                  return (
                    <TableRow key={inv.id} className={voided ? "text-muted-foreground" : undefined}>
                      <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                      <TableCell>
                        <div>{client?.name ?? "—"}</div>
                        {contract && (
                          <div className="text-xs text-muted-foreground">
                            Contract {contract.contract_number ?? contract.title}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {sl?.name ?? "—"}
                        {inv.is_recurring && (
                          <span className="ml-2 text-xs text-primary">Recurring</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDate(inv.issue_date)}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDate(inv.due_date)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${voided ? "line-through" : ""}`}
                      >
                        {formatCurrency(inv.total, inv.currency_code)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(paid, inv.currency_code)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {voided ? "—" : formatCurrency(outstanding, inv.currency_code)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[s] ?? ""}`}
                        >
                          {STATUS_LABELS[s] ?? s}
                        </span>
                        {voided && inv.void_reason && (
                          <div
                            className="mt-1 text-xs text-muted-foreground max-w-56 truncate"
                            title={inv.void_reason}
                          >
                            Reason: {inv.void_reason}
                          </div>
                        )}
                      </TableCell>
                      {canInvoice && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {!voided && (
                              <RowActions label={label} onEdit={() => setFormTarget(inv)} />
                            )}
                            {!voided && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setPayingId(inv.id)}
                                title={payLabel}
                                aria-label={payLabel}
                              >
                                <Banknote className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {!voided && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setVoidingId(inv.id)}
                                title={`Void ${label}`}
                                aria-label={`Void ${label}`}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {!hasPayments && (
                              <RowActions
                                label={label}
                                onDelete={() => handleDelete(inv)}
                                disabled={deleteInvoice.isPending}
                              />
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {formTarget && (
        <InvoiceFormDialog
          key={formTarget === "new" ? "new" : formTarget.id}
          invoice={formTarget === "new" ? null : formTarget}
          invoices={invoices}
          paidTotal={formTarget === "new" ? 0 : (paidMap.get(formTarget.id) ?? 0)}
          clients={clients}
          serviceLines={serviceLines}
          contracts={contracts}
          onClose={() => setFormTarget(null)}
        />
      )}

      {payingInvoice && (
        <RecordPaymentDialog
          key={payingInvoice.id}
          invoice={payingInvoice}
          payments={paymentsFor.get(payingInvoice.id) ?? []}
          onClose={() => setPayingId(null)}
        />
      )}

      {voidingInvoice && (
        <VoidInvoiceDialog
          key={voidingInvoice.id}
          invoice={voidingInvoice}
          hasPayments={(paymentsFor.get(voidingInvoice.id)?.length ?? 0) > 0}
          onClose={() => setVoidingId(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "positive" | "warning";
}) {
  const toneCls =
    tone === "positive" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-xs text-muted-foreground font-semibold">{label}</div>
      <div className={`mt-2 text-xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}

function NewClientDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const { canCreateClient } = useClientPermissions();
  if (!canCreateClient) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> New client
      </Button>
      <ClientFormDialog open={open} onOpenChange={setOpen} onSaved={() => onCreated()} />
    </>
  );
}

/* ---------- New / edit invoice ---------- */

type InvoiceDraft = {
  invoiceNumber: string;
  clientId: string;
  contractId: string;
  serviceLineId: string;
  issueDate: string;
  dueDate: string;
  /** Empty means "use the client's currency, else the company's". */
  currencyCode: string;
  subtotal: string;
  tax: string;
  directCost: string;
  status: "draft" | "sent";
  notes: string;
};

type DraftErrors = Partial<Record<keyof InvoiceDraft | "form", string>>;

function draftFromInvoice(inv: InvoiceRow | null): InvoiceDraft {
  if (!inv) {
    return {
      invoiceNumber: "",
      clientId: "",
      contractId: "",
      serviceLineId: "",
      issueDate: todayIso(),
      dueDate: daysFromNowIso(30),
      currencyCode: "",
      subtotal: "",
      tax: "0",
      directCost: "0",
      status: "sent",
      notes: "",
    };
  }
  return {
    invoiceNumber: inv.invoice_number,
    clientId: inv.client_id,
    contractId: inv.contract_id ?? "",
    serviceLineId: inv.service_line_id ?? "",
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    currencyCode: inv.currency_code,
    subtotal: String(inv.subtotal),
    tax: String(inv.tax),
    directCost: String(inv.direct_cost),
    status: inv.status === "draft" ? "draft" : "sent",
    notes: inv.notes ?? "",
  };
}

// Empty counts as zero for optional money fields; returns null when not a valid amount.
function parseMoney(value: string, required: boolean): number | null {
  if (!value.trim()) return required ? null : 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Maps known backend messages to the field they belong to.
function fieldForServerError(message: string): keyof DraftErrors {
  const m = message.toLowerCase();
  if (m.includes("contract")) return "contractId";
  if (m.includes("client")) return "clientId";
  if (m.includes("payments") || m.includes("total")) return "subtotal";
  return "form";
}

function InvoiceFormDialog({
  invoice,
  invoices,
  paidTotal,
  clients,
  serviceLines,
  contracts,
  onClose,
}: {
  invoice: InvoiceRow | null;
  invoices: InvoiceRow[];
  paidTotal: number;
  clients: Client[];
  serviceLines: ServiceLine[];
  contracts: ContractRow[];
  onClose: () => void;
}) {
  const [initial] = useState<InvoiceDraft>(() => draftFromInvoice(invoice));
  const [draft, setDraft] = useState<InvoiceDraft>(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const saving = createInvoice.isPending || updateInvoice.isPending;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const { guardClose } = useUnsavedChanges(dirty);
  const companyCurrency = useCompanyCurrency();

  const client = clients.find((c) => c.id === draft.clientId);
  const sl = serviceLines.find((s) => s.id === draft.serviceLineId);
  const currency = draft.currencyCode || client?.currency_code || companyCurrency;
  const currencyOptions = CURRENCY_CODES.includes(currency as (typeof CURRENCY_CODES)[number])
    ? [...CURRENCY_CODES]
    : [currency, ...CURRENCY_CODES];
  const currencyHint =
    client && client.currency_code !== currency
      ? `${client.name} is usually billed in ${client.currency_code}`
      : !draft.currencyCode
        ? client
          ? `${client.name}'s currency`
          : "Company default until you choose a client"
        : undefined;
  const clientContracts = draft.clientId
    ? contracts.filter((c) => c.client_id === draft.clientId)
    : contracts;
  const lineOptions = serviceLines.filter((s) => s.is_active || s.id === draft.serviceLineId);
  const total = (parseMoney(draft.subtotal, false) ?? 0) + (parseMoney(draft.tax, false) ?? 0);

  const update = (patch: Partial<InvoiceDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e, form: undefined };
      for (const k of Object.keys(patch)) delete next[k as keyof InvoiceDraft];
      return next;
    });
  };

  const chooseClient = (clientId: string) => {
    const contract = contracts.find((c) => c.id === draft.contractId);
    update({
      clientId,
      ...(contract && contract.client_id !== clientId ? { contractId: "" } : {}),
    });
  };

  const chooseContract = (contractId: string) => {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) {
      update({ contractId: "" });
      return;
    }
    update({
      contractId,
      clientId: contract.client_id,
      serviceLineId: contract.service_line_id ?? draft.serviceLineId,
    });
  };

  const validate = (): DraftErrors => {
    const e: DraftErrors = {};
    const number = draft.invoiceNumber.trim();
    if (!number) e.invoiceNumber = "Enter the invoice number";
    else if (
      invoices.some(
        (i) => i.id !== invoice?.id && i.invoice_number.toLowerCase() === number.toLowerCase(),
      )
    )
      e.invoiceNumber = "Another invoice already uses this number";
    if (!draft.clientId && !draft.contractId) e.clientId = "Choose a client, or pick a contract";
    if (!draft.issueDate) e.issueDate = "Choose the issue date";
    if (!draft.dueDate) e.dueDate = "Choose the due date";
    else if (draft.issueDate && draft.dueDate < draft.issueDate)
      e.dueDate = "The due date can't be before the issue date";
    const subtotal = parseMoney(draft.subtotal, true);
    if (subtotal === null) e.subtotal = "Enter the amount before VAT (0 or more)";
    if (parseMoney(draft.tax, false) === null) e.tax = "Enter the VAT amount (0 or more)";
    if (parseMoney(draft.directCost, false) === null)
      e.directCost = "Enter the direct cost (0 or more)";
    if (!e.subtotal && !e.tax && total + 0.01 < paidTotal)
      e.subtotal = `Payments of ${formatCurrency(paidTotal, currency)} are already recorded, so the total can't be lower`;
    return e;
  };

  const handleSave = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const editing = !!invoice;
    const input = {
      invoiceNumber: draft.invoiceNumber.trim(),
      clientId: draft.clientId || undefined,
      contractId: draft.contractId || (editing ? null : undefined),
      serviceLineId: draft.serviceLineId || (editing ? null : undefined),
      issueDate: draft.issueDate,
      dueDate: draft.dueDate,
      currencyCode: currency,
      subtotal: parseMoney(draft.subtotal, true) ?? 0,
      tax: parseMoney(draft.tax, false) ?? 0,
      directCost: parseMoney(draft.directCost, false) ?? 0,
      status: draft.status,
      isRecurring: sl ? sl.is_recurring : invoice?.is_recurring,
      notes: draft.notes.trim() || (editing ? "" : undefined),
    };
    try {
      if (invoice) {
        await updateInvoice.mutateAsync({ id: invoice.id, ...input });
        toast.success(`Invoice ${input.invoiceNumber} updated`);
      } else {
        await createInvoice.mutateAsync(input);
        toast.success(`Invoice ${input.invoiceNumber} created`);
      }
      onClose();
    } catch (err) {
      const message = errorMessage(err);
      setErrors({ [fieldForServerError(message)]: message });
      toast.error(message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {invoice ? `Edit invoice ${invoice.invoice_number}` : "New invoice"}
          </DialogTitle>
          <DialogDescription>
            Pick a contract to fill in the client and service line.
          </DialogDescription>
        </DialogHeader>
        <RequiredNote />
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField id="inv-number" label="Invoice number" required error={errors.invoiceNumber}>
              <Input
                id="inv-number"
                value={draft.invoiceNumber}
                aria-invalid={!!errors.invoiceNumber}
                onChange={(e) => update({ invoiceNumber: e.target.value })}
                placeholder="e.g. INV-2026-001"
              />
            </FormField>
            <FormField
              id="inv-client"
              label="Client"
              required={!draft.contractId}
              error={errors.clientId}
            >
              <Select value={draft.clientId} onValueChange={chooseClient}>
                <SelectTrigger id="inv-client" aria-invalid={!!errors.clientId}>
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
          </div>

          <ActionHint topic="budgets">
            Link the contract so this invoice counts towards the contract and budgets.
          </ActionHint>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              id="inv-contract"
              label="Contract"
              error={errors.contractId}
              hint={
                draft.clientId && clientContracts.length === 0
                  ? "This client has no contracts"
                  : "Fills in the client and service line"
              }
            >
              <Select value={draft.contractId || "none"} onValueChange={(v) => chooseContract(v)}>
                <SelectTrigger id="inv-contract" aria-invalid={!!errors.contractId}>
                  <SelectValue placeholder="No contract" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No contract</SelectItem>
                  {clientContracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contract_number ? `${c.contract_number} — ${c.title}` : c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="inv-service-line" label="Service line" error={errors.serviceLineId}>
              <Select
                value={draft.serviceLineId || "none"}
                onValueChange={(v) => update({ serviceLineId: v === "none" ? "" : v })}
              >
                <SelectTrigger id="inv-service-line">
                  <SelectValue placeholder="No service line" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No service line</SelectItem>
                  {lineOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.is_recurring ? "· Recurring" : "· One-off"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField id="inv-issue-date" label="Issue date" required error={errors.issueDate}>
              <Input
                id="inv-issue-date"
                type="date"
                value={draft.issueDate}
                aria-invalid={!!errors.issueDate}
                onChange={(e) => update({ issueDate: e.target.value })}
              />
            </FormField>
            <FormField id="inv-due-date" label="Due date" required error={errors.dueDate}>
              <Input
                id="inv-due-date"
                type="date"
                value={draft.dueDate}
                min={draft.issueDate || undefined}
                aria-invalid={!!errors.dueDate}
                onChange={(e) => update({ dueDate: e.target.value })}
              />
            </FormField>
            <FormField id="inv-currency" label="Currency" required hint={currencyHint}>
              <Select value={currency} onValueChange={(v) => update({ currencyCode: v })}>
                <SelectTrigger id="inv-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField
              id="inv-subtotal"
              label={`Amount before VAT (${currency})`}
              required
              error={errors.subtotal}
            >
              <Input
                id="inv-subtotal"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.subtotal}
                aria-invalid={!!errors.subtotal}
                onChange={(e) => update({ subtotal: e.target.value })}
              />
            </FormField>
            <FormField id="inv-tax" label="VAT" error={errors.tax}>
              <Input
                id="inv-tax"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.tax}
                aria-invalid={!!errors.tax}
                onChange={(e) => update({ tax: e.target.value })}
              />
            </FormField>
            <FormField
              id="inv-direct-cost"
              label="Direct cost"
              error={errors.directCost}
              hint="What delivering this work cost you"
            >
              <Input
                id="inv-direct-cost"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.directCost}
                aria-invalid={!!errors.directCost}
                onChange={(e) => update({ directCost: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              id="inv-status"
              label="Status"
              hint={
                paidTotal > 0
                  ? "Payments are recorded, so the status updates automatically"
                  : "Draft invoices are not counted as revenue yet"
              }
            >
              <Select
                value={draft.status}
                onValueChange={(v) => update({ status: v as "draft" | "sent" })}
                disabled={paidTotal > 0}
              >
                <SelectTrigger id="inv-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <div className="rounded-md bg-secondary/50 px-3 py-2 self-start">
              <div className="text-xs text-muted-foreground">Total (amount + VAT)</div>
              <div className="text-lg font-semibold tabular-nums">
                {formatCurrency(total, currency)}
              </div>
            </div>
          </div>

          <FormField id="inv-notes" label="Notes">
            <Textarea
              id="inv-notes"
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
              rows={2}
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {invoice ? "Save invoice" : "Create invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Payments ---------- */

function RecordPaymentDialog({
  invoice,
  payments,
  onClose,
}: {
  invoice: InvoiceRow;
  payments: PaymentRow[];
  onClose: () => void;
}) {
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = invoiceOutstanding(invoice, paid);
  const currency = invoice.currency_code;
  const fullyPaid = outstanding <= 0.01;
  const [initialAmount] = useState(() =>
    fullyPaid ? "" : String(Math.round(outstanding * 100) / 100),
  );
  const [amount, setAmount] = useState(initialAmount);
  const [paidOn, setPaidOn] = useState(todayIso());
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; paidOn?: string; form?: string }>({});
  const recordPayment = useRecordPayment();
  const deletePayment = useDeletePayment();
  const dirty =
    amount !== initialAmount || paidOn !== todayIso() || !!method.trim() || !!reference.trim();
  const { guardClose } = useUnsavedChanges(dirty);

  const handleSave = async () => {
    const found: typeof errors = {};
    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value <= 0)
      found.amount = "Enter the amount received";
    else if (value > outstanding + 0.01)
      found.amount = `Only ${formatCurrency(outstanding, currency)} is still owed on this invoice`;
    if (!paidOn) found.paidOn = "Choose the date the money was received";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      await recordPayment.mutateAsync({
        invoiceId: invoice.id,
        amount: value,
        paidOn,
        method: method.trim() || undefined,
        reference: reference.trim() || undefined,
      });
      toast.success(`Payment of ${formatCurrency(value, currency)} recorded`);
      onClose();
    } catch (err) {
      const message = errorMessage(err);
      setErrors({ [message.toLowerCase().includes("owed") ? "amount" : "form"]: message });
      toast.error(message);
    }
  };

  const removePayment = async (p: PaymentRow) => {
    const ok = await confirmDialog({
      title: "Remove this payment?",
      description: `${formatCurrency(p.amount, currency)} received on ${formatDate(p.paid_on)} will be removed and the invoice balance worked out again.`,
      confirmLabel: "Remove payment",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePayment.mutateAsync(p.id);
      toast.success("Payment removed");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Invoice <span className="font-mono">{invoice.invoice_number}</span> · total{" "}
            {formatCurrency(invoice.total, currency)} · still owed{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(outstanding, currency)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div>
          <div className="text-sm font-medium mb-2">Payments so far</div>
          {payments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium tabular-nums">
                      {formatCurrency(p.amount, currency)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {formatDate(p.paid_on)}
                      {p.method ? ` · ${p.method}` : ""}
                      {p.reference ? ` · Ref ${p.reference}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    disabled={deletePayment.isPending}
                    onClick={() => removePayment(p)}
                    aria-label={`Remove payment of ${formatCurrency(p.amount, currency)} received ${formatDate(p.paid_on)}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove payment
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {fullyPaid ? (
          <>
            <p className="text-sm text-success">This invoice is fully paid.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="space-y-4 border-t pt-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <RequiredNote />
            <FormField
              id="pay-amount"
              label={`Amount received (${currency})`}
              required
              error={errors.amount}
            >
              <Input
                id="pay-amount"
                type="number"
                min="0"
                max={outstanding}
                step="0.01"
                inputMode="decimal"
                value={amount}
                aria-invalid={!!errors.amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors((x) => ({ ...x, amount: undefined, form: undefined }));
                }}
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField id="pay-date" label="Paid on" required error={errors.paidOn}>
                <Input
                  id="pay-date"
                  type="date"
                  value={paidOn}
                  aria-invalid={!!errors.paidOn}
                  onChange={(e) => {
                    setPaidOn(e.target.value);
                    setErrors((x) => ({ ...x, paidOn: undefined }));
                  }}
                />
              </FormField>
              <FormField id="pay-method" label="Method">
                <Input
                  id="pay-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  placeholder="Bank / M-Pesa / Cash"
                />
              </FormField>
            </div>
            <FormField id="pay-reference" label="Reference">
              <Input
                id="pay-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. M-Pesa code or bank reference"
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
              <Button type="submit" disabled={recordPayment.isPending}>
                {recordPayment.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Banknote className="h-4 w-4 mr-2" />
                )}
                Record payment
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Void ---------- */

function VoidInvoiceDialog({
  invoice,
  hasPayments,
  onClose,
}: {
  invoice: InvoiceRow;
  hasPayments: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const voidInvoice = useVoidInvoice();
  const { guardClose } = useUnsavedChanges(!!reason.trim());

  const handleVoid = async () => {
    if (reason.trim().length < 3) {
      setError("Say why the invoice is being voided (at least 3 characters)");
      return;
    }
    try {
      await voidInvoice.mutateAsync({ id: invoice.id, reason: reason.trim() });
      toast.success(`Invoice ${invoice.invoice_number} voided`);
      onClose();
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void invoice {invoice.invoice_number}?</DialogTitle>
          <DialogDescription>
            The invoice stays on record but no longer counts toward billed, collected or outstanding
            totals. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        {hasPayments ? (
          <>
            <p role="alert" className="text-sm text-destructive">
              This invoice has payments recorded. Remove the payments before voiding it.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void handleVoid();
            }}
          >
            <FormField id="void-reason" label="Reason for voiding" required error={error}>
              <Textarea
                id="void-reason"
                value={reason}
                rows={3}
                autoFocus
                aria-invalid={!!error}
                placeholder="e.g. Raised in error, replaced by INV-2026-014"
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(undefined);
                }}
              />
            </FormField>
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => guardClose(onClose)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={voidInvoice.isPending}>
                {voidInvoice.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4 mr-2" />
                )}
                Void invoice
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
