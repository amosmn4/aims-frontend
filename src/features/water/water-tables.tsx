import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import {
  mainStageFromName,
  useWaterAllZones,
  useWaterHouseholdBilling,
  useWaterMeterSeries,
  type WaterMainStage,
  type WaterMeterSeries,
  type WaterZoneTreeNode,
} from "@/features/water/use-water";
import { monthWindow, orderZoneTree } from "@/features/water/zone-tree";
import { formatUnits, ZONE_COLORS } from "@/features/water/chart-periods";
import { SectionHeading } from "@/components/section-heading";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const INDENT = 18;
const PAD = 12;

type Dir = "asc" | "desc";

/** How many monthly buckets the series must cover to reach the chosen month. */
function monthsBack(month: string): number {
  const [year, m] = month.split("-").map(Number);
  if (!year || !m) return 1;
  const now = new Date();
  const diff = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - m);
  return Math.min(Math.max(diff + 1, 1), 24);
}

function compare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function SortHead({
  label,
  sorted,
  dir,
  onClick,
  align,
  className,
}: {
  label: string;
  sorted: boolean;
  dir: Dir;
  onClick: () => void;
  align?: "right";
  className?: string;
}) {
  const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn(align === "right" && "text-right", className)}>
      <button
        type="button"
        onClick={onClick}
        aria-sort={sorted ? (dir === "asc" ? "ascending" : "descending") : "none"}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          sorted ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {sorted && <Arrow className="h-3 w-3" aria-hidden="true" />}
      </button>
    </TableHead>
  );
}

