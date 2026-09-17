import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
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
import { TermInfo, WithTerm, formatPeriodKey } from "@/features/water/water-ui";
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

  const allZonesQ = useWaterAllZones();
  const dashboardQ = useWaterDashboard({ zoneId: zoneId || undefined, month });
  const trendQ = useWaterTrend({ zoneId: zoneId || undefined, months: 6 });
  const zoneCompQ = useWaterZoneComparison({ month });

  const d = dashboardQ.data;
  const trendData = (trendQ.data ?? []).map((p) => ({
    month: formatPeriodKey(p.month),
    Main: p.main_total,
    "Zone bulk total": p.bulk_total,
    "Household total": p.household_total,
  }));
  const zoneCompData = (zoneCompQ.data ?? []).map((z) => ({
    zone: z.zone_name,
    "Bulk meter (m³)": z.bulk_total,
    "Household meters (m³)": z.household_total,
  }));

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
              Period
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-semibold mb-2">
                Last 6 months — main vs zone bulk vs household (m³)
              </div>
              {trendQ.isLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : trendQ.isError ? (
                <LoadError what="the trend" error={trendQ.error} onRetry={() => trendQ.refetch()} />
              ) : trendData.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center">No data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={trendData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
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
                Zone comparison — bulk meter vs household meters (m³)
              </div>
              {zoneCompQ.isLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : zoneCompQ.isError ? (
                <LoadError
                  what="the zone comparison"
                  error={zoneCompQ.error}
                  onRetry={() => zoneCompQ.refetch()}
                />
              ) : zoneCompData.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center text-xs text-muted-foreground">
                  <span>No zones yet</span>
                  {canManage && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/water/zones">Go to Zones</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart
                    data={zoneCompData}
                    margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="zone" tick={{ fontSize: 12 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Bulk meter (m³)" fill="#0F7A78" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Household meters (m³)" fill="#2E8B57" radius={[3, 3, 0, 0]} />
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
