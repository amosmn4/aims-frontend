import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useWaterMeterSeries,
  useWaterZoneSeries,
  WATER_MAIN_STAGE_LABELS,
  type WaterMeterSeries,
  type WaterZoneSeriesRow,
} from "@/features/water/use-water";
import {
  formatUnits,
  GRANULARITY_WORD,
  OVERLAY_SERIES,
  periodLabel,
  readingDomain,
  runningTotal,
  TREND_PERIODS,
  ZONE_COLORS,
  type ChartGranularity,
} from "@/features/water/chart-periods";
import {
  ChartCaption,
  ChartLegend,
  ChartState,
  GranularityToggle,
  PeriodTooltip,
  type ChartSeriesKey,
} from "@/features/water/water-charts";
import { SectionHeading } from "@/components/section-heading";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** How many entities can hold a colour of their own before the rest are left off. */
const MAX_SERIES = ZONE_COLORS.length;

const CHART_HEIGHT = 260;

type ChartRow = Record<string, string | number>;

type ZoneMeasure = "bulk" | "household";

const MEASURE_LABELS: Record<ZoneMeasure, string> = {
  bulk: "Bulk meters",
  household: "Households",
};

/** Keeps every series name distinct so two zones or meters never share a data key. */
function uniqueKeys(names: string[]): string[] {
  const used = new Map<string, number>();
  return names.map((name) => {
    const seen = used.get(name) ?? 0;
    used.set(name, seen + 1);
    return seen === 0 ? name : `${name} (${seen + 1})`;
  });
}

function totalOf(values: number[]): number {
  return values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
}

function ComparisonCard({
  title,
  caption,
  controls,
  children,
}: {
  title: string;
  caption: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        {controls}
      </div>
      <ChartCaption>{caption}</ChartCaption>
      {children}
    </div>
  );
}

const AXIS_TICK = { fontSize: 11 } as const;

function unitsAxisProps(width = 52) {
  return {
    yAxisId: "left" as const,
    tick: AXIS_TICK,
    axisLine: false,
    tickLine: false,
    width,
    tickFormatter: (v: number) => v.toLocaleString(),
  };
}

/** Zone comparison and meter comparison, both following one Weekly / Monthly switch. */
export function ComparisonCharts() {
  const [granularity, setGranularity] = useState<ChartGranularity>("month");
  const periods = TREND_PERIODS[granularity];

  return (
    <section className="space-y-3">
      <SectionHeading action={<GranularityToggle value={granularity} onChange={setGranularity} />}>
        Comparisons
      </SectionHeading>
      <ZoneComparisonChart granularity={granularity} periods={periods} />
      <MeterComparisonChart granularity={granularity} periods={periods} />
    </section>
  );
}

