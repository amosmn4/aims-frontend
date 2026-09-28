import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  TrendingDown,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
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
  useWaterDashboard,
  useWaterTrend,
  useWaterZoneComparison,
  useWaterAllZones,
  useCanManageWater,
} from "@/features/water/use-water";
import { TermInfo, WithTerm } from "@/features/water/water-ui";
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
import { formatMonth } from "@/lib/format-date";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { NetworkDiagram } from "@/features/water/network-diagram";
import { WaterBalance } from "@/features/water/water-balance";
import { OwnWorkPanels } from "@/features/my-work/own-work-panels";
export const Route = createFileRoute("/_authenticated/water/")({
  head: () => ({ meta: [{ title: "Water Project — Dashboard — AIMS" }] }),
  component: WaterDashboardPage,
});

const ALL = "__all__";
const NRW_LIMIT = 8;

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function pct(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}

function formatCurrency(n: number): string {
  return `KES ${fmt(n)}`;
}

function WaterDashboardPage() {
  const canManage = useCanManageWater();
  const [month, setMonth] = useState(currentMonth());
  const [zoneId, setZoneId] = useState("");
  const [granularity, setGranularity] = useState<ChartGranularity>("month");
  const [weekKey, setWeekKey] = useState("");

  const weeks = useMemo(() => recentPeriods("week"), []);
  const week = resolvePeriod(weeks, weekKey);
  // Weekly charts cover the chosen week; monthly charts follow the Period box above.
  const chartWindow =
    granularity === "week"
      ? { dateFrom: week.dateFrom, dateTo: week.dateTo }
      : { month: month || currentMonth() };
  const windowLabel = granularity === "week" ? week.label : formatMonth(month || currentMonth());

  const allZonesQ = useWaterAllZones();
  const dashboardQ = useWaterDashboard({ zoneId: zoneId || undefined, month });
  const trendQ = useWaterTrend({
    zoneId: zoneId || undefined,
    granularity,
    periods: TREND_PERIODS[granularity],
  });
  const zoneCompQ = useWaterZoneComparison(chartWindow);

  const d = dashboardQ.data;
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
  const zoneSliceTotal = zoneSlices.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Water Project"
        description="How much water entered the network, how much customers paid for, and where it is being lost."
        actions={
          canManage ? (
            <Button size="sm" asChild>
              <Link to="/water/upload">
                <UploadCloud className="h-4 w-4 mr-1" /> Upload usage file
              </Link>
            </Button>
          ) : undefined
        }
      />
      {!canManage && <ViewOnlyBanner area="the Water Project" />}

      <WaterBalance month={month} />

      <NetworkDiagram />

      <OwnWorkPanels departmentCode="water" role="water" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs text-muted-foreground max-w-xl">
          Water flows from the borehole through the <WithTerm term="main">main meter</WithTerm>,
          into each zone&apos;s <WithTerm term="bulk">bulk meter</WithTerm>, then to{" "}
          <WithTerm term="household">household meters</WithTerm>.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="water-period" className="text-xs">
              Month
            </Label>
            <Input
              id="water-period"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 w-40"
            />
          </div>
          <div>
            <Label htmlFor="water-zone" className="text-xs">
              Zone
            </Label>
            <Select value={zoneId || ALL} onValueChange={(v) => setZoneId(v === ALL ? "" : v)}>
              <SelectTrigger id="water-zone" className="h-9 w-40">
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
        </div>
      </div>

      {dashboardQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : dashboardQ.isError || !d ? (
        <LoadError
          what="the water dashboard"
          error={dashboardQ.error}
          onRetry={() => dashboardQ.refetch()}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <KpiCard label="Active households" value={d.active_households.toLocaleString()} />
            <KpiCard
              label="Active meters"
              value={d.active_meters.toLocaleString()}
              sub={`${d.inactive_meters.toLocaleString()} inactive (not in use)`}
            />
            <KpiCard
              label={
                <>
                  Units sold <TermInfo term="units" />
                </>
              }
              value={`${fmt(d.units_sold)} m³`}
              sub={
                d.units_sold_change_pct !== null
                  ? `${pct(d.units_sold_change_pct)} vs prior month`
                  : undefined
              }
              trend={
                d.units_sold_change_pct === null
                  ? undefined
                  : d.units_sold_change_pct >= 0
                    ? "up"
                    : "down"
              }
            />
            <KpiCard label="Revenue collected" value={formatCurrency(d.revenue)} tone="good" />
            <KpiCard
              label={
                <>
                  Non-revenue water (NRW) <TermInfo term="nrw" />
                </>
              }
              value={pct(d.nrw_overall_pct)}
              sub={
                d.nrw_overall_pct !== null && d.nrw_overall_pct > NRW_LIMIT
                  ? `Above the ${NRW_LIMIT}% limit — investigate`
                  : d.nrw_overall_pct !== null
                    ? "Within the normal range"
                    : "No main meter readings yet"
              }
              tone={d.nrw_overall_pct !== null && d.nrw_overall_pct > NRW_LIMIT ? "bad" : "good"}
            />
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold">Water flow and loss</div>
            <p className="text-xs text-muted-foreground mb-3">
              Volumes in <WithTerm term="m3">m³</WithTerm>. Loss is water that went in at one stage
              but didn&apos;t come out at the next.
            </p>
            <FlowLadder
              mainTotal={d.main_reading_total}
              bulkTotal={d.bulk_reading_total}
              householdTotal={d.units_sold}
              nrwBoreholeToTank={d.nrw_borehole_to_tank_pct}
              nrwTankToNetwork={d.nrw_tank_to_network_pct}
            />
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
                  id="water-chart-week"
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
              dial, so a busy {GRANULARITY_WORD[granularity]} stands out.
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
              {zoneCompData.length === 0 && canManage && (
                <div className="flex justify-center pt-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/water/zones">Go to Zones</Link>
                  </Button>
                </div>
              )}
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
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  trend,
  tone = "neutral",
}: {
  label: ReactNode;
  value: string;
  sub?: string;
  trend?: "up" | "down";
  tone?: "good" | "bad" | "neutral";
}) {
  const toneClass = { good: "text-success", bad: "text-destructive", neutral: "text-foreground" }[
    tone
  ];
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-0.5 text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && (
        <div className={`mt-1.5 flex items-center gap-1 text-xs ${toneClass}`}>
          {trend === "up" ? (
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
          ) : trend === "down" ? (
            <TrendingDown className="h-3 w-3" aria-hidden="true" />
          ) : null}
          {sub}
        </div>
      )}
    </div>
  );
}

