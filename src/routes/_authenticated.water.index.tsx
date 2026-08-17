import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Loader2,
  TrendingDown,
  TrendingUp,
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
} from "@/features/water/use-water";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/water/")({
  head: () => ({ meta: [{ title: "Water Project — Dashboard — AIMS" }] }),
  component: WaterDashboardPage,
});

const ALL = "__all__";

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
  const [month, setMonth] = useState(currentMonth());
  const [zoneId, setZoneId] = useState("");

  const allZonesQ = useWaterAllZones();
  const dashboardQ = useWaterDashboard({ zoneId: zoneId || undefined, month });
  const trendQ = useWaterTrend({ zoneId: zoneId || undefined, months: 6 });
  const zoneCompQ = useWaterZoneComparison({ month });

  const d = dashboardQ.data;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" /> Water Project
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Borehole / main meter → zone bulk meters → household meters.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs">Period</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 w-40"
            />
          </div>
          <div>
            <Label className="text-xs">Zone</Label>
            <Select value={zoneId || ALL} onValueChange={(v) => setZoneId(v === ALL ? "" : v)}>
              <SelectTrigger className="h-9 w-40">
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

      {dashboardQ.isLoading || !d ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Active households" value={d.active_households.toLocaleString()} />
            <KpiCard
              label="Units sold this period"
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
              label="Non-revenue water (main → household)"
              value={pct(d.nrw_main_to_household_pct)}
              sub={
                d.nrw_main_to_household_pct !== null && d.nrw_main_to_household_pct > 8
                  ? "above 8% threshold"
                  : d.nrw_main_to_household_pct !== null
                    ? "within normal range"
                    : "no main/bulk readings yet"
              }
              tone={
                d.nrw_main_to_household_pct !== null && d.nrw_main_to_household_pct > 8
                  ? "bad"
                  : "good"
              }
            />
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold mb-3">Water flow & loss ladder</div>
            <FlowLadder
              mainTotal={d.main_reading_total}
              bulkTotal={d.bulk_reading_total}
              householdTotal={d.units_sold}
              nrwMainToBulk={d.nrw_main_to_bulk_pct}
              nrwBulkToHousehold={d.nrw_bulk_to_household_pct}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-semibold mb-2">
                Monthly volume trend — main vs zone bulk vs household
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
  label: string;
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
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && (
        <div className={`mt-1.5 flex items-center gap-1 text-xs ${toneClass}`}>
          {trend === "up" ? (
            <TrendingUp className="h-3 w-3" />
          ) : trend === "down" ? (
            <TrendingDown className="h-3 w-3" />
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
  nrwMainToBulk,
  nrwBulkToHousehold,
}: {
  mainTotal: number;
  bulkTotal: number;
  householdTotal: number;
  nrwMainToBulk: number | null;
  nrwBulkToHousehold: number | null;
}) {
  const Node = ({
    label,
    sub,
    value,
    color,
  }: {
    label: string;
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
      <div className="text-xl font-semibold mt-1 tabular-nums">{fmt(value)} units</div>
      <div className="text-xs text-muted-foreground mt-0.5 font-mono">{sub}</div>
    </div>
  );
  const Loss = ({ value }: { value: number | null }) => (
    <div className="flex flex-col items-center gap-1 shrink-0 w-22">
      <div className="w-full h-0.5 bg-border" />
      <div
        className={`flex items-center gap-1 text-xs font-medium whitespace-nowrap ${
          value !== null && value > 8 ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {value !== null && value > 8 ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <CheckCircle2 className="h-3 w-3" />
        )}
        {pct(value)} loss
      </div>
    </div>
  );
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <Node label="Borehole / main meter" sub="MAIN" value={mainTotal} color="#0F7A78" />
      <Loss value={nrwMainToBulk} />
      <Node label="Zone bulk meters" sub="BULK — combined" value={bulkTotal} color="#B9762A" />
      <Loss value={nrwBulkToHousehold} />
      <Node
        label="Household meters"
        sub="metered consumption"
        value={householdTotal}
        color="#2E8B57"
      />
    </div>
  );
}