function ZoneComparisonChart({
  granularity,
  periods,
}: {
  granularity: ChartGranularity;
  periods: number;
}) {
  const [measure, setMeasure] = useState<ZoneMeasure>("bulk");
  const seriesQ = useWaterZoneSeries({ granularity, periods });

  const { rows, series, hiddenCount } = useMemo(() => {
    const data = seriesQ.data;
    if (!data) return { rows: [] as ChartRow[], series: [] as ChartSeriesKey[], hiddenCount: 0 };

    // Colour follows the zone's own place in the list, never its size this period.
    const shown = data.zones.slice(0, MAX_SERIES);
    const names = uniqueKeys(
      shown.map((z: WaterZoneSeriesRow) => (z.parent_zone_id ? `↳ ${z.zone_name}` : z.zone_name)),
    );
    const valueOf = (z: WaterZoneSeriesRow, i: number) =>
      measure === "bulk" ? z.points[i]?.bulk_units : z.points[i]?.household_units;

    const chartRows: ChartRow[] = data.periods.map((period, i) => {
      const row: ChartRow = { period: periodLabel(period, granularity) };
      shown.forEach((z, zi) => {
        row[names[zi]] = valueOf(z, i) ?? 0;
      });
      row.Revenue = totalOf(shown.map((z) => z.points[i]?.revenue ?? 0));
      return row;
    });

    const keys: ChartSeriesKey[] = shown.map((z, i) => ({
      key: names[i],
      label: names[i],
      color: ZONE_COLORS[i],
      shape: "bar",
    }));
    keys.push({
      key: "Revenue",
      label: "Revenue (KES)",
      color: OVERLAY_SERIES.color,
      shape: "line",
      dash: OVERLAY_SERIES.dash,
    });

    return {
      rows: chartRows,
      series: keys,
      hiddenCount: Math.max(data.zones.length - shown.length, 0),
    };
  }, [seriesQ.data, measure, granularity]);

  const barKeys = series.filter((s) => s.shape === "bar");
  const isEmpty =
    rows.length === 0 ||
    barKeys.every((s) => totalOf(rows.map((r) => Number(r[s.key]) || 0)) === 0);

  return (
    <ComparisonCard
      title={`Zone comparison — last ${periods} ${GRANULARITY_WORD[granularity]}s`}
      caption={
        <>
          {MEASURE_LABELS[measure]} per zone (m³) with revenue (KES).
          {hiddenCount > 0 && ` First ${MAX_SERIES} zones shown.`}
        </>
      }
      controls={
        <Tabs value={measure} onValueChange={(v) => setMeasure(v as ZoneMeasure)}>
          <TabsList className="h-8" aria-label="Compare bulk meters or households">
            {(["bulk", "household"] as const).map((m) => (
              <TabsTrigger key={m} value={m} className="px-3 py-1 text-xs">
                {MEASURE_LABELS[m]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
    >
      <ChartState
        isLoading={seriesQ.isLoading}
        isError={seriesQ.isError}
        error={seriesQ.error}
        onRetry={() => seriesQ.refetch()}
        what="the zone comparison"
        isEmpty={isEmpty}
        emptyMessage="No zone figures in these periods."
        height={CHART_HEIGHT}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ComposedChart data={rows} margin={{ top: 8, right: 4, left: -6, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="period"
              tick={AXIS_TICK}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis {...unitsAxisProps()} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={58}
              tickFormatter={(v: number) => v.toLocaleString()}
            />
            <Tooltip
              content={<PeriodTooltip rows={rows} units={{ Revenue: "KES" }} />}
              cursor={{ opacity: 0.08 }}
            />
            {barKeys.map((s) => (
              <Bar
                key={s.key}
                yAxisId="left"
                dataKey={s.key}
                name={s.key}
                fill={s.color}
                radius={[3, 3, 0, 0]}
                maxBarSize={18}
              />
            ))}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Revenue"
              name="Revenue (KES)"
              stroke={OVERLAY_SERIES.color}
              strokeDasharray={OVERLAY_SERIES.dash}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <ChartLegend items={series} />
      </ChartState>
    </ComparisonCard>
  );
}

/** The meter the running-total line follows: the tank outlet, else the borehole. */
function inputMeterOf(meters: WaterMeterSeries[]): WaterMeterSeries | undefined {
  return (
    meters.find((m) => m.main_stage === "tank_to_network") ??
    meters.find((m) => m.main_stage === "borehole_to_tank") ??
    meters.find((m) => m.meter_type === "main") ??
    meters[0]
  );
}

function meterLabel(m: WaterMeterSeries): string {
  if (m.meter_type === "main") {
    return m.main_stage ? `${m.label} · ${WATER_MAIN_STAGE_LABELS[m.main_stage]}` : m.label;
  }
  return m.zone_name ? `${m.label} · ${m.zone_name}` : m.label;
}

function MeterComparisonChart({
  granularity,
  periods,
}: {
  granularity: ChartGranularity;
  periods: number;
}) {
  const seriesQ = useWaterMeterSeries({ granularity, periods });

  const { rows, series, totalKey, totalDomain, hiddenCount } = useMemo(() => {
    const data = seriesQ.data;
    const empty = {
      rows: [] as ChartRow[],
      series: [] as ChartSeriesKey[],
      totalKey: "",
      totalDomain: [0, 1] as [number, number],
      hiddenCount: 0,
    };
    if (!data) return empty;

    // Main meters first, so the borehole reads against the zones that drew from it.
    const ordered = [...data.meters].sort((a, b) =>
      a.meter_type === b.meter_type ? 0 : a.meter_type === "main" ? -1 : 1,
    );
    const shown = ordered.slice(0, MAX_SERIES);
    const names = uniqueKeys(shown.map(meterLabel));

    const input = inputMeterOf(ordered);
    const cumulative = input
      ? runningTotal(data.periods.map((_, i) => input.points[i]?.units ?? 0))
      : [];
    const key = input ? `${input.label} — running total` : "";

    const chartRows: ChartRow[] = data.periods.map((period, i) => {
      const row: ChartRow = { period: periodLabel(period, granularity) };
      shown.forEach((m, mi) => {
        row[names[mi]] = m.points[i]?.units ?? 0;
      });
      if (key) row[key] = cumulative[i] ?? 0;
      return row;
    });

    const keys: ChartSeriesKey[] = shown.map((m, i) => ({
      key: names[i],
      label: names[i],
      color: ZONE_COLORS[i],
      shape: "bar",
    }));
    if (key) {
      keys.push({
        key,
        label: key,
        color: OVERLAY_SERIES.color,
        shape: "line",
        dash: OVERLAY_SERIES.dash,
      });
    }

    return {
      rows: chartRows,
      series: keys,
      totalKey: key,
      // Fit the axis to the running total, which a zero-based axis would flatten.
      totalDomain: readingDomain(cumulative),
      hiddenCount: Math.max(ordered.length - shown.length, 0),
    };
  }, [seriesQ.data, granularity]);

  const barKeys = series.filter((s) => s.shape === "bar");
  const isEmpty =
    rows.length === 0 ||
    barKeys.every((s) => totalOf(rows.map((r) => Number(r[s.key]) || 0)) === 0);

  return (
    <ComparisonCard
      title={`Meter comparison — last ${periods} ${GRANULARITY_WORD[granularity]}s`}
      caption={
        <>
          Each main and bulk meter&apos;s water per {GRANULARITY_WORD[granularity]} (m³), with the
          network&apos;s running total.
          {hiddenCount > 0 && ` First ${MAX_SERIES} meters shown.`}
        </>
      }
    >
      <ChartState
        isLoading={seriesQ.isLoading}
        isError={seriesQ.isError}
        error={seriesQ.error}
        onRetry={() => seriesQ.refetch()}
        what="the meter comparison"
        isEmpty={isEmpty}
        emptyMessage="No main or bulk meter readings in these periods."
        height={CHART_HEIGHT}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ComposedChart data={rows} margin={{ top: 8, right: 4, left: -6, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="period"
              tick={AXIS_TICK}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis {...unitsAxisProps()} />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={totalDomain}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={62}
              tickFormatter={(v: number) => formatUnits(v)}
            />
            <Tooltip content={<PeriodTooltip rows={rows} />} cursor={{ opacity: 0.08 }} />
            {barKeys.map((s) => (
              <Bar
                key={s.key}
                yAxisId="left"
                dataKey={s.key}
                name={s.key}
                fill={s.color}
                radius={[3, 3, 0, 0]}
                maxBarSize={18}
              />
            ))}
            {totalKey ? (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey={totalKey}
                name={totalKey}
                stroke={OVERLAY_SERIES.color}
                strokeDasharray={OVERLAY_SERIES.dash}
                strokeWidth={2}
                dot={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
        <ChartLegend items={series} />
      </ChartState>
    </ComparisonCard>
  );
}
