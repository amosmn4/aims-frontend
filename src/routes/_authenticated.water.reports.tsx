import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  useWaterReportSummary,
  useWaterTrend,
  useWaterZoneComparison,
  useWaterAllZones,
  useWaterReadingSeries,
  useWaterReadingsWithDelta,
  WATER_METER_TYPE_LABELS,
  type WaterMeterType,
} from "@/features/water/use-water";
import { TermsHint, WithTerm, formatPeriodKey } from "@/features/water/water-ui";
import {
  GRANULARITY_WORD,
  TREND_PERIODS,
  periodLabel,
  recentPeriods,
  resolvePeriod,
  topSlices,
  WATER_SERIES,
  WATER_SERIES_DASH,
  type ChartGranularity,
} from "@/features/water/chart-periods";
import {
  ChartCaption,
  ChartState,
  GranularityToggle,
  PeriodPicker,
  PeriodTooltip,
  ZoneDonut,
} from "@/features/water/water-charts";
import { ComparisonCharts } from "@/features/water/comparison-charts";
import { WaterTables } from "@/features/water/water-tables";
import { NetworkDiagram } from "@/features/water/network-diagram";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter";
import { formatDateTime, formatMonth, formatWeekRange } from "@/lib/format-date";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/water/reports")({
  head: () => ({ meta: [{ title: "Water Project — Reports — AIMS" }] }),
  component: WaterReportsPage,
});

const ALL = "__all__";
const NRW_LIMIT = 8;

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Local YYYY-MM-DD, so today stays today regardless of UTC offset.
function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Date-only strings; the server treats dateTo as the whole day, so today is included.
function last30Days(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: localDate(from), to: localDate(to) };
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function pct(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}

function pctDelta(curr: number | null, prev: number | null): string | null {
  if (curr === null || prev === null) return null;
  const d = curr - prev;
  if (Math.abs(d) < 0.05) return null;
  return `${d > 0 ? "+" : ""}${d.toFixed(1)} points vs last month`;
}

