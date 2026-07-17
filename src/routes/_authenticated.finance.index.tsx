import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Loader2,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Percent,
  FileText,
  Repeat,
} from "lucide-react";
import {
  useInvoices,
  usePayments,
  paymentsByInvoice,
  useServiceLines,
} from "@/features/finance/use-finance-data";
import { computeAging, formatCurrency, invoiceOutstanding } from "@/features/finance/finance";

export const Route = createFileRoute("/_authenticated/finance/")({
  head: () => ({ meta: [{ title: "Finance Overview — AIMS" }] }),
  component: FinanceOverview,
});

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  const toneCls =
    tone === "positive"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-primary";
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </div>
        <div
          className={`h-8 w-8 rounded-md bg-secondary flex items-center justify-center ${toneCls}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function FinanceOverview() {
  const invoicesQ = useInvoices();
  const paymentsQ = usePayments();
  const serviceLinesQ = useServiceLines();

  const loading = invoicesQ.isLoading || paymentsQ.isLoading || serviceLinesQ.isLoading;

  const stats = useMemo(() => {
    const invoices = invoicesQ.data ?? [];
    const payments = paymentsQ.data ?? [];
    const serviceLines = serviceLinesQ.data ?? [];
    const paidMap = paymentsByInvoice(payments);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonth = invoices.filter((i) => new Date(i.issue_date) >= monthStart);

    const totalRevenue = invoices
      .filter((i) => i.status !== "draft" && i.status !== "void")
      .reduce((s, i) => s + Number(i.total), 0);
    const monthRevenue = thisMonth
      .filter((i) => i.status !== "draft" && i.status !== "void")
      .reduce((s, i) => s + Number(i.total), 0);
    const recurringMonth = thisMonth
      .filter((i) => i.is_recurring && i.status !== "draft" && i.status !== "void")
      .reduce((s, i) => s + Number(i.total), 0);
    const directCost = invoices
      .filter((i) => i.status !== "draft" && i.status !== "void")
      .reduce((s, i) => s + Number(i.direct_cost), 0);
    const outstanding = invoices.reduce(
      (s, i) => s + invoiceOutstanding(i, paidMap.get(i.id) ?? 0),
      0,
    );

    const aging = computeAging(invoices, paidMap);
    const overdue = aging.slice(1).reduce((s, b) => s + b.amount, 0);

    const grossMargin = totalRevenue > 0 ? ((totalRevenue - directCost) / totalRevenue) * 100 : 0;

    // By service line
    const slMap = new Map(serviceLines.map((s) => [s.id, s]));
    const byLine = new Map<
      string,
      { name: string; recurring: boolean; total: number; cost: number }
    >();
    for (const inv of invoices) {
      if (inv.status === "draft" || inv.status === "void") continue;
      if (!inv.service_line_id) continue;
      const sl = slMap.get(inv.service_line_id);
      if (!sl) continue;
      const cur = byLine.get(sl.id) ?? {
        name: sl.name,
        recurring: sl.is_recurring,
        total: 0,
        cost: 0,
      };
      cur.total += Number(inv.total);
      cur.cost += Number(inv.direct_cost);
      byLine.set(sl.id, cur);
    }

    return {
      invoiceCount: invoices.length,
      monthRevenue,
      recurringMonth,
      totalRevenue,
      outstanding,
      overdue,
      grossMargin,
      lines: Array.from(byLine.values()).sort((a, b) => b.total - a.total),
    };
  }, [invoicesQ.data, paymentsQ.data, serviceLinesQ.data]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Revenue (Month)"
          value={formatCurrency(stats.monthRevenue)}
          icon={DollarSign}
        />
        <StatCard
          label="Recurring MRR"
          value={formatCurrency(stats.recurringMonth)}
          icon={Repeat}
          tone="positive"
        />
        <StatCard
          label="Revenue (All)"
          value={formatCurrency(stats.totalRevenue)}
          icon={TrendingUp}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(stats.outstanding)}
          icon={FileText}
          tone="warning"
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(stats.overdue)}
          icon={AlertCircle}
          tone="danger"
        />
        <StatCard
          label="Gross Margin"
          value={`${stats.grossMargin.toFixed(1)}%`}
          icon={Percent}
          tone="positive"
        />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-1">Revenue by service line</h2>
        <p className="text-xs text-muted-foreground mb-4">
          All-time · recurring vs one-off · gross margin
        </p>
        {stats.lines.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No invoices yet. Add invoices or upload an Excel file to populate reports.
          </div>
        ) : (
          <div className="space-y-3">
            {stats.lines.map((l) => {
              const max = Math.max(...stats.lines.map((x) => x.total));
              const pct = max > 0 ? (l.total / max) * 100 : 0;
              const margin = l.total > 0 ? ((l.total - l.cost) / l.total) * 100 : 0;
              return (
                <div key={l.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">
                      {l.name}{" "}
                      <span className="ml-2 text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                        {l.recurring ? "Recurring" : "One-off"}
                      </span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(l.total)} · margin {margin.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={l.recurring ? "h-full bg-primary" : "h-full bg-accent"}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
