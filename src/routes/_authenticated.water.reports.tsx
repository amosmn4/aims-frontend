import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter";
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

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function last30Days(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
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
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}pp vs last month`;
}

function unitsDelta(curr: number, prev: number): string | null {
  if (prev === 0) return null;
  const d = ((curr - prev) / prev) * 100;
  if (Math.abs(d) < 0.5) return null;
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}% vs last month`;
}

function WaterReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const summaryQ = useWaterReportSummary({ month });
  const trendQ = useWaterTrend({ months: 6 });
  const zoneCompQ = useWaterZoneComparison({ month });
  const s = summaryQ.data;

  const trendData = (trendQ.data ?? []).map((p) => ({
    month: p.month,
    Main: p.main_total,
    "Zone bulk total": p.bulk_total,
    "Household total": p.household_total,
  }));
  const zoneCompData = (zoneCompQ.data ?? []).map((z) => ({
    zone: z.zone_name,
    "Bulk meter (units)": z.bulk_total,
    "Household sum (units)": z.household_total,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Reports & Analytics</h1>
          <p className="text-xs text-muted-foreground">
            Period summary, trends, per-zone loss, and daily/weekly/monthly meter reading
            comparisons.
          </p>
        </div>
        <div>
          <Label className="text-xs">Period</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 w-40"
          />
        </div>
      </div>

      {summaryQ.isLoading || !s ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold mb-2">Period summary — {s.month}</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">This period</TableHead>
                  <TableHead className="text-right">Last period</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm">Main meter volume drawn</TableCell>
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
                  <TableCell className="text-sm">Zone bulk meters total</TableCell>
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
                  <TableCell className="text-sm">Household billed consumption</TableCell>
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
                    Non-revenue water (borehole → household)
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <span
                      className={
                        s.dashboard.nrw_overall_pct !== null && s.dashboard.nrw_overall_pct > 8
                          ? "text-destructive"
                          : "text-success"
                      }
                    >
                      {pct(s.dashboard.nrw_overall_pct)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {pct(s.prev_dashboard.nrw_overall_pct)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {pctDelta(s.dashboard.nrw_overall_pct, s.prev_dashboard.nrw_overall_pct) ?? "—"}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">Estimated revenue</TableCell>
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

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold mb-2">Trends and insights</div>
            {s.insights.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">
                Not enough data yet to generate insights for this period.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {s.insights.map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {i === 0 ? (
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                    )}
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-semibold mb-2">
                6-month trend — main vs zone bulk vs household
              </div>
              {trendData.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center">No data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={trendData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Main" stroke="#0F7A78" strokeWidth={2} />
                    <Line
                      type="monotone"
                      dataKey="Zone bulk total"
                      stroke="#B9762A"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="Household total"
                      stroke="#2E8B57"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-semibold mb-2">
                Zone comparison — bulk reading vs household sum
              </div>
              {zoneCompData.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center">
                  No zones registered yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart
                    data={zoneCompData}
                    margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="zone" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Bulk meter (units)" fill="#0F7A78" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Household sum (units)" fill="#2E8B57" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold mb-2">Zone-level loss this period</div>
            {s.zone_loss.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">No zones registered yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead className="text-right">Own bulk reading</TableHead>
                    <TableHead className="text-right">Accounted for</TableHead>
                    <TableHead className="text-right">Loss (units)</TableHead>
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
                        ) : z.loss_pct > 8 ? (
                          <Badge className="bg-destructive/15 text-destructive" variant="secondary">
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
            )}
          </div>
        </>
      )}

      <MeterReadingComparison />
    </div>
  );
}

const BUCKETS: { value: "day" | "week" | "month"; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

function MeterReadingComparison() {
  const [meterType, setMeterType] = useState<WaterMeterType>("main");
  const [zoneId, setZoneId] = useState("");
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");
  const [range, setRange] = useState<DateRange>(last30Days());

  const allZonesQ = useWaterAllZones();
  // "All time" gives an empty range — fall back to a wide window so queries return something.
  const dateFrom = range.from ?? "2000-01-01";
  const dateTo = range.to ?? new Date().toISOString().slice(0, 10);

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

  const chartData = (seriesQ.data ?? []).map((p) => ({ period: p.period, Usage: p.usage }));
  const totalUsage = (seriesQ.data ?? []).reduce((s, p) => s + p.usage, 0);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">
            {meterType === "main" ? "Main meter" : "Zone bulk meter"} readings — {bucket} comparison
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each figure is the gap between consecutive readings (last reading to current reading),
            not the raw dial value — this is real usage over the period.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-36">
            <Label className="text-xs">Meter</Label>
            <Select value={meterType} onValueChange={(v) => setMeterType(v as WaterMeterType)}>
              <SelectTrigger className="h-9">
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
              <Label className="text-xs">Zone</Label>
              <Select value={zoneId || ALL} onValueChange={(v) => setZoneId(v === ALL ? "" : v)}>
                <SelectTrigger className="h-9">
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
            <Label className="text-xs">Bucket</Label>
            <Select value={bucket} onValueChange={(v) => setBucket(v as typeof bucket)}>
              <SelectTrigger className="h-9">
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
          <div>
            <Label className="text-xs">Period</Label>
            <DateRangeFilter value={range} onChange={setRange} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {seriesQ.isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="text-xs text-muted-foreground py-12 text-center">
              No readings in this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="Usage" fill="#0F7A78" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-md bg-secondary/40 p-3 flex flex-col justify-center">
          <div className="text-xs text-muted-foreground">Total usage this period</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{fmt(totalUsage)}</div>
          <div className="text-xs text-muted-foreground mt-2">
            Across {(seriesQ.data ?? []).reduce((s, p) => s + p.reading_count, 0)} reading
            {(seriesQ.data ?? []).reduce((s, p) => s + p.reading_count, 0) === 1 ? "" : "s"} in{" "}
            {(seriesQ.data ?? []).length}{" "}
            {bucket === "day" ? "day(s)" : bucket === "week" ? "week(s)" : "month(s)"}
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Reading log</div>
        {readingsQ.isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
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
                  <TableHead className="text-right">Reading</TableHead>
                  <TableHead className="text-right">Usage since last</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(readingsQ.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {new Date(r.reading_date).toLocaleString()}
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
                        <span className="text-muted-foreground">first reading</span>
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
