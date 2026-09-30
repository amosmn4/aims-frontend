import type { InvoiceRow, PaymentRow } from "./finance";
import { computeAging, invoiceOutstanding, invoiceRevenue, isBilledInvoice } from "./finance";
import type { Client, ServiceLine } from "./use-finance-data";

export type FinanceReportType =
  "monthly_financial" | "debtors_ageing" | "revenue_service_line" | "quarterly_executive";

export const REPORT_TYPE_LABELS: Record<FinanceReportType, string> = {
  monthly_financial: "Monthly finance report",
  debtors_ageing: "Debtors report (who owes us, by days late)",
  revenue_service_line: "Revenue by service line report",
  quarterly_executive: "Quarterly summary for the CEO",
};

export type FinanceReportStatus = "draft" | "submitted" | "approved" | "changes_requested";

export const STATUS_LABELS: Record<FinanceReportStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export const STATUS_STYLES: Record<FinanceReportStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  submitted: "bg-primary/10 text-primary",
  approved: "bg-success/15 text-success",
  changes_requested: "bg-warning/15 text-warning",
};

export interface KpiEntry {
  label: string;
  value: number;
  format: "currency" | "percent" | "number";
  hint?: string;
}

export interface FinanceReportSnapshot {
  period_start: string;
  period_end: string;
  /** Currency every amount is in; older reports have none. */
  currency?: string;
  /** Invoices in other currencies left out of the figures. */
  other_currency_invoices?: number;
  kpis: KpiEntry[];
  monthly?: { label: string; revenue: number; cost: number; profit: number }[];
  aging?: { label: string; amount: number; count: number }[];
  by_service_line?: { name: string; recurring: boolean; total: number; cost: number }[];
  top_debtors?: { client: string; outstanding: number; oldest_days: number }[];
  invoice_count: number;
  generated_at: string;
}