function unitsDelta(curr: number, prev: number): string | null {
  if (prev === 0) return null;
  const d = ((curr - prev) / prev) * 100;
  if (Math.abs(d) < 0.5) return null;
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}% vs last month`;
}

function WaterReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [granularity, setGranularity] = useState<ChartGranularity>("month");
  const [weekKey, setWeekKey] = useState("");

  const weeks = useMemo(() => recentPeriods("week"), []);
  const week = resolvePeriod(weeks, weekKey);
  // Weekly charts cover the chosen week; monthly charts follow the Month box above.
  const chartWindow =
    granularity === "week"
      ? { dateFrom: week.dateFrom, dateTo: week.dateTo }
      : { month: month || currentMonth() };
  const windowLabel = granularity === "week" ? week.label : formatMonth(month || currentMonth());

  const summaryQ = useWaterReportSummary({ month });
  const trendQ = useWaterTrend({ granularity, periods: TREND_PERIODS[granularity] });
  const zoneCompQ = useWaterZoneComparison(chartWindow);
  const s = summaryQ.data;

  const trendData = (trendQ.data ?? []).map((p) => ({
    period: periodLabel(p.period, granularity),
    Main: p.main_total,
    "Zone bulk": p.bulk_total,
    Households: p.household_total,
  }));
  const zoneCompData = (zoneCompQ.data ?? []).map((z) => ({
    zone: z.zone_name,
    "Bulk meter (m³)": z.bulk_total,
    "Household meters (m³)": z.household_total,
  }));
  const zoneSlices = topSlices(
    zoneCompQ.data ?? [],
    (z) => z.household_total,
    (z) => z.zone_name,
  );
  const zoneSliceTotal = zoneSlices.reduce((sum, sl) => sum + sl.value, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Monthly figures for the water network: volumes, revenue, water loss by zone and meter reading comparisons."
        actions={
          <div>
            <Label htmlFor="report-period" className="text-xs">
              Month
            </Label>
            <Input
              id="report-period"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 w-40"
            />
          </div>
        }
      />
      <TermsHint terms={["nrw", "main", "bulk", "household", "m3"]} />

      {summaryQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : summaryQ.isError || !s ? (
        <LoadError
          what="the monthly report"
          error={summaryQ.error}
          onRetry={() => summaryQ.refetch()}
        />
      ) : (
        <>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold mb-2">
              Month summary — {formatPeriodKey(s.month)}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Measure</TableHead>
                    <TableHead className="text-right">This month</TableHead>
                    <TableHead className="text-right">Last month</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-sm">
                      <WithTerm term="main">Main meter volume (m³)</WithTerm>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono tabular-nums">
                      {fmt(s.dashboard.main_reading_total)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono tabular-nums text-muted-foreground">
                      {fmt(s.prev_dashboard.main_reading_total)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {unitsDelta(
                        s.dashboard.main_reading_total,
                        s.prev_dashboard.main_reading_total,
                      ) ?? "—"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">
                      <WithTerm term="bulk">Zone bulk meters total (m³)</WithTerm>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono tabular-nums">
                      {fmt(s.dashboard.bulk_reading_total)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono tabular-nums text-muted-foreground">
                      {fmt(s.prev_dashboard.bulk_reading_total)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {unitsDelta(
                        s.dashboard.bulk_reading_total,
                        s.prev_dashboard.bulk_reading_total,
                      ) ?? "—"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">
                      <WithTerm term="household">Household meters — water paid for (m³)</WithTerm>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono tabular-nums">
                      {fmt(s.dashboard.units_sold)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono tabular-nums text-muted-foreground">
                      {fmt(s.prev_dashboard.units_sold)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {unitsDelta(s.dashboard.units_sold, s.prev_dashboard.units_sold) ?? "—"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">
                      <WithTerm term="nrw">Non-revenue water (NRW)</WithTerm>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {s.dashboard.nrw_overall_pct !== null &&
                      s.dashboard.nrw_overall_pct > NRW_LIMIT ? (
                        <span className="text-destructive">
                          {pct(s.dashboard.nrw_overall_pct)} (high)
                        </span>
                      ) : (
                        <span className="text-success">{pct(s.dashboard.nrw_overall_pct)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {pct(s.prev_dashboard.nrw_overall_pct)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {pctDelta(s.dashboard.nrw_overall_pct, s.prev_dashboard.nrw_overall_pct) ??
                        "—"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">Revenue</TableCell>
                    <TableCell className="text-right text-sm font-mono tabular-nums">
                      KES {fmt(s.dashboard.revenue)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono tabular-nums text-muted-foreground">
                      KES {fmt(s.prev_dashboard.revenue)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {unitsDelta(s.dashboard.revenue, s.prev_dashboard.revenue) ?? "—"}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold mb-2">Meters in use</div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meter type</TableHead>
                    <TableHead className="text-right">Active (in use)</TableHead>
                    <TableHead className="text-right">Inactive (not in use)</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(["main", "bulk", "household"] as const).map((type) => {
                    const c = s.dashboard.meter_status[type];
                    return (
                      <TableRow key={type}>
                        <TableCell className="text-sm">
                          <WithTerm term={type}>{WATER_METER_TYPE_LABELS[type]}</WithTerm>
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono tabular-nums">
                          {c.active.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono tabular-nums text-muted-foreground">
                          {c.inactive.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono tabular-nums">
                          {(c.active + c.inactive).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Inactive meters are left out of active counts. Their past readings and sales still
              count in the months they happened.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold mb-2">Trends and insights</div>
            {s.insights.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">
                Not enough data yet to generate insights for this month.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {s.insights.map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {i === 0 ? (
                      <AlertTriangle
                        className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning"
                        aria-hidden="true"
                      />
                    ) : (
                      <ArrowUpRight
                        className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    )}
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
            <div>
              <div className="text-sm font-semibold">Charts and graphs</div>
              <p className="text-xs text-muted-foreground">
                Switch every chart below between weekly and monthly.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <GranularityToggle value={granularity} onChange={setGranularity} />
              {granularity === "week" && (
                <PeriodPicker
                  id="report-chart-week"
                  label="Week shown"
                  periods={weeks}
                  value={week.key}
                  onChange={setWeekKey}
                />
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold">
              Water through the network — last {TREND_PERIODS[granularity]}{" "}
              {GRANULARITY_WORD[granularity]}s
            </div>
            <ChartCaption>
              Water used in each {GRANULARITY_WORD[granularity]} (m³) — not the running total on the
              dial.
            </ChartCaption>
            <ChartState
              isLoading={trendQ.isLoading}
              isError={trendQ.isError}
              error={trendQ.error}
              onRetry={() => trendQ.refetch()}
              what="the trend"
              isEmpty={trendData.length === 0}
              emptyMessage="No readings recorded yet, so there is nothing to chart."
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={(v: number) => v.toLocaleString()}
                  />
                  <Tooltip content={<PeriodTooltip rows={trendData} />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="Main"
                    stroke={WATER_SERIES.main}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Zone bulk"
                    stroke={WATER_SERIES.bulk}
                    strokeDasharray={WATER_SERIES_DASH.bulk}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Households"
                    stroke={WATER_SERIES.household}
                    strokeDasharray={WATER_SERIES_DASH.household}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartState>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-semibold">Zone comparison — {windowLabel}</div>
              <ChartCaption>
                What each zone&apos;s bulk meter measured against what its households paid for (m³).
              </ChartCaption>
              <ChartState
                isLoading={zoneCompQ.isLoading}
                isError={zoneCompQ.isError}
                error={zoneCompQ.error}
                onRetry={() => zoneCompQ.refetch()}
                what="the zone comparison"
                isEmpty={zoneCompData.length === 0}
                emptyMessage="No zone figures for this period."
              >
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={zoneCompData} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="zone" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tickFormatter={(v: number) => v.toLocaleString()}
                    />
                    <Tooltip
                      content={<PeriodTooltip rows={zoneCompData} xKey="zone" showChange={false} />}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="Bulk meter (m³)"
                      fill={WATER_SERIES.main}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="Household meters (m³)"
                      fill={WATER_SERIES.household}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartState>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-semibold">Share of water paid for — {windowLabel}</div>
              <ChartCaption>
                How the {GRANULARITY_WORD[granularity]}&apos;s household water splits across zones.
              </ChartCaption>
              <ChartState
                isLoading={zoneCompQ.isLoading}
                isError={zoneCompQ.isError}
                error={zoneCompQ.error}
                onRetry={() => zoneCompQ.refetch()}
                what="the zone breakdown"
                isEmpty={zoneSlices.length === 0}
                emptyMessage="No household water recorded in this period."
                height={190}
              >
                <ZoneDonut
                  slices={zoneSlices}
                  total={zoneSliceTotal}
                  centreLabel={`m³ paid for this ${GRANULARITY_WORD[granularity]}`}
                />
              </ChartState>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold">Water loss by zone this month</div>
            <p className="text-xs text-muted-foreground mb-2">
              Loss is the zone&apos;s bulk meter volume minus what its households paid for and what
              its sub-zones&apos; bulk meters took. Above {NRW_LIMIT}% needs investigating.
            </p>
            {s.zone_loss.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">No zones yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone</TableHead>
                      <TableHead className="text-right">Bulk meter (m³)</TableHead>
                      <TableHead className="text-right">Households paid for (m³)</TableHead>
                      <TableHead className="text-right">Loss (m³)</TableHead>
                      <TableHead>Loss %</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.zone_loss.map((z) => (
                      <TableRow key={z.zone_id ?? "unzoned"}>
                        <TableCell className="text-sm">
                          {z.parent_zone_id ? `↳ ${z.zone_name}` : z.zone_name}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono tabular-nums">
                          {fmt(z.bulk_total)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono tabular-nums">
                          {fmt(z.household_total)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono tabular-nums">
                          {z.loss_pct !== null ? fmt(z.loss_units) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{pct(z.loss_pct)}</TableCell>
                        <TableCell>
                          {z.loss_pct === null ? (
                            <Badge variant="secondary">No bulk meter</Badge>
                          ) : z.loss_pct > NRW_LIMIT ? (
                            <Badge
                              className="bg-destructive/15 text-destructive"
                              variant="secondary"
                            >
                              Investigate
                            </Badge>
                          ) : (
                            <Badge className="bg-success/15 text-success" variant="secondary">
                              Normal
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}

      <ComparisonCharts />

      <NetworkDiagram />

      <WaterTables month={month} />

      <MeterReadingComparison />
    </div>
  );
}

const BUCKETS: { value: "day" | "week" | "month"; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function MeterReadingComparison() {
  const [meterType, setMeterType] = useState<WaterMeterType>("main");
  const [zoneId, setZoneId] = useState("");
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");
  const [range, setRange] = useState<DateRange>(last30Days());

  const allZonesQ = useWaterAllZones();
  // "All time" gives an empty range — fall back to a wide window so queries return something.
  const dateFrom = range.from ?? "2000-01-01";
  const dateTo = range.to ?? localDate(new Date());

  const seriesQ = useWaterReadingSeries({
    meterType,
    zoneId: meterType === "bulk" ? zoneId || undefined : undefined,
    bucket,
    dateFrom,
    dateTo,
  });
  const readingsQ = useWaterReadingsWithDelta({
    meterType,
    zoneId: meterType === "bulk" ? zoneId || undefined : undefined,
    dateFrom,
    dateTo,
  });

  const series = seriesQ.data ?? [];
  const chartData = series.map((p) => ({
    period:
      bucket === "week"
        ? formatWeekRange(p.period)
        : bucket === "month"
          ? formatMonth(p.period)
          : formatPeriodKey(p.period),
    "Used (m³)": p.usage,
  }));
  const totalUsage = series.reduce((sum, p) => sum + p.usage, 0);
  const readingCount = series.reduce((sum, p) => sum + p.reading_count, 0);
  const bucketWord = bucket === "day" ? "day" : bucket === "week" ? "week" : "month";

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">
            {meterType === "main" ? "Main meter" : "Zone bulk meter"} readings — by {bucketWord}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each figure is how much the dial moved since the previous reading — the water that
            actually passed through.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-36">
            <Label htmlFor="compare-meter" className="text-xs">
              Meter
            </Label>
            <Select value={meterType} onValueChange={(v) => setMeterType(v as WaterMeterType)}>
              <SelectTrigger id="compare-meter" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">{WATER_METER_TYPE_LABELS.main}</SelectItem>
                <SelectItem value="bulk">{WATER_METER_TYPE_LABELS.bulk}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {meterType === "bulk" && (
            <div className="w-40">
              <Label htmlFor="compare-zone" className="text-xs">
                Zone
              </Label>
              <Select value={zoneId || ALL} onValueChange={(v) => setZoneId(v === ALL ? "" : v)}>
                <SelectTrigger id="compare-zone" className="h-9">
                  <SelectValue placeholder="All zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All zones</SelectItem>
                  {(allZonesQ.data ?? []).map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.parent_zone_id ? `↳ ${z.name}` : z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="w-32">
            <Label htmlFor="compare-bucket" className="text-xs">
              Group by
            </Label>
            <Select value={bucket} onValueChange={(v) => setBucket(v as typeof bucket)}>
              <SelectTrigger id="compare-bucket" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUCKETS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="max-w-full overflow-x-auto">
            <span className="block text-xs font-medium">Period</span>
            <DateRangeFilter value={range} onChange={setRange} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartState
            isLoading={seriesQ.isLoading}
            isError={seriesQ.isError}
            error={seriesQ.error}
            onRetry={() => seriesQ.refetch()}
            what="the reading comparison"
            isEmpty={chartData.length === 0}
            emptyMessage="No readings in this period."
            height={240}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v: number) => v.toLocaleString()}
                />
                <Tooltip content={<PeriodTooltip rows={chartData} />} cursor={{ opacity: 0.1 }} />
                <Bar
                  dataKey="Used (m³)"
                  fill={WATER_SERIES.main}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartState>
        </div>
        <div className="rounded-md bg-secondary/40 p-3 flex flex-col justify-center">
          <div className="text-xs text-muted-foreground">Total used in this period</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{fmt(totalUsage)} m³</div>
          <div className="text-xs text-muted-foreground mt-2">
            From {readingCount} reading{readingCount === 1 ? "" : "s"} across {series.length}{" "}
            {bucketWord}
            {series.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Reading log</div>
        {readingsQ.isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : readingsQ.isError ? (
          <LoadError what="readings" error={readingsQ.error} onRetry={() => readingsQ.refetch()} />
        ) : (readingsQ.data ?? []).length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">
            No readings logged in this period.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border max-h-80 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Date & time</TableHead>
                  <TableHead>Meter</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead className="text-right">Reading (m³)</TableHead>
                  <TableHead className="text-right">Used since last (m³)</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(readingsQ.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateTime(r.reading_date)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-mono">{r.meter_number}</span>
                      {r.meter_name ? ` — ${r.meter_name}` : ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.zone_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono tabular-nums">
                      {fmt(r.value)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono tabular-nums">
                      {r.delta === null ? (
                        <span className="text-muted-foreground">First reading</span>
                      ) : (
                        `+${fmt(r.delta)}`
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
