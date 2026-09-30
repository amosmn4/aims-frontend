export function formatCurrency(amount: number | null | undefined, currency = "KES") {
  const v = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${currency} ${v.toLocaleString()}`;
  }
}

export function formatNumber(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString();
}

export function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  client_id: string;
  service_line_id: string | null;
  contract_id: string | null;
  issue_date: string;
  due_date: string;
  currency_code: string;
  subtotal: number;
  tax: number;
  total: number;
  direct_cost: number;
  status: string;
  is_recurring: boolean;
  notes: string | null;
  project_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
};

export type PaymentRow = {
  id: string;
  invoice_id: string;
  paid_on: string;
  amount: number;
  method: string | null;
  reference: string | null;
};

export function isVoidInvoice(inv: Pick<InvoiceRow, "status">) {
  return inv.status === "void";
}

// Billed = counts toward revenue: not a draft and not void.
export function isBilledInvoice(inv: Pick<InvoiceRow, "status">) {
  return inv.status !== "draft" && inv.status !== "void";
}

// Revenue excludes VAT, so it is the amount before tax. Void invoices earn nothing.
export function invoiceRevenue(inv: Pick<InvoiceRow, "status" | "subtotal">) {
  return inv.status === "void" ? 0 : Number(inv.subtotal);
}

export interface AgingBucket {
  label: string;
  min: number;
  max: number | null;
  amount: number;
  count: number;
}

export function computeAging(
  invoices: InvoiceRow[],
  paymentsByInvoice: Map<string, number>,
  today = new Date(),
): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { label: "Current", min: 0, max: 0, amount: 0, count: 0 },
    { label: "1-30 days", min: 1, max: 30, amount: 0, count: 0 },
    { label: "31-60 days", min: 31, max: 60, amount: 0, count: 0 },
    { label: "61-90 days", min: 61, max: 90, amount: 0, count: 0 },
    { label: "90+ days", min: 91, max: null, amount: 0, count: 0 },
  ];

  for (const inv of invoices) {
    if (inv.status === "paid" || isVoidInvoice(inv)) continue;
    const paid = paymentsByInvoice.get(inv.id) ?? 0;
    const outstanding = Number(inv.total) - paid;
    if (outstanding <= 0.01) continue;
    const due = new Date(inv.due_date);
    const days = daysBetween(today, due);
    const bucket = buckets.find((b) => days >= b.min && (b.max === null || days <= b.max));
    if (bucket) {
      bucket.amount += outstanding;
      bucket.count += 1;
    } else if (days < 0) {
      buckets[0].amount += outstanding;
      buckets[0].count += 1;
    }
  }
  return buckets;
}

export function invoiceOutstanding(inv: InvoiceRow, paidTotal: number) {
  if (inv.status === "void") return 0;
  return Math.max(0, Number(inv.total) - paidTotal);
}

export function invoiceStatus(inv: InvoiceRow, paidTotal: number, today = new Date()) {
  if (inv.status === "void") return "void";
  if (inv.status === "draft") return "draft";
  const outstanding = invoiceOutstanding(inv, paidTotal);
  if (outstanding <= 0.01) return "paid";
  if (paidTotal > 0) return "partial";
  if (new Date(inv.due_date) < today) return "overdue";
  return "sent";
}

export const STATUS_STYLES: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  sent: "bg-primary/10 text-primary",
  partial: "bg-warning/15 text-warning",
  paid: "bg-success/15 text-success",
  overdue: "bg-destructive/15 text-destructive",
  void: "bg-muted text-muted-foreground",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

/* ---------- Payables (unpaid expenses) ---------- */

type PayableLike = {
  status: string;
  amount: number;
  due_date: string | null;
  expense_date: string;
};

// When a bill has no due date, assume it is due 30 days after the expense date.
export function expenseDueDate(e: Pick<PayableLike, "due_date" | "expense_date">) {
  if (e.due_date) return new Date(e.due_date);
  const d = new Date(e.expense_date);
  d.setDate(d.getDate() + 30);
  return d;
}

export function computePayablesAging(expenses: PayableLike[], today = new Date()): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { label: "Current", min: 0, max: 0, amount: 0, count: 0 },
    { label: "1-30 days", min: 1, max: 30, amount: 0, count: 0 },
    { label: "31-60 days", min: 31, max: 60, amount: 0, count: 0 },
    { label: "61-90 days", min: 61, max: 90, amount: 0, count: 0 },
    { label: "90+ days", min: 91, max: null, amount: 0, count: 0 },
  ];
  for (const e of expenses) {
    if (e.status !== "unpaid") continue;
    const days = daysBetween(today, expenseDueDate(e));
    const bucket =
      buckets.find((b) => days >= b.min && (b.max === null || days <= b.max)) ?? buckets[0];
    bucket.amount += Number(e.amount);
    bucket.count += 1;
  }
  return buckets;
}

/* ---------- Monthly recurring revenue ---------- */

type MrrContract = {
  status: string;
  billing_frequency: string;
  start_date: string;
  end_date: string | null;
  value: number;
};

const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, annual: 12 };

export function contractTermMonths(startDate: string, endDate: string) {
  const days = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000;
  return Math.max(1, Math.round(days / 30.4375));
}

// Active recurring contracts: whole-term value spread per month, else value per billing period.
export function monthlyRecurringRevenue(contracts: MrrContract[]) {
  let mrr = 0;
  for (const c of contracts) {
    if (c.status !== "active" || c.billing_frequency === "one_off") continue;
    const value = Number(c.value) || 0;
    if (c.end_date) mrr += value / contractTermMonths(c.start_date, c.end_date);
    else mrr += value / (PERIOD_MONTHS[c.billing_frequency] ?? 1);
  }
  return mrr;
}
