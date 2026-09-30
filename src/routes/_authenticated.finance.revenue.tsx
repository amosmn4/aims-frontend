import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FileText, Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInvoices, useServiceLines } from "@/features/finance/use-finance-data";
import { formatCurrency, invoiceRevenue, isBilledInvoice } from "@/features/finance/finance";
import {
  CurrencyNote,
  splitByCurrency,
  useCompanyCurrency,
  useFinanceAccess,
} from "@/features/finance/money";
import { StatTile } from "@/features/finance/stat-tile";

export const Route = createFileRoute("/_authenticated/finance/revenue")({
  head: () => ({ meta: [{ title: "Revenue and margin — AIMS" }] }),
  component: RevenuePage,
});

function RevenuePage() {
  const invoicesQ = useInvoices();
  const slQ = useServiceLines();
  const companyCurrency = useCompanyCurrency();
  const { canRaiseInvoices } = useFinanceAccess();

  const loading = invoicesQ.isLoading || slQ.isLoading;
  const failed = [invoicesQ, slQ].find((q) => q.isError);
  const serviceLines = useMemo(() => slQ.data ?? [], [slQ.data]);
  const slMap = useMemo(() => new Map(serviceLines.map((s) => [s.id, s])), [serviceLines]);

  // Only sent invoices in the company currency are added up here.
  const split = useMemo(
    () =>
      splitByCurrency(
        (invoicesQ.data ?? []).filter(isBilledInvoice),
        (i) => i.currency_code,
        companyCurrency,
      ),
    [invoicesQ.data, companyCurrency],
  );
  const invoices = split.inCompany;
  const money = (v: number) => formatCurrency(v, companyCurrency);

  const rows = useMemo(() => {
    const map = new Map<
      string,
      { name: string; recurring: boolean; count: number; revenue: number; cost: number }
    >();
    for (const inv of invoices) {
      const key = inv.service_line_id ?? "__none__";
      const sl = inv.service_line_id ? slMap.get(inv.service_line_id) : null;
      const cur = map.get(key) ?? {
        name: sl?.name ?? "No service line",
        recurring: sl?.is_recurring ?? false,
        count: 0,
        revenue: 0,
        cost: 0,
      };
      cur.count += 1;
      cur.revenue += invoiceRevenue(inv);
      cur.cost += Number(inv.direct_cost);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [invoices, slMap]);

  const totals = rows.reduce(
    (acc, r) => {
      acc.revenue += r.revenue;
      acc.cost += r.cost;
      acc.recurring += r.recurring ? r.revenue : 0;
      acc.oneOff += !r.recurring ? r.revenue : 0;
      return acc;
    },
    { revenue: 0, cost: 0, recurring: 0, oneOff: 0 },
  );
  const grossProfit = totals.revenue - totals.cost;
  const grossMargin = totals.revenue > 0 ? (grossProfit / totals.revenue) * 100 : null;

  const monthly = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; recurring: number; oneOff: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        recurring: 0,
        oneOff: 0,
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    for (const inv of invoices) {
      const d = new Date(inv.issue_date);
      const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (i === undefined) continue;
      if (inv.is_recurring) buckets[i].recurring += invoiceRevenue(inv);
      else buckets[i].oneOff += invoiceRevenue(inv);
    }
    return buckets;
  }, [invoices]);
  const monthMax = Math.max(1, ...monthly.map((m) => m.recurring + m.oneOff));

  const empty = invoices.length === 0;
  const emptyText = split.otherCount > 0 ? `No ${companyCurrency} invoices yet` : "No invoices yet";

  const header = (
    <PageHeader
      title="Revenue and margin"
      description="What sent invoices earned by service line (before VAT), and the margin left after direct costs."
      actions={
        <Button variant="outline" asChild>
          <Link to="/finance/invoices">
            <FileText className="mr-1 h-4 w-4" /> Open invoices
          </Link>
        </Button>
      }
    />
  );

  if (loading || failed) {
    return (
      <div>
        {header}
        {failed ? (
          <LoadError
            what="revenue figures"
            error={failed.error}
            onRetry={() => {
              void invoicesQ.refetch();
              void slQ.refetch();
            }}
          />
        ) : (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading revenue" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <CurrencyNote
        companyCurrency={companyCurrency}
        otherCount={split.otherCount}
        otherCodes={split.otherCodes}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Revenue to date"
          value={money(totals.revenue)}
          hint="Sent invoices, before VAT"
          emptyText={empty ? emptyText : undefined}
        />
        <StatTile
          label="Recurring revenue"
          value={money(totals.recurring)}
          hint="From service lines that bill regularly"
          emptyText={empty ? emptyText : undefined}
        />
        <StatTile
          label="One-off revenue"
          value={money(totals.oneOff)}
          hint="From one-off service lines"
          emptyText={empty ? emptyText : undefined}
        />
        <StatTile
          label="Gross margin"
          value={grossMargin === null ? "—" : `${grossMargin.toFixed(1)}%`}
          hint="Share of revenue left after direct costs"
          tone={grossMargin !== null && grossMargin < 0 ? "danger" : "default"}
          emptyText={empty || grossMargin === null ? emptyText : undefined}
        />
      </div>

      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <h2 className="mb-1 font-semibold">Recurring and one-off revenue, last 6 months</h2>
        <p className="mb-4 text-xs text-muted-foreground">By invoice issue date</p>
        <div className="flex h-56 items-end gap-2 sm:gap-3">
          {monthly.map((m) => {
            const total = m.recurring + m.oneOff;
            const totalPct = (total / monthMax) * 100;
            const recPct = total > 0 ? (m.recurring / total) * 100 : 0;
            return (
              <div key={m.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 flex-col justify-end">
                  <div
                    className="flex w-full flex-col-reverse overflow-hidden rounded-md bg-secondary"
                    style={{ height: `${totalPct}%` }}
                  >
                    <div className="bg-primary" style={{ height: `${recPct}%` }} />
                    <div className="flex-1 bg-accent" />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="hidden text-xs tabular-nums sm:block">{money(total)}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-primary" /> Recurring
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-accent" /> One-off
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <h2 className="mb-1 font-semibold">Margin by service line</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Margin = revenue before VAT minus direct cost, as a share of revenue.
        </p>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
            <span>{emptyText}</span>
            {canRaiseInvoices && (
              <Button size="sm" asChild>
                <Link to="/finance/invoices" search={{ new: 1 }}>
                  <Plus className="mr-1 h-4 w-4" /> New invoice
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service line</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Direct cost</TableHead>
                  <TableHead className="text-right">Gross profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const gp = r.revenue - r.cost;
                  const m = r.revenue > 0 ? (gp / r.revenue) * 100 : null;
                  return (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.recurring ? "Recurring" : "One-off"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {money(r.revenue)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {money(r.cost)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {money(gp)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${
                          m === null
                            ? "text-muted-foreground"
                            : m < 20
                              ? "text-destructive"
                              : m < 40
                                ? "text-warning"
                                : "text-success"
                        }`}
                      >
                        {m === null ? "—" : `${m.toFixed(1)}%`}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">
                    {rows.reduce((s, r) => s + r.count, 0)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {money(totals.revenue)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {money(totals.cost)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {money(grossProfit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {grossMargin === null ? "—" : `${grossMargin.toFixed(1)}%`}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
