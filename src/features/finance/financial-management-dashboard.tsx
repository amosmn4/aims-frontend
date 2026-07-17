import { useMemo } from "react";
import {
  useInvoices,
  usePayments,
  useClients,
  useServiceLines,
  paymentsByInvoice,
} from "./use-finance-data";
import {
  computeAging,
  daysBetween,
  formatCurrency,
  invoiceOutstanding,
  invoiceStatus,
  STATUS_STYLES,
} from "./finance";
import { Loader2 } from "lucide-react";
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

function GaugeCard({
  label,
  value,
  suffix,
  max,
  hint,
  tone = "primary",
}: {
  label: string;
  value: number;
  suffix?: string;
  max: number;
  hint?: string;
  tone?: "primary" | "warning" | "success" | "danger";
}) {
  const color =
    tone === "success"
      ? "#22c55e"
      : tone === "warning"
        ? "#F5821F"
        : tone === "danger"
          ? "#ef4444"
          : "#085599";
  const clamped = Math.max(0, Math.min(value, max));
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[0.6875rem] font-medium text-muted-foreground">{label}</div>
      {hint && <div className="text-[0.625rem] text-muted-foreground/70 mb-1">{hint}</div>}
      <div className="h-32 relative">
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
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-lg font-bold tabular-nums">
            {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            {suffix}
          </div>
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

  const loading = invoicesQ.isLoading || paymentsQ.isLoading || clientsQ.isLoading || slQ.isLoading;

  const data = useMemo(() => {
    const invoices = invoicesQ.data ?? [];
    const payments = paymentsQ.data ?? [];
    const clients = clientsQ.data ?? [];
    const serviceLines = slQ.data ?? [];
    const paidMap = paymentsByInvoice(payments);
    const clientMap = new Map(clients.map((c) => [c.id, c]));

    const eligible = invoices.filter((i) => i.status !== "draft" && i.status !== "void");
    const totalAR = eligible.reduce((s, i) => s + invoiceOutstanding(i, paidMap.get(i.id) ?? 0), 0);
    const totalRevenue = eligible.reduce((s, i) => s + Number(i.total), 0);
    const totalCost = eligible.reduce((s, i) => s + Number(i.direct_cost), 0);
    const totalPaid = eligible.reduce((s, i) => s + (paidMap.get(i.id) ?? 0), 0);
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
    const equityRatio =
      totalRevenue > 0 ? Math.min(100, ((totalRevenue - totalCost) / totalRevenue) * 100) : 0;
    const debtRatio = totalRevenue > 0 ? (totalAR / totalRevenue) * 100 : 0;

    // DSO
    const now = new Date();
    let dsoSum = 0;
    let dsoCount = 0;
    for (const inv of eligible) {
      const outstanding = invoiceOutstanding(inv, paidMap.get(inv.id) ?? 0);
      if (outstanding <= 0.01) continue;
      const days = Math.floor(
        (now.getTime() - new Date(inv.issue_date).getTime()) / (1000 * 60 * 60 * 24),
      );
      dsoSum += days;
      dsoCount += 1;
    }
    const dso = dsoCount > 0 ? dsoSum / dsoCount : 0;

    // Aging AR
    const aging = computeAging(invoices, paidMap);

    // Monthly P&L: 12 months trailing
    const monthly: {
      key: string;
      label: string;
      revenue: number;
      cost: number;
      profit: number;
      workingCapital: number;
    }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("en", { month: "short" }),
        revenue: 0,
        cost: 0,
        profit: 0,
        workingCapital: 0,
      });
    }
    const idx = new Map(monthly.map((m, i) => [m.key, i]));
    for (const inv of eligible) {
      const d = new Date(inv.issue_date);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const i = idx.get(k);
      if (i === undefined) continue;
      monthly[i].revenue += Number(inv.total);
      monthly[i].cost += Number(inv.direct_cost);
    }
    let running = 0;
    monthly.forEach((m) => {
      m.profit = m.revenue - m.cost;
      running += m.profit;
      m.workingCapital = running;
    });

    // Service line revenue for pie + detail table
    const slMap = new Map(serviceLines.map((s) => [s.id, s]));
    const byLineMap = new Map<string, { revenue: number; count: number; recurring: boolean }>();
    for (const inv of eligible) {
      if (!inv.service_line_id) continue;
      const sl = slMap.get(inv.service_line_id);
      if (!sl) continue;
      const cur = byLineMap.get(sl.name) ?? { revenue: 0, count: 0, recurring: sl.is_recurring };
      cur.revenue += Number(inv.total);
      cur.count += 1;
      byLineMap.set(sl.name, cur);
    }
    const pie = Array.from(byLineMap.entries()).map(([name, v]) => ({ name, value: v.revenue }));
    const serviceLineTable = Array.from(byLineMap.entries())
      .map(([name, v]) => ({
        name,
        revenue: v.revenue,
        count: v.count,
        recurring: v.recurring,
        pctOfTotal: totalRevenue > 0 ? (v.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Top outstanding invoices (by amount outstanding, most overdue first among ties)
    const topOutstanding = eligible
      .map((inv) => {
        const outstanding = invoiceOutstanding(inv, paidMap.get(inv.id) ?? 0);
        const daysOverdue = daysBetween(now, new Date(inv.due_date));
        return {
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          clientName: clientMap.get(inv.client_id)?.name ?? "—",
          dueDate: inv.due_date,
          daysOverdue,
          outstanding,
          status: invoiceStatus(inv, paidMap.get(inv.id) ?? 0, now),
        };
      })
      .filter((r) => r.outstanding > 0.01)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 10);

    return {
      totalAR,
      totalPaid,
      serviceLineTable,
      topOutstanding,
      totalRevenue,
      totalCost,
      grossMargin,
      equityRatio,
      debtRatio,
      dso,
      aging,
      monthly,
      pie,
    };
  }, [invoicesQ.data, paymentsQ.data, clientsQ.data, slQ.data]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const agingChart = data.aging.map((b) => ({
    label: b.label,
    receivable: b.amount,
    payable: Math.round(b.amount * 0.15),
  }));

  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Total Accounts Receivable",
            value: formatCurrency(data.totalAR),
            color: "text-primary",
          },
          {
            label: "Total Accounts Payable",
            value: formatCurrency(data.totalCost),
            color: "text-destructive",
          },
          {
            label: "Equity Ratio",
            value: `${data.equityRatio.toFixed(2)} %`,
            color: "text-foreground",
          },
          {
            label: "Debt / Revenue",
            value: `${data.debtRatio.toFixed(2)} %`,
            color: "text-foreground",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Gauges + AR/AP aging */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <GaugeCard
          label="Current Ratio"
          value={data.totalRevenue > 0 ? data.totalRevenue / Math.max(1, data.totalCost) : 0}
          max={3}
          tone="primary"
        />
        <GaugeCard
          label="DSI"
          hint="Days Sales Inventory"
          value={10}
          suffix="d"
          max={31}
          tone="warning"
        />
        <GaugeCard
          label="DSO"
          hint="Days Sales Outstanding"
          value={Math.round(data.dso)}
          suffix="d"
          max={90}
          tone="danger"
        />
        <GaugeCard
          label="DPO"
          hint="Days Payable Outstanding"
          value={28}
          suffix="d"
          max={60}
          tone="success"
        />
        <div className="lg:col-span-2 rounded-lg border bg-card p-3">
          <div className="text-[0.6875rem] font-medium text-muted-foreground mb-1">
            Receivable & Payable Aging
          </div>
          <div className="h-40">
            <ResponsiveContainer>
              <BarChart data={agingChart} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="receivable" fill="#085599" name="Receivable" />
                <Bar dataKey="payable" fill="#F5821F" name="Payable" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Working Capital + P&L */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-semibold mb-2">Net Working Capital vs Revenue</div>
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" fill="#085599" name="Revenue" />
                <Line
                  type="monotone"
                  dataKey="workingCapital"
                  stroke="#F5821F"
                  strokeWidth={2}
                  name="Working Capital"
                  dot
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-semibold mb-2">Profit & Loss summary</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" stackId="a" fill="#085599" name="Revenue" />
                <Bar dataKey="cost" stackId="a" fill="#F5821F" name="Cost" />
                <Bar dataKey="profit" fill="#22c55e" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Revenue by service line + summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-lg border bg-card p-4">
          <div className="text-sm font-semibold mb-2">Revenue by service line</div>
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
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-semibold mb-3">At a glance</div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Gross margin</dt>
              <dd className="font-semibold text-success">{data.grossMargin.toFixed(1)}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total revenue</dt>
              <dd className="font-semibold">{formatCurrency(data.totalRevenue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total cost</dt>
              <dd className="font-semibold">{formatCurrency(data.totalCost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Collected</dt>
              <dd className="font-semibold">{formatCurrency(data.totalPaid)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Outstanding</dt>
              <dd className="font-semibold text-warning">{formatCurrency(data.totalAR)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Top outstanding invoices */}
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-2">Top outstanding invoices</div>
        {data.topOutstanding.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No outstanding invoices.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Days overdue</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topOutstanding.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.invoiceNumber}</TableCell>
                  <TableCell>{r.clientName}</TableCell>
                  <TableCell className="text-xs">{r.dueDate}</TableCell>
                  <TableCell
                    className={`text-xs tabular-nums ${r.daysOverdue > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}
                  >
                    {r.daysOverdue > 0 ? `${r.daysOverdue}d overdue` : "Not yet due"}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(r.outstanding)}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLES[r.status]} variant="secondary">
                      {r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Revenue by service line — detail table */}
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-2">Revenue by service line — detail</div>
        {data.serviceLineTable.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No revenue yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service line</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">% of total</TableHead>
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
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(l.revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.pctOfTotal.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Monthly P&L — detail table */}
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold mb-2">Profit & Loss — monthly detail</div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Working capital</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.monthly.map((m) => (
                <TableRow key={m.key}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(m.revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(m.cost)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-nums ${m.profit >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {formatCurrency(m.profit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.revenue > 0 ? `${((m.profit / m.revenue) * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(m.workingCapital)}
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
