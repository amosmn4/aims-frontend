import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  useWaterReadings,
  useDeleteWaterReading,
  useWaterAllZones,
  useCanManageWater,
  WATER_METER_TYPE_LABELS,
  type WaterMeterReadingRow,
} from "@/features/water/use-water";
import { ReadingFormDialog, type ReadingFormValue } from "@/features/water/reading-form-dialog";
import { ListEmpty, ListNoMatches, TermsHint } from "@/features/water/water-ui";
import {
  GRANULARITY_WORD,
  periodKeyOf,
  periodLabel,
  readingDomain,
  ZONE_COLORS,
  type ChartGranularity,
} from "@/features/water/chart-periods";
import {
  ChartCaption,
  ChartState,
  GranularityToggle,
  PeriodTooltip,
} from "@/features/water/water-charts";
import { RowActions } from "@/components/row-actions";
import { confirmDeleteReading, deleteErrorToast } from "@/features/water/water-delete";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/pagination-bar";
import { DateRangeFilter, type DateRange } from "@/components/date-range-filter";
import { formatDateTime } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_authenticated/water/readings")({
  head: () => ({ meta: [{ title: "Water Project — Readings — AIMS" }] }),
  component: WaterReadingsPage,
});

const ALL = "__all__";
type ReadingMeterType = "main" | "bulk";