function pctInWindow(d: string, start: Date, end: Date) {
  const t = new Date(d).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export function buildSnapshot({
  type,
  periodStart,
  periodEnd,
  invoices,
  payments,
  serviceLines,
  clients,
  currency,
}: {
  type: FinanceReportType;
  periodStart: Date;
  periodEnd: Date;
  /** Company currency; invoices in other currencies are left out, not added in. */
  currency: string;
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  serviceLines: ServiceLine[];
  clients: Client[];
}): FinanceReportSnapshot {
  const otherCurrencyInvoices = invoices.filter(
    (i) => i.currency_code !== currency && isBilledInvoice(i),
  ).length;
  invoices = invoices.filter((i) => i.currency_code === currency);
  const eligible = invoices.filter(
    (i) => isBilledInvoice(i) && pctInWindow(i.issue_date, periodStart, periodEnd),
  );

  const paidMap = new Map<string, number>();
  for (const p of payments) {
    paidMap.set(p.invoice_id, (paidMap.get(p.invoice_id) ?? 0) + Number(p.amount));
  }

  // Revenue is before VAT; collection rate compares cash to the full billed amount.
  const revenue = eligible.reduce((s, i) => s + invoiceRevenue(i), 0);
  const billedTotal = eligible.reduce((s, i) => s + Number(i.total), 0);
  const cost = eligible.reduce((s, i) => s + Number(i.direct_cost), 0);
  const recurring = eligible
    .filter((i) => i.is_recurring)
    .reduce((s, i) => s + invoiceRevenue(i), 0);
  const oneOff = revenue - recurring;
  const collected = eligible.reduce((s, i) => s + (paidMap.get(i.id) ?? 0), 0);
  const outstanding = invoices.reduce(
    (s, i) => s + invoiceOutstanding(i, paidMap.get(i.id) ?? 0),
    0,
  );
  const grossMargin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
  const collectionRate = billedTotal > 0 ? (collected / billedTotal) * 100 : 0;

  const kpis: KpiEntry[] = [
    { label: "Revenue", value: revenue, format: "currency", hint: "Before VAT" },
    { label: "Direct cost", value: cost, format: "currency" },
    { label: "Gross profit", value: revenue - cost, format: "currency" },
    { label: "Gross margin", value: grossMargin, format: "percent" },
    { label: "Recurring revenue", value: recurring, format: "currency" },
    { label: "One-off revenue", value: oneOff, format: "currency" },
    { label: "Collected", value: collected, format: "currency" },
    { label: "Still owed to us", value: outstanding, format: "currency" },
    { label: "Collection rate", value: collectionRate, format: "percent" },
    { label: "Invoices", value: eligible.length, format: "number" },
  ];

  // Monthly P&L within window
  const monthly: { label: string; key: string; revenue: number; cost: number; profit: number }[] =
    [];
  const cursor = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
  while (cursor <= periodEnd) {
    monthly.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: cursor.toLocaleDateString("en", { month: "short", year: "2-digit" }),
      revenue: 0,
      cost: 0,
      profit: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const idx = new Map(monthly.map((m, i) => [m.key, i]));
  for (const inv of eligible) {
    const d = new Date(inv.issue_date);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    const i = idx.get(k);
    if (i === undefined) continue;
    monthly[i].revenue += invoiceRevenue(inv);
    monthly[i].cost += Number(inv.direct_cost);
  }
  monthly.forEach((m) => (m.profit = m.revenue - m.cost));

  // Aging (as-of periodEnd)
  const aging = computeAging(invoices, paidMap, periodEnd).map((b) => ({
    label: b.label,
    amount: b.amount,
    count: b.count,
  }));

  // Service line breakdown
  const slMap = new Map(serviceLines.map((s) => [s.id, s]));
  const byLineMap = new Map<
    string,
    { name: string; recurring: boolean; total: number; cost: number }
  >();
  for (const inv of eligible) {
    if (!inv.service_line_id) continue;
    const sl = slMap.get(inv.service_line_id);
    if (!sl) continue;
    const cur = byLineMap.get(sl.id) ?? {
      name: sl.name,
      recurring: sl.is_recurring,
      total: 0,
      cost: 0,
    };
    cur.total += invoiceRevenue(inv);
    cur.cost += Number(inv.direct_cost);
    byLineMap.set(sl.id, cur);
  }
  const by_service_line = Array.from(byLineMap.values()).sort((a, b) => b.total - a.total);

  // Top debtors
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const debtorMap = new Map<string, { client: string; outstanding: number; oldest_days: number }>();
  const asOf = periodEnd.getTime();
  for (const inv of invoices) {
    if (inv.status === "void" || inv.status === "draft") continue;
    const out = invoiceOutstanding(inv, paidMap.get(inv.id) ?? 0);
    if (out <= 0.01) continue;
    const c = clientMap.get(inv.client_id);
    const name = c?.name ?? "Unknown";
    const days = Math.max(
      0,
      Math.floor((asOf - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)),
    );
    const cur = debtorMap.get(inv.client_id) ?? { client: name, outstanding: 0, oldest_days: 0 };
    cur.outstanding += out;
    cur.oldest_days = Math.max(cur.oldest_days, days);
    debtorMap.set(inv.client_id, cur);
  }
  const top_debtors = Array.from(debtorMap.values())
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 10);

  const base: FinanceReportSnapshot = {
    period_start: periodStart.toISOString().slice(0, 10),
    period_end: periodEnd.toISOString().slice(0, 10),
    currency,
    other_currency_invoices: otherCurrencyInvoices,
    kpis,
    invoice_count: eligible.length,
    generated_at: new Date().toISOString(),
  };

  // Include sections relevant to the type (but always keep KPIs)
  if (type === "monthly_financial" || type === "quarterly_executive") {
    base.monthly = monthly;
    base.by_service_line = by_service_line;
    base.aging = aging;
    base.top_debtors = top_debtors;
  } else if (type === "debtors_ageing") {
    base.aging = aging;
    base.top_debtors = top_debtors;
  } else if (type === "revenue_service_line") {
    base.by_service_line = by_service_line;
    base.monthly = monthly;
  }

  return base;
}

export function defaultPeriodFor(type: FinanceReportType, now = new Date()) {
  if (type === "quarterly_executive") {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3 - 3, 1);
    const end = new Date(now.getFullYear(), q * 3, 0);
    return { start, end };
  }
  // Previous month
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start, end };
}

export function defaultTitleFor(type: FinanceReportType, start: Date, end: Date) {
  const label = REPORT_TYPE_LABELS[type];
  const fmt = (d: Date) => d.toLocaleDateString("en", { month: "short", year: "numeric" });
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${label} — ${fmt(start)}`;
  }
  return `${label} — ${fmt(start)} to ${fmt(end)}`;
}
