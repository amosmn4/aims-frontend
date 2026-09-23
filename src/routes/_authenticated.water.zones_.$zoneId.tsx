import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowLeftRight, ListPlus, Loader2, Plus } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useCanManageWater,
  useDeleteWaterMeter,
  useWaterAllZones,
  useWaterMeters,
  useWaterUsageRecords,
  useWaterZoneComparison,
  useWaterZoneDetail,
  useWaterZoneSeries,
  type WaterMeterRow,
} from "@/features/water/use-water";
import { MeterFormDialog } from "@/features/water/meter-form-dialog";
import { MoveMeterDialog, type MoveMeterTarget } from "@/features/water/move-meter-dialog";
import { PlaceMetersDialog } from "@/features/water/place-meters-dialog";
import { currentMonth, monthWindow, zonePathNodes } from "@/features/water/zone-tree";
import {
  formatUnits,
  periodLabel,
  readingDomain,
  TREND_PERIODS,
  WATER_SERIES,
  type ChartGranularity,
} from "@/features/water/chart-periods";
import { ChartState, GranularityToggle, PeriodTooltip } from "@/features/water/water-charts";
import { ListEmpty } from "@/features/water/water-ui";
import { RowActions } from "@/components/row-actions";
import { confirmDeleteMeter, deleteErrorToast } from "@/features/water/water-delete";
import { SectionHeading } from "@/components/section-heading";
import { StatTile } from "@/features/finance/stat-tile";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/water/zones_/$zoneId")({
  head: () => ({ meta: [{ title: "Zone — Water Project — AIMS" }] }),
  component: ZoneDetailPage,
});

const KES = { style: "currency", currency: "KES", maximumFractionDigits: 0 } as const;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function lossTone(pct: number | null): "default" | "warning" | "danger" {
  if (pct === null) return "default";
  if (pct >= 15) return "danger";
  if (pct >= 5) return "warning";
  return "default";
}

function BackLink() {
  return (
    <Link
      to="/water/zones"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Zones
    </Link>
  );
}

