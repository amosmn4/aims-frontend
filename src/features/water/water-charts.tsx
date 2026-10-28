import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  formatChange,
  formatUnits,
  GRANULARITY_LABELS,
  type ChartGranularity,
  type ChartPeriod,
} from "@/features/water/chart-periods";
import { LoadError } from "@/components/load-error";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Weekly / Monthly switch that every chart on the page follows. */
export function GranularityToggle({
  value,
  onChange,
  label = "View",
  className,
}: {
  value: ChartGranularity;
  onChange: (value: ChartGranularity) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <Tabs value={value} onValueChange={(v) => onChange(v as ChartGranularity)}>
        <TabsList className="h-8" aria-label="Show the charts weekly or monthly">
          {(["week", "month"] as const).map((g) => (
            <TabsTrigger key={g} value={g} className="px-3 py-1 text-xs">
              {GRANULARITY_LABELS[g]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

/** Picks which week or month the breakdown charts cover. */
export function PeriodPicker({
  periods,
  value,
  onChange,
  id,
  label,
}: {
  periods: ChartPeriod[];
  value: string;
  onChange: (key: string) => void;
  id: string;
  label: string;
}) {
  return (
    <div className="w-40">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[...periods].reverse().map((p) => (
            <SelectItem key={p.key} value={p.key}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** One loading / failed / empty treatment for every water chart. */
export function ChartState({
  isLoading,
  isError,
  error,
  onRetry,
  what,
  isEmpty,
  emptyMessage,
  height = 230,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  what: string;
  isEmpty: boolean;
  emptyMessage: string;
  height?: number;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }
  if (isError) return <LoadError what={what} error={error} onRetry={onRetry} />;
  if (isEmpty) {
    return (
      <div
        className="flex items-center justify-center text-center text-xs text-muted-foreground"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }
  return <>{children}</>;
}

/** Plain-words line saying what the numbers on the chart actually are. */
export function ChartCaption({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs text-muted-foreground">{children}</p>;
}

type TooltipEntry = {
  name?: string | number;
  dataKey?: string | number;
  value?: number;
  color?: string;
};

type TooltipRow = Record<string, string | number | undefined>;

/**
 * Exact values with thousands separators, plus the change against the period before.
 * Recharts clones this with active/payload/label.
 */
export function PeriodTooltip({
  active,
  payload,
  label,
  rows,
  xKey = "period",
  unit = "m³",
  units,
  showChange = true,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  rows?: TooltipRow[];
  xKey?: string;
  unit?: string;
  /** Per-series unit, for a combo chart whose series aren't all measured the same way. */
  units?: Record<string, string>;
  /** Off when the axis isn't time, so rows aren't compared to an unrelated neighbour. */
  showChange?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const index = rows && showChange ? rows.findIndex((r) => r[xKey] === label) : -1;
  const previous = index > 0 ? rows?.[index - 1] : undefined;
  const unitFor = (key: string) => units?.[key] ?? unit;

  return (
    <div className="rounded-lg border bg-card p-2.5 text-xs shadow-sm">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? entry.name ?? "");
          const before = previous?.[key];
          const change =
            typeof entry.value === "number" && typeof before === "number"
              ? entry.value - before
              : null;
          return (
            <div key={key} className="flex items-baseline gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: entry.color }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground">{entry.name ?? key}</span>
              <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">
                {typeof entry.value === "number" ? formatUnits(entry.value) : "—"}
                {unitFor(key) ? ` ${unitFor(key)}` : ""}
              </span>
            </div>
          );
        })}
      </div>
      {previous && (
        <div className="mt-1.5 border-t pt-1.5 text-muted-foreground">
          {payload.map((entry) => {
            const key = String(entry.dataKey ?? entry.name ?? "");
            const before = previous[key];
            if (typeof entry.value !== "number" || typeof before !== "number") return null;
            return (
              <div key={key} className="tabular-nums">
                {formatChange(entry.value - before)} {unitFor(key)} vs{" "}
                {String(previous[xKey] ?? "before")}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SliceTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { name?: string | number; value?: number }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0];
  const share = total > 0 && typeof slice.value === "number" ? (slice.value / total) * 100 : 0;
  return (
    <div className="rounded-lg border bg-card p-2.5 text-xs shadow-sm">
      <div className="font-medium text-foreground">{slice.name}</div>
      <div className="mt-0.5 tabular-nums text-muted-foreground">
        {formatUnits(slice.value ?? 0)} m³ · {share.toFixed(1)}% of the period
      </div>
    </div>
  );
}

/** Share of the period's water by zone — a donut with a named, numbered legend. */
export function ZoneDonut({
  slices,
  total,
  centreLabel,
}: {
  slices: { name: string; value: number; color: string }[];
  total: number;
  centreLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-[190px] w-[190px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={2}
              stroke="var(--color-card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip content={<SliceTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-semibold tabular-nums">{formatUnits(total)}</span>
          <span className="max-w-24 text-[10px] leading-tight text-muted-foreground">
            {centreLabel}
          </span>
        </div>
      </div>
      <ul className="min-w-45 flex-1 space-y-1 text-xs">
        {slices.map((s) => (
          <li key={s.name} className="flex items-baseline gap-2">
            <span
              className="h-2 w-2 shrink-0 translate-y-px rounded-full"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="truncate text-muted-foreground">{s.name}</span>
            <span className="ml-auto shrink-0 tabular-nums text-foreground">
              {formatUnits(s.value)} m³
            </span>
            <span className="w-11 shrink-0 text-right tabular-nums text-muted-foreground">
              {total > 0 ? ((s.value / total) * 100).toFixed(0) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ChartSeriesKey {
  key: string;
  label: string;
  color: string;
  shape: "bar" | "line";
  dash?: string;
}

/** Legend keyed by mark shape as well as colour, so series never rely on hue alone. */
export function ChartLegend({ items }: { items: ChartSeriesKey[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          {s.shape === "bar" ? (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: s.color }}
              aria-hidden="true"
            />
          ) : (
            <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden="true" className="shrink-0">
              <line
                x1="0"
                y1="4"
                x2="16"
                y2="4"
                stroke={s.color}
                strokeWidth="2"
                strokeDasharray={s.dash}
              />
            </svg>
          )}
          <span>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}
