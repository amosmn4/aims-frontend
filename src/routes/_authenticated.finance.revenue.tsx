import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInvoices, useServiceLines } from "@/features/finance/use-finance-data";
import { formatCurrency } from "@/features/finance/finance";

export const Route = createFileRoute("/_authenticated/finance/revenue")({
  head: () => ({ meta: [{ title: "Revenue & Margin — AIMS" }] }),
  component: RevenuePage,
});

function RevenuePage() {
  const invoicesQ = useInvoices();
  const slQ = useServiceLines();

  const loading = invoicesQ.isLoading || slQ.isLoading;
  const invoices = useMemo(() => invoicesQ.data ?? [], [invoicesQ.data]);
  const serviceLines = useMemo(() => slQ.data ?? [], [slQ.data]);

  const slMap = useMemo(() => new Map(serviceLines.map((s) => [s.id, s])), [serviceLines]);

  const rows = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        recurring: boolean;
        count: number;
        revenue: number;
        cost: number;
      }
    >();
    for (const inv of invoices) {
      if (inv.status === "draft" || inv.status === "void") continue;
      const key = inv.service_line_id ?? "__none__";
      const sl = inv.service_line_id ? slMap.get(inv.service_line_id) : null;
      const cur = map.get(key) ?? {
        name: sl?.name ?? "Unassigned",
        recurring: sl?.is_recurring ?? false,
        count: 0,
        revenue: 0,
        cost: 0,
      };
      cur.count += 1;
      cur.revenue += Number(inv.total);
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
  const grossMargin = totals.revenue > 0 ? (grossProfit / totals.revenue) * 100 : 0;

  // Monthly recurring vs one-off (last 6 months)
  const monthly = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; recurring: number; oneOff: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("en", { month: "short", year: "2-digit" }),
        recurring: 0,
        oneOff: 0,
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    for (const inv of invoices) {
      if (inv.status === "draft" || inv.status === "void") continue;
      const d = new Date(inv.issue_date);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const i = idx.get(k);
      if (i === undefined) continue;
      if (inv.is_recurring) buckets[i].recurring += Number(inv.total);
      else buckets[i].oneOff += Number(inv.total);
    }
    return buckets;
  }, [invoices]);

  const monthMax = Math.max(1, ...monthly.map((m) => m.recurring + m.oneOff));

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total revenue" value={formatCurrency(totals.revenue)} />
        <StatCard
          label="Recurring revenue"
          value={formatCurrency(totals.recurring)}
          tone="positive"
        />
        <StatCard label="One-off revenue" value={formatCurrency(totals.oneOff)} />
        <StatCard label="Gross margin" value={`${grossMargin.toFixed(1)}%`} tone="positive" />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-1">Recurring vs one-off — last 6 months</h2>
        <p className="text-xs text-muted-foreground mb-4">By invoice issue date</p>
        <div className="flex items-end gap-3 h-56">
          {monthly.map((m) => {
            const total = m.recurring + m.oneOff;
            const totalPct = (total / monthMax) * 100;
            const recPct = total > 0 ? (m.recurring / total) * 100 : 0;
            return (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex-1 w-full flex flex-col justify-end">
                  <div
                    className="w-full rounded-md bg-secondary overflow-hidden flex flex-col-reverse"
                    style={{ height: `${totalPct}%` }}
                  >
                    <div className="bg-primary" style={{ height: `${recPct}%` }} />
                    <div className="bg-accent flex-1" />
                  </div>
                </div>
                <div className="text-[0.625rem] text-muted-foreground">{m.label}</div>
                <div className="text-[0.625rem] tabular-nums">{formatCurrency(total)}</div>
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

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">Gross margin by service line</h2>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No revenue data yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service line</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right"># Inv</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Direct cost</TableHead>
                <TableHead className="text-right">Gross profit</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const gp = r.revenue - r.cost;
                const m = r.revenue > 0 ? (gp / r.revenue) * 100 : 0;
                return (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <span
                        className={`text-[0.625rem] uppercase font-semibold ${
                          r.recurring ? "text-primary" : "text-accent-foreground"
                        }`}
                      >
                        {r.recurring ? "Recurring" : "One-off"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.cost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(gp)}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-semibold ${m < 20 ? "text-destructive" : m < 40 ? "text-warning" : "text-success"}`}
                    >
                      {m.toFixed(1)}%
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
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(totals.revenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(totals.cost)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(grossProfit)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-success">
                  {grossMargin.toFixed(1)}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive";
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tabular-nums ${tone === "positive" ? "text-success" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