function WaterReadingsPage() {
  const canManage = useCanManageWater();
  const { page, pageSize, setPage, setPageSize } = usePagination(25);
  const [q, setQ] = useState("");
  const [meterType, setMeterType] = useState<ReadingMeterType | "">("");
  const [zoneId, setZoneId] = useState("");
  const [range, setRange] = useState<DateRange>({});
  const [granularity, setGranularity] = useState<ChartGranularity>("month");
  // Bumped on "Clear filters" so the period dropdown resets too.
  const [rangeKey, setRangeKey] = useState(0);
  const [editing, setEditing] = useState<ReadingFormValue | "new" | null>(null);

  const filters = {
    q: q.trim() || undefined,
    meterType: meterType || undefined,
    zoneId: zoneId || undefined,
    from: range.from,
    to: range.to,
  };
  const allZonesQ = useWaterAllZones();
  const chartReadingsQ = useWaterReadings(filters);
  const pagedReadingsQ = useWaterReadings(filters, { page, pageSize });
  const deleteReading = useDeleteWaterReading();

  const chartReadings = chartReadingsQ.data ?? [];
  const pagedResult = pagedReadingsQ.data;
  const readings = pagedResult ? (Array.isArray(pagedResult) ? pagedResult : pagedResult.data) : [];
  const total = pagedResult && !Array.isArray(pagedResult) ? pagedResult.total : readings.length;
  const hasFilters = !!(filters.q || filters.meterType || filters.zoneId || range.from || range.to);

  const clearFilters = () => {
    setQ("");
    setMeterType("");
    setZoneId("");
    setRange({});
    setRangeKey((k) => k + 1);
    setPage(1);
  };

  // One row per week or month, one column per meter, for the reading history chart.
  const byMeter = new Map<string, { number: string; count: number }>();
  for (const r of chartReadings) {
    const seen = byMeter.get(r.meter_id);
    byMeter.set(r.meter_id, { number: r.meter_number, count: (seen?.count ?? 0) + 1 });
  }
  const meterIds = [...byMeter.keys()]
    .sort((a, b) => byMeter.get(b)!.count - byMeter.get(a)!.count)
    .slice(0, ZONE_COLORS.length);
  const hiddenMeters = byMeter.size - meterIds.length;

  // The dial at the end of each period — the latest reading inside it.
  const latest = new Map<string, Map<string, number>>();
  for (const r of chartReadings) {
    const bucket = periodKeyOf(r.reading_date, granularity);
    const perMeter = latest.get(bucket) ?? new Map<string, number>();
    const seenAt = perMeter.get(`${r.meter_id}:at`);
    const at = new Date(r.reading_date).getTime();
    if (seenAt === undefined || at >= seenAt) {
      perMeter.set(`${r.meter_id}:at`, at);
      perMeter.set(r.meter_id, r.value);
    }
    latest.set(bucket, perMeter);
  }

  const chartData = [...latest.keys()].sort().map((bucket) => {
    const row: Record<string, string | number> = { period: periodLabel(bucket, granularity) };
    for (const id of meterIds) {
      const value = latest.get(bucket)!.get(id);
      if (value !== undefined) row[byMeter.get(id)!.number] = value;
    }
    return row;
  });
  const readingValues = chartData.flatMap((row) =>
    meterIds
      .map((id) => row[byMeter.get(id)!.number])
      .filter((v): v is number => typeof v === "number"),
  );

  const handleDelete = async (r: WaterMeterReadingRow) => {
    if (!(await confirmDeleteReading(r))) return;
    deleteReading.mutate(r.id, {
      onSuccess: () => toast.success("Reading deleted"),
      onError: deleteErrorToast,
    });
  };

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-4 w-4 mr-1" /> Record reading
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bulk & Main Readings"
        description="Numbers read off the main meter and each zone's bulk meter dial, used to work out how much water is lost."
        actions={canManage ? addButton : undefined}
      />
      {!canManage && <ViewOnlyBanner area="the Water Project" />}
      <TermsHint terms={["main", "bulk", "m3"]} />

      <div className="rounded-lg border bg-card p-3 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search meter number, name or location…"
            aria-label="Search readings by meter"
            className="pl-7"
          />
        </div>
        <div className="w-full sm:w-40">
          <Select
            value={meterType || ALL}
            onValueChange={(v) => {
              setMeterType(v === ALL ? "" : (v as ReadingMeterType));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9" aria-label="Filter by meter type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Main & bulk</SelectItem>
              <SelectItem value="main">{WATER_METER_TYPE_LABELS.main} only</SelectItem>
              <SelectItem value="bulk">{WATER_METER_TYPE_LABELS.bulk} only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={zoneId || ALL}
            onValueChange={(v) => {
              setZoneId(v === ALL ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9" aria-label="Filter by zone">
              <SelectValue placeholder="Zone" />
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
        <div className="max-w-full overflow-x-auto">
          <DateRangeFilter
            key={rangeKey}
            value={range}
            onChange={(r) => {
              setRange(r);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Meter reading (running total)</div>
            <ChartCaption>
              The number on the dial at the end of each {GRANULARITY_WORD[granularity]}. It only
              ever goes up, so the chart starts near the readings themselves — a small rise is still
              a real one.
            </ChartCaption>
          </div>
          <GranularityToggle value={granularity} onChange={setGranularity} />
        </div>
        <ChartState
          isLoading={chartReadingsQ.isLoading}
          isError={chartReadingsQ.isError}
          error={chartReadingsQ.error}
          onRetry={() => chartReadingsQ.refetch()}
          what="the reading history"
          isEmpty={chartData.length === 0}
          emptyMessage={
            hasFilters ? "No readings match these filters." : "No readings recorded yet."
          }
          height={260}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
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
                width={62}
                domain={readingDomain(readingValues)}
                allowDataOverflow={false}
                tickFormatter={(v: number) => Math.round(v).toLocaleString()}
              />
              <Tooltip content={<PeriodTooltip rows={chartData} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {meterIds.map((id, i) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={byMeter.get(id)!.number}
                  stroke={ZONE_COLORS[i]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartState>
        {hiddenMeters > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing the {meterIds.length} meters with the most readings. Filter by zone or meter
            type to see the other {hiddenMeters}.
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="p-4 pb-0 text-sm font-semibold">All readings</div>
        {pagedReadingsQ.isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : pagedReadingsQ.isError ? (
          <LoadError
            what="readings"
            error={pagedReadingsQ.error}
            onRetry={() => pagedReadingsQ.refetch()}
            className="m-4"
          />
        ) : readings.length === 0 ? (
          hasFilters ? (
            <ListNoMatches onClear={clearFilters} />
          ) : (
            <ListEmpty message="No readings yet" action={canManage ? addButton : undefined} />
          )
        ) : (
          <>
            <div className="overflow-x-auto mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & time</TableHead>
                    <TableHead>Meter</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead className="text-right">Reading (m³)</TableHead>
                    <TableHead>Notes</TableHead>
                    {canManage && (
                      <TableHead className="w-20">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readings.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDateTime(r.reading_date)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Link
                          to="/water/meters/$meterId"
                          params={{ meterId: r.meter_id }}
                          className="font-mono text-primary hover:underline"
                        >
                          {r.meter_number}
                        </Link>
                        {r.meter_name && (
                          <div className="text-xs text-muted-foreground">{r.meter_name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{WATER_METER_TYPE_LABELS[r.meter_type]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.zone_name ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.value.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.notes ?? "—"}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <RowActions
                            label={`reading for meter ${r.meter_number} on ${formatDateTime(r.reading_date)}`}
                            onEdit={() => setEditing(r)}
                            onDelete={() => handleDelete(r)}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      <ReadingFormDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