function FlowLadder({
  mainTotal,
  bulkTotal,
  householdTotal,
  nrwBoreholeToTank,
  nrwTankToNetwork,
}: {
  mainTotal: number;
  bulkTotal: number;
  householdTotal: number;
  nrwBoreholeToTank: number | null;
  nrwTankToNetwork: number | null;
}) {
  const Node = ({
    label,
    sub,
    value,
    color,
  }: {
    label: ReactNode;
    sub: string;
    value: number;
    color: string;
  }) => (
    <div
      className="flex-1 min-w-45 rounded-lg border-2 bg-secondary/20 p-3"
      style={{ borderColor: color }}
    >
      <div className="h-2 w-2 rounded-full mb-1.5" style={{ background: color }} />
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xl font-semibold mt-1 tabular-nums">{fmt(value)} m³</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
  const Loss = ({ value }: { value: number | null }) => {
    const high = value !== null && value > NRW_LIMIT;
    return (
      <div className="flex flex-col items-center gap-1 shrink-0 w-24">
        <div className="w-full h-0.5 bg-border" />
        <div
          className={`flex items-center gap-1 text-xs font-medium whitespace-nowrap ${
            high ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {high ? (
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          )}
          {pct(value)} loss{high ? " (high)" : ""}
        </div>
      </div>
    );
  };
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <Node
        label={<WithTerm term="main">Main meter</WithTerm>}
        sub="Borehole into the tank"
        value={mainTotal}
        color="#0F7A78"
      />
      <Loss value={nrwBoreholeToTank} />
      <Node
        label={<WithTerm term="bulk">Zone bulk meters</WithTerm>}
        sub="Tank into the zones (plus unzoned)"
        value={bulkTotal}
        color="#B9762A"
      />
      <Loss value={nrwTankToNetwork} />
      <Node
        label={<WithTerm term="household">Household meters</WithTerm>}
        sub="Paid for by customers"
        value={householdTotal}
        color="#2E8B57"
      />
    </div>
  );
}
