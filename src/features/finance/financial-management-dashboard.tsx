import { useMemo } from "react";
import {
  useInvoices,
  usePayments,
  useClients,
  useServiceLines,
  paymentsByInvoice,
} from "./use-finance-data";
import { useExpenses } from "./use-expenses";
import {
  computeAging,
  computePayablesAging,
  daysBetween,
  formatCurrency,
  invoiceOutstanding,
  invoiceRevenue,
  invoiceStatus,
  isBilledInvoice,
  STATUS_LABELS,
  STATUS_STYLES,
} from "./finance";
import { CurrencyNote, splitByCurrency, useCompanyCurrency } from "./money";
import { StatTile } from "./stat-tile";
import { Loader2 } from "lucide-react";
import { LoadError } from "@/components/load-error";
import { formatDate } from "@/lib/format-date";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

const AR_COLORS = ["#085599", "#F5821F", "#22c55e", "#eab308", "#ef4444"];

const AGING_LABELS: Record<string, string> = {
  Current: "Not yet due",
  "1-30 days": "1–30 days",
  "31-60 days": "31–60 days",
  "61-90 days": "61–90 days",
  "90+ days": "90+ days",
};

function GaugeCard({
  label,
  value,
  suffix,
  max,
  hint,
  tone = "primary",
  emptyText,
}: {
  label: string;
  value: number;
  suffix?: string;
  max: number;
  hint?: string;
  tone?: "primary" | "warning" | "success" | "danger";
  emptyText?: string;
}) {
  const color =
    tone === "success"
      ? "#22c55e"
      : tone === "warning"
        ? "#F5821F"
        : tone === "danger"
          ? "#ef4444"
          : "#085599";
  const clamped = emptyText ? 0 : Math.max(0, Math.min(value, max));
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs font-medium">{label}</div>
      {hint && <div className="mb-1 text-xs text-muted-foreground">{hint}</div>}
      <div className="relative h-32">
        <ResponsiveContainer>
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={[{ v: clamped, fill: color }]}
            startAngle={210}
            endAngle={-30}
          >
            <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
            <RadialBar dataKey="v" background cornerRadius={6} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {emptyText ? (
            <>
              <div className="text-lg font-bold text-muted-foreground">—</div>
              <div className="max-w-[7rem] text-xs text-muted-foreground">{emptyText}</div>
            </>
          ) : (
            <div className="text-lg font-bold tabular-nums">
              {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              {suffix}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FinancialManagementDashboard() {
  const invoicesQ = useInvoices();
  const paymentsQ = usePayments();
  const clientsQ = useClients();
  const slQ = useServiceLines();
  const expensesQ = useExpenses();
  const companyCurrency = useCompanyCurrency();

  const queries = [invoicesQ, paymentsQ, clientsQ, slQ, expensesQ];
  const loading = queries.some((q) => q.isLoading);
  const failed = queries.find((q) => q.isError);

  const data = useMemo(() => {
    const allInvoices = invoicesQ.data ?? [];
    const payments = paymentsQ.data ?? [];
    const clients = clientsQ.data ?? [];
    const serviceLines = slQ.data ?? [];
    const allExpenses = expensesQ.data ?? [];
    // Every figure here is in the company currency; other currencies are counted, not added.
    const invoiceSplit = splitByCurrency(allInvoices, (i) => i.currency_code, companyCurrency);
    const expenseSplit = splitByCurrency(allExpenses, (e) => e.currency_code, companyCurrency);
    const invoices = invoiceSplit.inCompany;
    const expenses = expenseSplit.inCompany;
    const paidMap = paymentsByInvoice(payments);
    const clientMap = new Map(clients.map((c) => [c.id, c]));

    const eligible = invoices.filter(isBilledInvoice);
    const totalAR = eligible.reduce((s, i) => s + invoiceOutstanding(i, paidMap.get(i.id) ?? 0), 0);
    const totalRevenue = eligible.reduce((s, i) => s + invoiceRevenue(i), 0);
    const totalCost = eligible.reduce((s, i) => s + Number(i.direct_cost), 0);
    const totalPaid = eligible.reduce((s, i) => s + (paidMap.get(i.id) ?? 0), 0);
    // Expenses tied to a service line count as direct costs of delivering it.
    const lineExpenses = expenses
      .filter((e) => e.service_line_id)
      .reduce((s, e) => s + Number(e.amount), 0);
    const directCosts = totalCost + lineExpenses;
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - directCosts) / totalRevenue) * 100 : 0;
    const invoiceMargin =
      totalRevenue > 0 ? Math.min(100, ((totalRevenue - totalCost) / totalRevenue) * 100) : 0;
    const owedShare = totalRevenue > 0 ? (totalAR / totalRevenue) * 100 : 0;

    // Days to get paid: average age of unpaid invoices since issue.
    const now = new Date();
    let dsoSum = 0;
    let dsoCount = 0;
    for (const inv of eligible) {
      if (invoiceOutstanding(inv, paidMap.get(inv.id) ?? 0) <= 0.01) continue;
      dsoSum += Math.floor((now.getTime() - new Date(inv.issue_date).getTime()) / 86400000);
      dsoCount += 1;
    }
    const dso = dsoCount > 0 ? dsoSum / dsoCount : 0;

    // Days to pay bills: unpaid bills divided by average daily spend over 90 days.
    const unpaid = expenses.filter((e) => e.status === "unpaid");
    const totalPayables = unpaid.reduce((s, e) => s + Number(e.amount), 0);
    const since90 = new Date(now.getTime() - 90 * 86400000);
    const spend90 = expenses
      .filter((e) => new Date(e.expense_date) >= since90)
      .reduce((s, e) => s + Number(e.amount), 0);
    const dailySpend = spend90 / 90;
    const dpo = dailySpend > 0 ? totalPayables / dailySpend : 0;

    const aging = computeAging(invoices, paidMap);
    const payablesAging = computePayablesAging(expenses, now);

    // Monthly profit and loss, 12 months trailing.
    const monthly: {
      key: string;
      label: string;
      revenue: number;
      cost: number;
      profit: number;
      runningProfit: number;
    }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("en-GB", { month: "short" }),
        revenue: 0,
        cost: 0,
        profit: 0,
        runningProfit: 0,
      });
    }
    const idx = new Map(monthly.map((m, i) => [m.key, i]));
    for (const inv of eligible) {
      const d = new Date(inv.issue_date);
      const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (i === undefined) continue;
      monthly[i].revenue += invoiceRevenue(inv);
      monthly[i].cost += Number(inv.direct_cost);
    }
    let running = 0;
    monthly.forEach((m) => {
      m.profit = m.revenue - m.cost;
      running += m.profit;
      m.runningProfit = running;
    });

    const slMap = new Map(serviceLines.map((s) => [s.id, s]));
    type LineTotals = {
      name: string;
      revenue: number;
      directCost: number;
      expenses: number;
      count: number;
      recurring: boolean;
    };
    const byLineMap = new Map<string, LineTotals>();
    const lineFor = (id: string) => {
      const sl = slMap.get(id);
      if (!sl) return null;
      const cur = byLineMap.get(id) ?? {
        name: sl.name,
        revenue: 0,
        directCost: 0,
        expenses: 0,
        count: 0,
        recurring: sl.is_recurring,
      };
      byLineMap.set(id, cur);
      return cur;
    };
    for (const inv of eligible) {
      const cur = inv.service_line_id ? lineFor(inv.service_line_id) : null;
      if (!cur) continue;
      cur.revenue += invoiceRevenue(inv);
      cur.directCost += Number(inv.direct_cost);
      cur.count += 1;
    }
    for (const e of expenses) {
      const cur = e.service_line_id ? lineFor(e.service_line_id) : null;
      if (cur) cur.expenses += Number(e.amount);
    }
    const lineRows = Array.from(byLineMap.values());
    const pie = lineRows
      .filter((l) => l.revenue > 0)
      .map((l) => ({ name: l.name, value: l.revenue }));
    const serviceLineTable = lineRows
      .map((l) => ({
        ...l,
        pctOfTotal: totalRevenue > 0 ? (l.revenue / totalRevenue) * 100 : 0,
        margin: l.revenue > 0 ? ((l.revenue - l.directCost - l.expenses) / l.revenue) * 100 : null,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const topOutstanding = eligible
      .map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        clientName: clientMap.get(inv.client_id)?.name ?? "—",
        dueDate: inv.due_date,
        daysOverdue: daysBetween(now, new Date(inv.due_date)),
        outstanding: invoiceOutstanding(inv, paidMap.get(inv.id) ?? 0),
        status: invoiceStatus(inv, paidMap.get(inv.id) ?? 0, now),
      }))
      .filter((r) => r.outstanding > 0.01)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 10);

    return {
      invoiceSplit,
      expenseSplit,
      billedCount: eligible.length,
      expenseCount: expenses.length,
      totalAR,
      totalPaid,
      serviceLineTable,
      topOutstanding,
      totalRevenue,
      totalCost,
      lineExpenses,
      totalPayables,
      payablesAging,
      dpo,
      dsoCount,
      grossMargin,
      invoiceMargin,
      owedShare,
      dso,
      aging,
      monthly,
      pie,
    };
  }, [invoicesQ.data, paymentsQ.data, clientsQ.data, slQ.data, expensesQ.data, companyCurrency]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2
          className="h-6 w-6 animate-spin text-primary"
          aria-label="Loading finance figures"
        />
      </div>
    );
  }

  if (failed) {
    return (
      <LoadError
        what="finance figures"
        error={failed.error}
        onRetry={() => queries.forEach((q) => void q.refetch())}
      />
    );
  }

  const money = (v: number) => formatCurrency(v, companyCurrency);
  const noInvoices =
    data.billedCount === 0
      ? data.invoiceSplit.otherCount > 0
        ? `No ${companyCurrency} invoices yet`
        : "No invoices yet"
      : undefined;
  const agingChart = data.aging.map((b, i) => ({
    label: AGING_LABELS[b.label] ?? b.label,
    receivable: b.amount,
    payable: data.payablesAging[i]?.amount ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <CurrencyNote
          companyCurrency={companyCurrency}
          otherCount={data.invoiceSplit.otherCount}
          otherCodes={data.invoiceSplit.otherCodes}
        />
        {data.expenseSplit.otherCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {data.expenseSplit.otherCount} expense{data.expenseSplit.otherCount === 1 ? "" : "s"} in{" "}
            {data.expenseSplit.otherCodes.join(", ")}{" "}
            {data.expenseSplit.otherCount === 1 ? "isn't" : "aren't"} included.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Still owed to us"
          hint="Accounts receivable: unpaid on sent invoices"
          value={money(data.totalAR)}
          tone={data.totalAR > 0 ? "warning" : "default"}
          emptyText={noInvoices}
        />
        <StatTile
          label="Unpaid bills"
          hint="Accounts payable: expenses not yet paid"
          value={money(data.totalPayables)}
          tone={data.totalPayables > 0 ? "danger" : "default"}
          emptyText={data.expenseCount === 0 ? "No expenses yet" : undefined}
        />
        <StatTile
          label="Margin on invoices"
          hint="Revenue left after invoice direct costs"
          value={`${data.invoiceMargin.toFixed(1)}%`}
          emptyText={noInvoices}
        />
        <StatTile
          label="Share of revenue still unpaid"
          hint="Still owed ÷ revenue"
          value={`${data.owedShare.toFixed(1)}%`}
          emptyText={noInvoices}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <GaugeCard
          label="Revenue ÷ direct cost"
          hint="How many times revenue covers direct costs"
          value={data.totalRevenue / Math.max(1, data.totalCost)}
          max={3}
          tone="primary"
          emptyText={noInvoices}
        />
        <GaugeCard
          label="Days to get paid (DSO)"
          hint="Average age of unpaid invoices"
          value={Math.round(data.dso)}
          suffix=" days"
          max={90}
          tone="danger"
          emptyText={noInvoices ?? (data.dsoCount === 0 ? "Nothing unpaid" : undefined)}
        />
        <GaugeCard
          label="Days to pay bills (DPO)"
          hint="How long unpaid bills have waited, on average"
          value={Math.round(data.dpo)}
          suffix=" days"
          max={60}
          tone="success"
          emptyText={data.expenseCount === 0 ? "No expenses yet" : undefined}
        />
        <div className="rounded-lg border bg-card p-3 sm:col-span-3 lg:col-span-2">
          <div className="text-xs font-medium">Owed to us and by us, by days late</div>
          <div className="mb-1 text-xs text-muted-foreground">Receivables and payables ageing</div>
          <div className="h-40">
            <ResponsiveContainer>
              <BarChart data={agingChart} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="receivable" fill="#085599" name="Owed to us" />
                <Bar dataKey="payable" fill="#F5821F" name="We owe" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-semibold">Revenue and running profit</div>
          <div className="mb-2 text-xs text-muted-foreground">
            Running profit adds up each month&apos;s profit (a simple view of working capital)
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#085599" name="Revenue" />
                <Line
                  type="monotone"
                  dataKey="runningProfit"
                  stroke="#F5821F"
                  strokeWidth={2}
                  name="Running profit"
                  dot
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Profit and loss by month</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" stackId="a" fill="#085599" name="Revenue" />
                <Bar dataKey="cost" stackId="a" fill="#F5821F" name="Direct cost" />
                <Bar dataKey="profit" fill="#22c55e" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="mb-2 text-sm font-semibold">Revenue by service line</div>
          {data.pie.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              {noInvoices ?? "No sent invoices have a service line yet"}
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data.pie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    label={(entry) => `${entry.name}`}
                  >
                    {data.pie.map((_, i) => (
                      <Cell key={i} fill={AR_COLORS[i % AR_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 text-sm font-semibold">At a glance</div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Gross margin</dt>
              <dd className="font-semibold">
                {noInvoices ? "—" : `${data.grossMargin.toFixed(1)}%`}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Revenue (before VAT)</dt>
              <dd className="font-semibold">{money(data.totalRevenue)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Invoice direct costs</dt>
              <dd className="font-semibold">{money(data.totalCost)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Service line expenses</dt>
              <dd className="font-semibold">{money(data.lineExpenses)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Unpaid bills</dt>
              <dd className="font-semibold">{money(data.totalPayables)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Collected</dt>
              <dd className="font-semibold">{money(data.totalPaid)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Still owed</dt>
              <dd className="font-semibold">{money(data.totalAR)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Gross margin = revenue before VAT, minus invoice direct costs and expenses linked to a
            service line.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 text-sm font-semibold">Largest unpaid invoices</div>
        {data.topOutstanding.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {noInvoices ?? "Nothing is owed right now"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Days late</TableHead>
                  <TableHead className="text-right">Still owed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topOutstanding.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.invoiceNumber}</TableCell>
                    <TableCell>{r.clientName}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDate(r.dueDate)}
                    </TableCell>
                    <TableCell
                      className={`text-xs tabular-nums ${r.daysOverdue > 0 ? "font-medium text-destructive" : "text-muted-foreground"}`}
                    >
                      {r.daysOverdue > 0 ? `${r.daysOverdue} days late` : "Not yet due"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                      {money(r.outstanding)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLES[r.status]} variant="secondary">
                        {STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold">Revenue by service line — detail</div>
        <p className="mb-2 text-xs text-muted-foreground">
          Margin after costs = revenue before VAT, minus invoice direct costs and expenses linked to
          that service line.
        </p>
        {data.serviceLineTable.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {noInvoices ?? "No revenue yet"}
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
                  <TableHead className="text-right">Share of revenue</TableHead>
                  <TableHead className="text-right">Direct costs</TableHead>
                  <TableHead className="text-right">Linked expenses</TableHead>
                  <TableHead className="text-right">Margin after costs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.serviceLineTable.map((l) => (
                  <TableRow key={l.name}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{l.recurring ? "Recurring" : "One-off"}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.count}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                      {money(l.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.pctOfTotal.toFixed(1)}%
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {money(l.directCost)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {money(l.expenses)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${l.margin === null ? "text-muted-foreground" : l.margin >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {l.margin === null ? "—" : `${l.margin.toFixed(1)}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 text-sm font-semibold">Profit and loss — monthly detail</div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Direct cost</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Running profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.monthly.map((m) => (
                <TableRow key={m.key}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {money(m.revenue)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {money(m.cost)}
                  </TableCell>
                  <TableCell
                    className={`whitespace-nowrap text-right font-semibold tabular-nums ${m.profit < 0 ? "text-destructive" : m.profit > 0 ? "text-success" : "text-muted-foreground"}`}
                  >
                    {money(m.profit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.revenue > 0 ? `${((m.profit / m.revenue) * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {money(m.runningProfit)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