function ZoneDetailPage() {
  const { zoneId } = Route.useParams();
  const canManage = useCanManageWater();
  const [month, setMonth] = useState(currentMonth());
  const [editing, setEditing] = useState<WaterMeterRow | null>(null);
  const [moving, setMoving] = useState<MoveMeterTarget | null>(null);
  const [placing, setPlacing] = useState(false);

  const detailQ = useWaterZoneDetail(zoneId, month || currentMonth());
  const allZonesQ = useWaterAllZones();
  const metersQ = useWaterMeters({ zoneId });
  const comparisonQ = useWaterZoneComparison({ month: month || currentMonth() });
  const deleteMeter = useDeleteWaterMeter();

  const usageQ = useWaterUsageRecords({ zoneId, ...monthWindow(month || currentMonth()) });

  const zoneMeters = useMemo(
    () => (metersQ.data ?? []).filter((m) => m.zone_id === zoneId),
    [metersQ.data, zoneId],
  );
  const bulkMeters = zoneMeters.filter((m) => m.meter_type === "bulk");
  const householdMeters = zoneMeters.filter((m) => m.meter_type === "household");

  const usedByMeter = useMemo(() => {
    const records = usageQ.data
      ? Array.isArray(usageQ.data)
        ? usageQ.data
        : usageQ.data.data
      : [];
    const map = new Map<string, number>();
    for (const r of records) map.set(r.meter_id, (map.get(r.meter_id) ?? 0) + r.units_sold);
    return map;
  }, [usageQ.data]);

  const childBulkById = useMemo(
    () => new Map((comparisonQ.data ?? []).map((c) => [c.zone_id ?? "", c.bulk_total])),
    [comparisonQ.data],
  );

  if (detailQ.isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  const d = detailQ.data;
  if (detailQ.isError || !d) {
    return (
      <div className="space-y-4">
        <BackLink />
        <LoadError what="this zone" error={detailQ.error} onRetry={() => detailQ.refetch()} />
      </div>
    );
  }

  const chain = zonePathNodes(allZonesQ.data ?? [], zoneId);
  const ancestors = chain.length > 0 ? chain.slice(0, -1) : d.parent ? [d.parent] : [];

  const handleDelete = async (m: WaterMeterRow) => {
    const ok = await confirmDeleteMeter({
      meter_number: m.meter_number,
      vend_count: m.total_vend_count,
      reading_count: m.total_reading_count,
    });
    if (!ok) return;
    deleteMeter.mutate(m.id, {
      onSuccess: () => toast.success(`Meter ${m.meter_number} deleted`),
      onError: deleteErrorToast,
    });
  };

  return (
    <div className="space-y-4">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{d.name}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {ancestors.map((a) => (
              <span key={a.id} className="flex items-center gap-1">
                <Link
                  to="/water/zones/$zoneId"
                  params={{ zoneId: a.id }}
                  className="hover:text-foreground hover:underline"
                >
                  {a.name}
                </Link>
                <span aria-hidden="true">›</span>
              </span>
            ))}
            <span className="text-foreground">{d.name}</span>
          </div>
        </div>
        <div>
          <Label htmlFor="zone-month" className="text-xs">
            Month
          </Label>
          <Input
            id="zone-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 w-40"
          />
        </div>
      </div>
      {!canManage && <ViewOnlyBanner area="the Water Project" />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Bulk meter (m³)"
          value={formatUnits(d.bulk_total)}
          emptyText={d.has_bulk_meter ? undefined : "No bulk meter"}
          hint={
            bulkMeters.length > 0 ? (
              <span className="font-mono">{bulkMeters.map((m) => m.meter_number).join(", ")}</span>
            ) : undefined
          }
        />
        <StatTile
          label="Its own plots (m³)"
          value={formatUnits(d.direct_household_total)}
          hint={plural(d.active_household_meters, "active meter")}
        />
        <StatTile
          label="Zones inside it (m³)"
          value={formatUnits(d.child_bulk_total)}
          emptyText={d.children.length === 0 ? "No sub-zones" : undefined}
          hint={plural(d.children.length, "sub-zone")}
        />
        <StatTile
          label="Loss (m³)"
          value={formatUnits(d.loss_units)}
          emptyText={d.has_bulk_meter ? undefined : "No bulk meter"}
          tone={lossTone(d.loss_pct)}
          hint={d.loss_pct === null ? undefined : `${d.loss_pct.toFixed(1)}%`}
        />
        <StatTile label="Revenue" value={d.revenue.toLocaleString(undefined, KES)} />
      </div>

      <div>
        <SectionHeading
          action={
            canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setPlacing(true)}>
                  <ListPlus className="h-3.5 w-3.5 mr-1" /> Place existing meters
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/water/meters" search={{ zoneId }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add meter to {d.name}
                  </Link>
                </Button>
              </div>
            ) : undefined
          }
        >
          Household meters
        </SectionHeading>
        <div className="rounded-lg border bg-card overflow-hidden">
          {metersQ.isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : metersQ.isError ? (
            <LoadError
              what="this zone's meters"
              error={metersQ.error}
              onRetry={() => metersQ.refetch()}
              className="m-4"
            />
          ) : householdMeters.length === 0 ? (
            <ListEmpty
              message="No household meters in this zone"
              action={
                canManage ? (
                  <Button size="sm" asChild>
                    <Link to="/water/meters" search={{ zoneId }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add meter to {d.name}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meter number</TableHead>
                    <TableHead>Plot</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Used this month (m³)</TableHead>
                    {canManage && (
                      <TableHead className="w-32">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {householdMeters.map((m) => (
                    <TableRow key={m.id} className={m.is_active ? undefined : "opacity-70"}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          to="/water/meters/$meterId"
                          params={{ meterId: m.id }}
                          className="text-primary hover:underline"
                        >
                          {m.meter_number}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{m.plot_no ?? "—"}</TableCell>
                      <TableCell className="text-sm">{m.customer_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            m.is_active
                              ? "bg-success text-success-foreground"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {m.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatUnits(usedByMeter.get(m.id) ?? 0)}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              title={`Move meter ${m.meter_number}`}
                              aria-label={`Move meter ${m.meter_number}`}
                              onClick={() =>
                                setMoving({
                                  id: m.id,
                                  meter_number: m.meter_number,
                                  zone_id: m.zone_id,
                                })
                              }
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                            </Button>
                            <RowActions
                              label={`meter ${m.meter_number}`}
                              onEdit={() => setEditing(m)}
                              onDelete={() => handleDelete(m)}
                            />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {d.children.length > 0 && (
        <div>
          <SectionHeading>Zones inside {d.name}</SectionHeading>
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead className="text-right">Bulk reading (m³)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.children.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        to="/water/zones/$zoneId"
                        params={{ zoneId: c.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatUnits(childBulkById.get(c.id) ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30">
                  <TableCell className="text-xs font-medium">
                    Already inside {d.name}&apos;s reading
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium tabular-nums">
                    {formatUnits(d.child_bulk_total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <ZoneUsageChart zoneId={zoneId} />

      <MeterFormDialog value={editing} onClose={() => setEditing(null)} />
      <MoveMeterDialog meter={moving} onClose={() => setMoving(null)} />
      <PlaceMetersDialog
        zoneId={zoneId}
        zoneName={d.name}
        open={placing}
        onClose={() => setPlacing(false)}
      />
    </div>
  );
}

function ZoneUsageChart({ zoneId }: { zoneId: string }) {
  const [granularity, setGranularity] = useState<ChartGranularity>("month");
  const seriesQ = useWaterZoneSeries({ granularity, periods: TREND_PERIODS[granularity] });

  const zone = seriesQ.data?.zones.find((z) => z.zone_id === zoneId);
  const data = (zone?.points ?? []).map((p) => ({
    period: periodLabel(p.period, granularity),
    "Bulk reading": p.bulk_units,
    "Plots used": p.household_units,
    Revenue: p.revenue,
  }));

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold">Usage over time</div>
        <GranularityToggle value={granularity} onChange={setGranularity} />
      </div>
      <ChartState
        isLoading={seriesQ.isLoading}
        isError={seriesQ.isError}
        error={seriesQ.error}
        onRetry={() => seriesQ.refetch()}
        what="this zone's usage"
        isEmpty={data.every((r) => !r["Bulk reading"] && !r["Plots used"] && !r.Revenue)}
        emptyMessage="Nothing recorded for this zone yet."
        height={240}
      >
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="units"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) => formatUnits(v)}
            />
            <YAxis
              yAxisId="revenue"
              orientation="right"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={62}
              domain={readingDomain(data.map((r) => r.Revenue))}
              tickFormatter={(v: number) => formatUnits(v)}
            />
            <Tooltip content={<PeriodTooltip rows={data} unit="" />} cursor={{ opacity: 0.1 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="units"
              dataKey="Bulk reading"
              fill={WATER_SERIES.bulk}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              yAxisId="units"
              dataKey="Plots used"
              fill={WATER_SERIES.household}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Line
              yAxisId="revenue"
              type="monotone"
              dataKey="Revenue"
              stroke={WATER_SERIES.main}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartState>
    </div>
  );
}
