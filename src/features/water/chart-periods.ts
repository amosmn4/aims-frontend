import { formatMonth, formatWeekRange } from "@/lib/format-date";

/** Weekly or monthly — the view every water chart on a page follows. */
export type ChartGranularity = "week" | "month";

export const GRANULARITY_LABELS: Record<ChartGranularity, string> = {
  week: "Weekly",
  month: "Monthly",
};

/** Singular word for captions, e.g. "used this week". */
export const GRANULARITY_WORD: Record<ChartGranularity, string> = {
  week: "week",
  month: "month",
};

/** How far back each view looks. */
export const TREND_PERIODS: Record<ChartGranularity, number> = { week: 12, month: 6 };

export interface ChartPeriod {
  /** "2026-09-14" for a week (its Monday) or "2026-09" for a month. */
  key: string;
  label: string;
  /** Inclusive YYYY-MM-DD window, for date-range queries. */
  dateFrom: string;
  dateTo: string;
  /** The month this period sits in, for month-only endpoints. */
  month: string;
}

/** Local YYYY-MM-DD, so today stays today regardless of UTC offset. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Monday of the week the date falls in. Matches the backend's week buckets. */
export function weekStart(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** The week or month key a timestamp falls in. */
export function periodKeyOf(value: string | Date, granularity: ChartGranularity): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return granularity === "week" ? localDate(weekStart(d)) : monthKey(d);
}

/** "15–21 Sep" for a week key, "Sep 2026" for a month key. */
export function periodLabel(key: string, granularity: ChartGranularity): string {
  return granularity === "week" ? formatWeekRange(key) : formatMonth(key);
}

/** The last N weeks or months, oldest first — matches what the trend endpoint returns. */
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

/** The period matching a key, or the most recent one when the key is from the other view. */
export function resolvePeriod(periods: ChartPeriod[], key: string): ChartPeriod {
  return periods.find((p) => p.key === key) ?? periods[periods.length - 1];
}

/**
 * Meter dials read in the tens of thousands, so a zero-based axis flattens months
 * of real movement. Fit the axis to the data instead, with ~10% breathing room.
 */
export function readingDomain(values: number[]): [number, number] {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return [0, 1];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const pad = Math.max((max - min) * 0.1, Math.abs(max) * 0.002, 1);
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

/** Whole numbers with thousands separators, e.g. "19,300". */
export function formatUnits(n: number): string {
  return Math.round(n).toLocaleString();
}

/** "+612" / "−40", for a change against the previous period. */
export function formatChange(n: number): string {
  return `${n < 0 ? "−" : "+"}${Math.abs(Math.round(n)).toLocaleString()}`;
}

/** Brand series colours: water in, water into zones, water paid for. */
export const WATER_SERIES = {
  main: "#0F7A78",
  bulk: "#B9762A",
  household: "#2E8B57",
} as const;

/** Dash patterns so the three flow series stay apart without relying on colour. */
export const WATER_SERIES_DASH = {
  main: undefined,
  bulk: "6 3",
  household: "2 3",
} as const;

/** Validated categorical order for zone slices — never cycled, extras fold into "Other". */
export const ZONE_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#4a3aa7",
] as const;

export const OTHER_ZONES_COLOR = "#7a7a72";

/** Top slices by size, with the tail folded into one "Other zones" slice. */
export function topSlices<T>(
  rows: T[],
  value: (row: T) => number,
  name: (row: T) => string,
  max = ZONE_COLORS.length,
): { name: string; value: number; color: string }[] {
  const sorted = [...rows].filter((r) => value(r) > 0).sort((a, b) => value(b) - value(a));
  const head: { name: string; value: number; color: string }[] = sorted
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
