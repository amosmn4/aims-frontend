import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Loader2, MessageSquare, MessageSquarePlus, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format-date";
import {
  useInvoices,
  usePayments,
  useClients,
  paymentsByInvoice,
} from "@/features/finance/use-finance-data";
import {
  daysBetween,
  formatCurrency,
  invoiceOutstanding,
  type InvoiceRow,
} from "@/features/finance/finance";
import {
  MoneyTotal,
  totalsByCurrency,
  useCompanyCurrency,
  useFinanceAccess,
} from "@/features/finance/money";
import { InvoiceFollowUpsDialog } from "@/features/finance/invoice-follow-ups-dialog";

const BUCKETS = ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"] as const;
type Bucket = (typeof BUCKETS)[number];

const BUCKET_LABELS: Record<Bucket, string> = {
  Current: "Not yet due",
  "1-30 days": "1–30 days late",
  "31-60 days": "31–60 days late",
  "61-90 days": "61–90 days late",
  "90+ days": "Over 90 days late",
};

const BUCKET_TONE: Record<Bucket, string> = {
  Current: "text-success",
  "1-30 days": "text-primary",
  "31-60 days": "text-warning",
  "61-90 days": "text-destructive",
  "90+ days": "text-destructive",
};

export const Route = createFileRoute("/_authenticated/finance/debtors")({
  head: () => ({ meta: [{ title: "Debtors — AIMS" }] }),
  component: DebtorsPage,
});

type OpenRow = { inv: InvoiceRow; out: number; days: number; bucket: Bucket };

function bucketFor(days: number): Bucket {
  if (days <= 0) return "Current";
  if (days <= 30) return "1-30 days";
  if (days <= 60) return "31-60 days";
  if (days <= 90) return "61-90 days";
  return "90+ days";
}

