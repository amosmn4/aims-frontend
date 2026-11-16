import type { BusinessFinance, Task } from "./data";

export type DashboardPeriod = "month" | "quarter" | "year" | "custom";
export type DateRange = { from: string; to: string };
export type FinanceTotals = { revenue: number; expenses: number; profit: number };

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const utcDate = (value: string) => new Date(`${value}T00:00:00Z`);

export function rangeForPeriod(
  period: Exclude<DashboardPeriod, "custom">,
  now = new Date(),
): DateRange {
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const start =
    period === "year"
      ? new Date(Date.UTC(now.getFullYear(), 0, 1))
      : period === "quarter"
        ? new Date(Date.UTC(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1))
        : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  return { from: dateKey(start), to: dateKey(end) };
}

export function previousDateRange(range: DateRange): DateRange {
  const start = utcDate(range.from);
  const end = utcDate(range.to);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const previousEnd = new Date(start.getTime() - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
  return { from: dateKey(previousStart), to: dateKey(previousEnd) };
}

export function inDateRange(date: string, range: DateRange) {
  return date >= range.from && date <= range.to;
}

export function financeForBusiness(rows: BusinessFinance[], businessId: string) {
  return businessId === "all" ? rows : rows.filter((row) => row.business === businessId);
}

export function totalsForRange(rows: BusinessFinance[], range: DateRange): FinanceTotals {
  const included = rows.filter((row) => inDateRange(row.date, range));
  const revenue = included.reduce((sum, row) => sum + row.revenue, 0);
  const expenses = included.reduce((sum, row) => sum + row.expenses, 0);
  return { revenue, expenses, profit: revenue - expenses };
}

export function financeTimeline(rows: BusinessFinance[], range: DateRange) {
  const start = utcDate(range.from);
  const end = utcDate(range.to);
  const months: { key: string; label: string; revenue: number; expenses: number }[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= end) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: cursor.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      revenue: 0,
      expenses: 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const row of rows) {
    if (!inDateRange(row.date, range)) continue;
    const month = months.find((entry) => entry.key === row.month);
    if (month) {
      month.revenue += row.revenue;
      month.expenses += row.expenses;
    }
  }
  return months;
}

export function tasksDueInRange(tasks: Task[], range: DateRange) {
  return tasks.filter((task) => inDateRange(task.due, range));
}

export function formatRange(range: DateRange) {
  const format = (date: string) =>
    utcDate(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${format(range.from)} – ${format(range.to)}`;
}