function ShareBar({ value, total, color }: { value: number; total: number; color: string }) {
  const share = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(Math.min(share, 100), 0)}%`, background: color }}
        />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {share.toFixed(1)}%
      </span>
    </div>
  );
}

function Units({ value, bold }: { value: number; bold?: boolean }) {
  return (
    <TableCell className={cn("text-right font-mono text-sm tabular-nums", bold && "font-semibold")}>
      {formatUnits(value)}
    </TableCell>
  );
}

function Shell({
  title,
  action,
  isLoading,
  isError,
  error,
  onRetry,
  what,
  empty,
  children,
}: {
  title: string;
  action?: ReactNode;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  what: string;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <SectionHeading action={action}>{title}</SectionHeading>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        </div>
      ) : isError ? (
        <LoadError what={what} error={error} onRetry={onRetry} />
      ) : empty ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nothing for this month</p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}

/* ---------- What the meters read ---------- */

interface MeterRow {
  id: string;
  label: string;
  number: string;
  under: string;
  counted: string;
  units: number;
  depth: number;
  inside: string | null;
}

type MeterSortKey = "order" | "label" | "under" | "units";

function stageOf(m: WaterMeterSeries): WaterMainStage | null {
  return m.main_stage ?? mainStageFromName(m.label);
}

function countedText(name: string, children: WaterZoneTreeNode[]): string {
  if (children.length === 0) return `All of ${name}`;
  if (children.length === 1) return `${name} and ${children[0].name} inside it`;
  return `${name} and ${children.length} zones inside it`;
}

function buildMeterRows(
  zones: WaterZoneTreeNode[],
  meters: WaterMeterSeries[],
  month: string,
): MeterRow[] {
  const unitsOf = (m: WaterMeterSeries) => m.points.find((p) => p.period === month)?.units ?? 0;
  const mains = meters.filter((m) => m.meter_type === "main");
  const borehole = mains.find((m) => stageOf(m) === "borehole_to_tank");
  const network = mains.find((m) => stageOf(m) === "tank_to_network");

  const bulkByZone = new Map<string, WaterMeterSeries[]>();
  const orphanBulk: WaterMeterSeries[] = [];
  for (const m of meters) {
    if (m.meter_type !== "bulk") continue;
    if (m.zone_id) bulkByZone.set(m.zone_id, [...(bulkByZone.get(m.zone_id) ?? []), m]);
    else orphanBulk.push(m);
  }

  const known = new Set(zones.map((z) => z.id));
  const childrenOf = new Map<string, WaterZoneTreeNode[]>();
  const roots: WaterZoneTreeNode[] = [];
  for (const z of zones) {
    const parent = z.parent_zone_id;
    if (parent && known.has(parent)) {
      childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), z]);
    } else {
      roots.push(z);
    }
  }

  const rows: MeterRow[] = [];
  if (borehole) {
    rows.push({
      id: borehole.meter_id,
      label: borehole.label,
      number: borehole.meter_number,
      under: "—",
      counted: "Everything pumped up",
      units: unitsOf(borehole),
      depth: 0,
      inside: null,
    });
  }
  if (network) {
    rows.push({
      id: network.meter_id,
      label: network.label,
      number: network.meter_number,
      under: "The tanks",
      counted: "Everything sent out",
      units: unitsOf(network),
      depth: 0,
      inside: null,
    });
  }

  const topLabel = network?.label ?? "Main line";
  const walk = (list: WaterZoneTreeNode[], depth: number, parent: WaterZoneTreeNode | null) => {
    for (const zone of [...list].sort((a, b) => compare(a.name, b.name))) {
      const children = childrenOf.get(zone.id) ?? [];
      const parentBulk = parent ? (bulkByZone.get(parent.id) ?? [])[0] : undefined;
      for (const m of bulkByZone.get(zone.id) ?? []) {
        rows.push({
          id: m.meter_id,
          label: m.label,
          number: m.meter_number,
          under: parent ? (parentBulk?.label ?? parent.name) : topLabel,
          counted: countedText(zone.name, children),
          units: unitsOf(m),
          depth,
          inside: parent ? parent.name : null,
        });
      }
      walk(children, depth + 1, zone);
    }
  };
  walk(roots, 1, null);

  for (const m of orphanBulk) {
    rows.push({
      id: m.meter_id,
      label: m.label,
      number: m.meter_number,
      under: "—",
      counted: "Not in any zone",
      units: unitsOf(m),
      depth: 1,
      inside: null,
    });
  }
  return rows;
}

/** Every main and bulk meter for one month, in the order the water reaches them. */
export function MeterReadingsTable({ month }: { month: string }) {
  const zonesQ = useWaterAllZones();
  const seriesQ = useWaterMeterSeries({ granularity: "month", periods: monthsBack(month) });
  const [sort, setSort] = useState<{ key: MeterSortKey; dir: Dir }>({ key: "order", dir: "asc" });

  const rows = useMemo(
    () => buildMeterRows(zonesQ.data ?? [], seriesQ.data?.meters ?? [], month),
    [zonesQ.data, seriesQ.data, month],
  );

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    if (key === "order") return rows;
    const factor = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) =>
      key === "units" ? (a.units - b.units) * factor : compare(a[key], b[key]) * factor,
    );
  }, [rows, sort]);

  const peak = rows.reduce((max, r) => Math.max(max, r.units), 0);
  const toggle = (key: MeterSortKey, initial: Dir) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: initial },
    );

  return (
    <Shell
      title="What the meters read"
      action={
        sort.key === "order" ? undefined : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setSort({ key: "order", dir: "asc" })}
          >
            Network order
          </Button>
        )
      }
      isLoading={zonesQ.isLoading || seriesQ.isLoading}
      isError={zonesQ.isError || seriesQ.isError}
      error={zonesQ.error ?? seriesQ.error}
      onRetry={() => {
        void zonesQ.refetch();
        void seriesQ.refetch();
      }}
      what="the meter readings"
      empty={rows.length === 0}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <SortHead
              label="Meter"
              sorted={sort.key === "label"}
              dir={sort.dir}
              onClick={() => toggle("label", "asc")}
            />
            <SortHead
              label="Sits under"
              sorted={sort.key === "under"}
              dir={sort.dir}
              onClick={() => toggle("under", "asc")}
            />
            <SortHead
              label="Units"
              align="right"
              sorted={sort.key === "units"}
              dir={sort.dir}
              onClick={() => toggle("units", "desc")}
            />
            <TableHead className="w-36">Share</TableHead>
            <TableHead>What it counted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.id}>
              <TableCell
                style={{ paddingLeft: PAD + (sort.key === "order" ? r.depth * INDENT : 0) }}
              >
                <span className="text-sm font-medium">{r.label}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{r.number}</span>
                {r.inside && (
                  <span className="block text-xs text-muted-foreground">
                    Already inside {r.inside}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.under}</TableCell>
              <Units value={r.units} />
              <TableCell>
                <ShareBar value={r.units} total={peak} color={ZONE_COLORS[0]} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.counted}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Shell>
  );
}

/* ---------- What households were billed ---------- */

interface PlotRow {
  id: string;
  plot: string;
  customer: string;
  meter: string;
  units: number;
}

interface ZoneGroup {
  key: string;
  name: string;
  depth: number;
  under: string | null;
  tint: string;
  rows: PlotRow[];
  total: number;
}

type PlotSortKey = "plot" | "customer" | "units";

/** Every plot billed this month, grouped under the zone that feeds it. */
export function HouseholdBillingTable({ month }: { month: string }) {
  const zonesQ = useWaterAllZones();
  const billingQ = useWaterHouseholdBilling(monthWindow(month));
  const [sort, setSort] = useState<{ key: PlotSortKey; dir: Dir }>({ key: "plot", dir: "asc" });

  const groups = useMemo<ZoneGroup[]>(() => {
    const zones = zonesQ.data ?? [];
    const byId = new Map(zones.map((z) => [z.id, z]));
    const billed = (billingQ.data ?? []).filter((r) => r.units > 0);
    const rowsByZone = new Map<string, PlotRow[]>();
    for (const r of billed) {
      const key = r.zone_id ?? "__none__";
      rowsByZone.set(key, [
        ...(rowsByZone.get(key) ?? []),
        {
          id: r.meter_id,
          plot: r.plot_no ?? "—",
          customer: r.customer_name ?? "—",
          meter: r.meter_number,
          units: r.units,
        },
      ]);
    }
    const built: ZoneGroup[] = [];
    for (const zone of orderZoneTree(zones)) {
      const rows = rowsByZone.get(zone.id);
      if (!rows || rows.length === 0) continue;
      const parent = zone.parent_zone_id ? byId.get(zone.parent_zone_id) : undefined;
      built.push({
        key: zone.id,
        name: zone.name,
        depth: zone.depth,
        under: parent?.name ?? null,
        tint: ZONE_COLORS[built.length % ZONE_COLORS.length],
        rows,
        total: rows.reduce((sum, r) => sum + r.units, 0),
      });
    }
    const loose = rowsByZone.get("__none__");
    if (loose && loose.length > 0) {
      built.push({
        key: "__none__",
        name: "No zone",
        depth: 0,
        under: null,
        tint: ZONE_COLORS[built.length % ZONE_COLORS.length],
        rows: loose,
        total: loose.reduce((sum, r) => sum + r.units, 0),
      });
    }
    const { key, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    return built.map((g) => ({
      ...g,
      rows: [...g.rows].sort((a, b) =>
        key === "units" ? (a.units - b.units) * factor : compare(a[key], b[key]) * factor,
      ),
    }));
  }, [zonesQ.data, billingQ.data, sort]);

  const grand = groups.reduce((sum, g) => sum + g.total, 0);
  const toggle = (key: PlotSortKey, initial: Dir) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: initial },
    );

  return (
    <Shell
      title="What households were billed"
      isLoading={zonesQ.isLoading || billingQ.isLoading}
      isError={zonesQ.isError || billingQ.isError}
      error={zonesQ.error ?? billingQ.error}
      onRetry={() => {
        void zonesQ.refetch();
        void billingQ.refetch();
      }}
      what="the household billing"
      empty={groups.length === 0}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <SortHead
              label="Plot"
              sorted={sort.key === "plot"}
              dir={sort.dir}
              onClick={() => toggle("plot", "asc")}
            />
            <SortHead
              label="Customer"
              sorted={sort.key === "customer"}
              dir={sort.dir}
              onClick={() => toggle("customer", "asc")}
            />
            <TableHead>Meter</TableHead>
            <SortHead
              label="Units"
              align="right"
              sorted={sort.key === "units"}
              dir={sort.dir}
              onClick={() => toggle("units", "desc")}
            />
            <TableHead className="w-36">Share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <Fragment key={g.key}>
              <TableRow className="bg-muted/40">
                <TableCell colSpan={3} style={{ paddingLeft: PAD + g.depth * INDENT }}>
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: g.tint }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold">{g.name}</span>
                  {g.under && (
                    <span className="ml-2 text-xs text-muted-foreground">under {g.under}</span>
                  )}
                </TableCell>
                <Units value={g.total} bold />
                <TableCell>
                  <ShareBar value={g.total} total={grand} color={g.tint} />
                </TableCell>
              </TableRow>
              {g.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell
                    className="font-mono text-xs"
                    style={{ paddingLeft: PAD + (g.depth + 1) * INDENT }}
                  >
                    {r.plot}
                  </TableCell>
                  <TableCell className="text-sm">{r.customer}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.meter}
                  </TableCell>
                  <Units value={r.units} />
                  <TableCell>
                    <ShareBar value={r.units} total={grand} color={g.tint} />
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))}
          <TableRow className="border-t-2 bg-muted/60 hover:bg-muted/60">
            <TableCell colSpan={3} className="text-sm font-semibold">
              Billed to households
            </TableCell>
            <Units value={grand} bold />
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </Shell>
  );
}

/** Both tables, one under the other. */
export function WaterTables({ month }: { month: string }) {
  return (
    <div className="space-y-4">
      <MeterReadingsTable month={month} />
      <HouseholdBillingTable month={month} />
    </div>
  );
}