function DebtorsPage() {
  const invoicesQ = useInvoices();
  const paymentsQ = usePayments();
  const clientsQ = useClients();
  const companyCurrency = useCompanyCurrency();
  const { canRaiseInvoices } = useFinanceAccess();
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  const [followUpRow, setFollowUpRow] = useState<OpenRow | null>(null);

  const loading = invoicesQ.isLoading || paymentsQ.isLoading || clientsQ.isLoading;
  const failed = [invoicesQ, paymentsQ, clientsQ].find((q) => q.isError);

  const clients = useMemo(() => clientsQ.data ?? [], [clientsQ.data]);
  const invoices = useMemo(() => invoicesQ.data ?? [], [invoicesQ.data]);
  const payments = useMemo(() => paymentsQ.data ?? [], [paymentsQ.data]);
  const paidMap = useMemo(() => paymentsByInvoice(payments), [payments]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const openInvoices = useMemo<OpenRow[]>(() => {
    const today = new Date();
    return invoices
      .filter((i) => i.status !== "paid" && i.status !== "void" && i.status !== "draft")
      .map((inv) => {
        const out = invoiceOutstanding(inv, paidMap.get(inv.id) ?? 0);
        const days = daysBetween(today, new Date(inv.due_date));
        return { inv, out, days, bucket: bucketFor(days) };
      })
      .filter((r) => r.out > 0.01);
  }, [invoices, paidMap]);

  const bucketTiles = BUCKETS.map((b) => {
    const rows = openInvoices.filter((r) => r.bucket === b);
    return {
      bucket: b,
      count: rows.length,
      totals: totalsByCurrency(
        rows,
        (r) => r.inv.currency_code,
        (r) => r.out,
      ),
    };
  });
  const grandTotals = totalsByCurrency(
    openInvoices,
    (r) => r.inv.currency_code,
    (r) => r.out,
  );

  // One row per client and currency, so amounts in different currencies stay apart.
  const byClient = useMemo(() => {
    const m = new Map<
      string,
      {
        key: string;
        name: string;
        currency: string;
        amounts: Record<Bucket, number>;
        total: number;
      }
    >();
    for (const r of openInvoices) {
      const key = `${r.inv.client_id}:${r.inv.currency_code}`;
      const cur = m.get(key) ?? {
        key,
        name: clientMap.get(r.inv.client_id)?.name ?? "Unknown client",
        currency: r.inv.currency_code,
        amounts: { Current: 0, "1-30 days": 0, "31-60 days": 0, "61-90 days": 0, "90+ days": 0 },
        total: 0,
      };
      cur.amounts[r.bucket] += r.out;
      cur.total += r.out;
      m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) =>
      a.currency === b.currency
        ? b.total - a.total
        : a.currency === companyCurrency
          ? -1
          : b.currency === companyCurrency
            ? 1
            : a.currency.localeCompare(b.currency),
    );
  }, [openInvoices, clientMap, companyCurrency]);

  const isFiltered = clientFilter !== "all" || bucketFilter !== "all";
  const clearFilters = () => {
    setClientFilter("all");
    setBucketFilter("all");
  };
  const filtered = openInvoices
    .filter((r) => clientFilter === "all" || r.inv.client_id === clientFilter)
    .filter((r) => bucketFilter === "all" || r.bucket === bucketFilter)
    .sort((a, b) => b.days - a.days);
  const debtorClients = clients.filter((c) => openInvoices.some((r) => r.inv.client_id === c.id));

  const header = (
    <PageHeader
      title="Debtors"
      description="Clients who still owe money on sent invoices, grouped by how late payment is. Log each chase so everyone sees the latest."
      actions={
        <Button variant="outline" asChild>
          <Link to="/finance/invoices" search={{ status: "overdue" }}>
            <FileText className="mr-1 h-4 w-4" /> See overdue invoices
          </Link>
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <div>
        {header}
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading debtors" />
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div>
        {header}
        <LoadError
          what="debtors"
          error={failed.error}
          onRetry={() => {
            void invoicesQ.refetch();
            void paymentsQ.refetch();
            void clientsQ.refetch();
          }}
        />
      </div>
    );
  }

  const followUpInvoice = followUpRow?.inv;

  return (
    <div className="space-y-6">
      {header}
      {!canRaiseInvoices && <ViewOnlyBanner area="Debtors" action="log follow-ups" />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {bucketTiles.map((t) => (
          <div key={t.bucket} className="rounded-lg border bg-card p-4">
            <div
              className={`text-xs font-semibold ${t.count ? BUCKET_TONE[t.bucket] : "text-muted-foreground"}`}
            >
              {BUCKET_LABELS[t.bucket]}
            </div>
            <MoneyTotal
              totals={t.totals}
              companyCurrency={companyCurrency}
              className="mt-2 text-lg font-semibold tabular-nums"
            />
            <div className="mt-0.5 text-xs text-muted-foreground">
              {t.count} invoice{t.count === 1 ? "" : "s"}
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="text-xs font-semibold text-primary">Total owed</div>
          <MoneyTotal
            totals={grandTotals}
            companyCurrency={companyCurrency}
            className="mt-2 text-lg font-semibold tabular-nums"
          />
          <div className="mt-0.5 text-xs text-muted-foreground">
            {openInvoices.length} unpaid invoice{openInvoices.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {openInvoices.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-12 text-sm text-muted-foreground">
          <span>
            {invoices.length === 0 ? "No invoices yet" : "Nobody owes you money right now"}
          </span>
          {invoices.length === 0 && canRaiseInvoices && (
            <Button size="sm" asChild>
              <Link to="/finance/invoices" search={{ new: 1 }}>
                <Plus className="mr-1 h-4 w-4" /> New invoice
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card p-4 sm:p-6">
            <h2 className="mb-4 font-semibold">Owed by client</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    {BUCKETS.map((b) => (
                      <TableHead key={b} className="whitespace-nowrap text-right">
                        {BUCKET_LABELS[b]}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byClient.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      {BUCKETS.map((b) => (
                        <TableCell
                          key={b}
                          className={`whitespace-nowrap text-right tabular-nums ${
                            r.amounts[b] > 0 && b !== "Current" && b !== "1-30 days"
                              ? BUCKET_TONE[b]
                              : ""
                          }`}
                        >
                          {r.amounts[b] > 0 ? formatCurrency(r.amounts[b], r.currency) : "—"}
                        </TableCell>
                      ))}
                      <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                        {formatCurrency(r.total, r.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <h2 className="mr-auto font-semibold">Unpaid invoices</h2>
              <div className="w-full sm:w-56">
                <Label htmlFor="debtor-client-filter" className="text-xs">
                  Client
                </Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger id="debtor-client-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clients</SelectItem>
                    {debtorClients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-48">
                <Label htmlFor="debtor-bucket-filter" className="text-xs">
                  How late
                </Label>
                <Select value={bucketFilter} onValueChange={setBucketFilter}>
                  <SelectTrigger id="debtor-bucket-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    {BUCKETS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {BUCKET_LABELS[b]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
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
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Days late</TableHead>
                      <TableHead className="text-right">Still owed</TableHead>
                      <TableHead className="text-right">Follow-ups</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.inv.id}>
                        <TableCell className="font-mono text-xs">{r.inv.invoice_number}</TableCell>
                        <TableCell>{clientMap.get(r.inv.client_id)?.name ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(r.inv.due_date)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.days > 0 ? r.days : "Not yet due"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                          {formatCurrency(r.out, r.inv.currency_code)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setFollowUpRow(r)}
                            aria-label={`${canRaiseInvoices ? "Log follow-up" : "View follow-ups"} on invoice ${r.inv.invoice_number}`}
                          >
                            {canRaiseInvoices ? (
                              <>
                                <MessageSquarePlus className="mr-1 h-4 w-4" /> Log follow-up
                              </>
                            ) : (
                              <>
                                <MessageSquare className="mr-1 h-4 w-4" /> View follow-ups
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}

      {followUpRow && followUpInvoice && (
        <InvoiceFollowUpsDialog
          key={followUpInvoice.id}
          invoiceId={followUpInvoice.id}
          invoiceNumber={followUpInvoice.invoice_number}
          summary={`${clientMap.get(followUpInvoice.client_id)?.name ?? "The client"} still owes ${formatCurrency(
            followUpRow.out,
            followUpInvoice.currency_code,
          )} · due ${formatDate(followUpInvoice.due_date)}`}
          canPost={canRaiseInvoices}
          onClose={() => setFollowUpRow(null)}
        />
      )}
    </div>
  );
}
