import { formatMonth, formatWeekRange } from "@/production/lib/format-date";
export type ChartGranularity = "week" | "month";
export const GRANULARITY_LABELS: Record<ChartGranularity, string> = {
  week: "Weekly",
  month: "Monthly",
};
export const GRANULARITY_WORD: Record<ChartGranularity, string> = {
  week: "week",
  month: "month",
};
export const TREND_PERIODS: Record<ChartGranularity, number> = { week: 12, month: 6 };
export interface ChartPeriod {
  key: string;
  label: string;
  dateFrom: string;
  dateTo: string;
  month: string;
}
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function weekStart(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}
export function periodKeyOf(value: string | Date, granularity: ChartGranularity): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return granularity === "week" ? localDate(weekStart(d)) : monthKey(d);
}
export function periodLabel(key: string, granularity: ChartGranularity): string {
  return granularity === "week" ? formatWeekRange(key) : formatMonth(key);
}
export function recentPeriods(
  granularity: ChartGranularity,
  count = TREND_PERIODS[granularity],
): ChartPeriod[] {
  const periods: ChartPeriod[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    if (granularity === "week") {
      const start = weekStart(now);
      start.setDate(start.getDate() - 7 * i);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const key = localDate(start);
      periods.push({
        key,
        label: periodLabel(key, "week"),
        dateFrom: key,
        dateTo: localDate(end),
        month: monthKey(start),
      });
    } else {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const key = monthKey(start);
      periods.push({
        key,
        label: periodLabel(key, "month"),
        dateFrom: localDate(start),
        dateTo: localDate(end),
        month: key,
      });
    }
  }
  return periods;
}
export function resolvePeriod(periods: ChartPeriod[], key: string): ChartPeriod {
  const period = periods.find((p) => p.key === key) ?? periods[periods.length - 1];
  if (!period) throw new Error("Choose an available reporting period.");
  return period;
}
export function readingDomain(values: number[]): [number, number] {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return [0, 1];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const pad = Math.max((max - min) * 0.1, Math.abs(max) * 0.002, 1);
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}
export function formatUnits(n: number): string {
  return Math.round(n).toLocaleString();
}
export function formatChange(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(Math.round(n)).toLocaleString()}`;
}
export const WATER_SERIES = {
  main: "#0F7A78",
  bulk: "#B9762A",
  household: "#2E8B57",
} as const;
export const WATER_SERIES_DASH = {
  main: undefined,
  bulk: "6 3",
  household: "2 3",
} as const;
export const ZONE_COLORS = [
  "var(--chart-zone-1)",
  "var(--chart-zone-2)",
  "var(--chart-zone-3)",
  "var(--chart-zone-4)",
  "var(--chart-zone-5)",
  "var(--chart-zone-6)",
] as const;
export const OTHER_ZONES_COLOR = "var(--chart-zone-other)";
export function topSlices<T>(
  rows: T[],
  value: (row: T) => number,
  name: (row: T) => string,
  max = ZONE_COLORS.length,
): {
  name: string;
  value: number;
  color: string;
}[] {
  const sorted = [...rows].filter((r) => value(r) > 0).sort((a, b) => value(b) - value(a));
  const head: {
    name: string;
    value: number;
    color: string;
  }[] = sorted
    .slice(0, max)
    .map((r, i) => ({ name: name(r), value: value(r), color: ZONE_COLORS[i] as string }));
  const tail = sorted.slice(max);
  if (tail.length > 0) {
    head.push({
      name: `Other zones (${tail.length})`,
      value: tail.reduce((sum, r) => sum + value(r), 0),
      color: OTHER_ZONES_COLOR,
    });
  }
  return head;
}
export const OVERLAY_SERIES = {
  color: "var(--color-foreground)",
  dash: "5 4",
} as const;
export function formatMoney(n: number): string {
  return `KES ${Math.round(n).toLocaleString()}`;
}
export function runningTotal(values: number[]): number[] {
  let sum = 0;
  return values.map((v) => (sum += Number.isFinite(v) ? v : 0));
}
