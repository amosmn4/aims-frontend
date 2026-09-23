import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import {
  type WaterMeterStatus,
  useWaterMeters,
  useDeleteWaterMeter,
  useWaterAllZones,
  useCanManageWater,
  WATER_METER_TYPE_LABELS,
  WATER_VENDING_SYSTEM_LABELS,
  vendingHealth,
  VENDING_HEALTH_LABELS,
  VENDING_HEALTH_ROW_STYLES,
  VENDING_HEALTH_BADGE_STYLES,
  type WaterMeterRow,
  type WaterMeterType,
  type WaterVendingSystem,
} from "@/features/water/use-water";
import { MeterFormDialog } from "@/features/water/meter-form-dialog";
import { orderZoneTree, zoneIndent } from "@/features/water/zone-tree";
import { ListEmpty, ListNoMatches, TermsHint, WithTerm } from "@/features/water/water-ui";
import { RowActions } from "@/components/row-actions";
import { confirmDeleteMeter, deleteErrorToast } from "@/features/water/water-delete";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { usePagination } from "@/hooks/use-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PaginationBar } from "@/components/pagination-bar";
import { formatDate } from "@/lib/format-date";
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

// Supports links like /water/meters?zoneId=… from a zone page.
const meterSearchSchema = z.object({
  zoneId: z.preprocess(
    (v) => (v == null || v === "" ? undefined : String(v)),
    z.string().optional(),
  ),
});

export const Route = createFileRoute("/_authenticated/water/meters")({
  head: () => ({ meta: [{ title: "Water Project — Meters — AIMS" }] }),
  validateSearch: meterSearchSchema,
  component: WaterMetersPage,
});

const ALL = "__all__";

interface MeterGroup {
  key: string;
  label: string;
  depth: number;
  zoneId: string | null;
  hasBulkMeter: boolean;
  meters: WaterMeterRow[];
}

// Main meters, then every zone in tree order with its bulk meter above its households,
// then whatever is wired straight to the main line.
function groupMetersByZone(
  meters: WaterMeterRow[],
  zoneRows: { id: string; name: string; depth: number }[],
): MeterGroup[] {
  const byNumber = (a: WaterMeterRow, b: WaterMeterRow) =>
    a.meter_number.localeCompare(b.meter_number);
  const bulkFirst = (a: WaterMeterRow, b: WaterMeterRow) =>
    a.meter_type === b.meter_type
      ? byNumber(a, b)
      : a.meter_type === "bulk"
        ? -1
        : b.meter_type === "bulk"
          ? 1
          : byNumber(a, b);

  const groups: MeterGroup[] = [];
  const mainMeters = meters.filter((m) => m.meter_type === "main").sort(byNumber);
  if (mainMeters.length > 0) {
    groups.push({
      key: "main",
      label: "Main meters",
      depth: 0,
      zoneId: null,
      hasBulkMeter: true,
      meters: mainMeters,
    });
  }

  for (const zone of zoneRows) {
    const inZone = meters.filter((m) => m.zone_id === zone.id && m.meter_type !== "main");
    if (inZone.length === 0) continue;
    groups.push({
      key: zone.id,
      label: zone.name,
      depth: zone.depth,
      zoneId: zone.id,
      hasBulkMeter: inZone.some((m) => m.meter_type === "bulk"),
      meters: [...inZone].sort(bulkFirst),
    });
  }

  const loose = meters.filter((m) => !m.zone_id && m.meter_type !== "main").sort(bulkFirst);
  if (loose.length > 0) {
    groups.push({
      key: "main-line",
      label: "On the main line",
      depth: 0,
      zoneId: null,
      hasBulkMeter: true,
      meters: loose,
    });
  }
  return groups;
}

function WaterMetersPage() {
  const canManage = useCanManageWater();
  const search = Route.useSearch();
  const [meterType, setMeterType] = useState<WaterMeterType | "">("");
  const [zoneId, setZoneId] = useState(search.zoneId ?? "");
  const [vendingSystem, setVendingSystem] = useState<WaterVendingSystem | "">("");
  const [status, setStatus] = useState<WaterMeterStatus | "">("");
  const [q, setQ] = useState("");
  const { page, pageSize, setPage, setPageSize } = usePagination(25);
  const term = useDebouncedValue(q.trim());

  const allZonesQ = useWaterAllZones();
  const metersQ = useWaterMeters({
    meterType: meterType || undefined,
    zoneId: zoneId || undefined,
    vendingSystem: vendingSystem || undefined,
    status: status || undefined,
    q: term || undefined,
  });
  const deleteMeter = useDeleteWaterMeter();
  const [editing, setEditing] = useState<WaterMeterRow | "new" | null>(null);

  const meters = useMemo(() => metersQ.data ?? [], [metersQ.data]);
  const zoneRows = useMemo(() => orderZoneTree(allZonesQ.data ?? []), [allZonesQ.data]);
  const groups = useMemo(() => groupMetersByZone(meters, zoneRows), [meters, zoneRows]);

  // One flat list of rows keeps the existing pager honest while the groups stay in order.
  const rows = useMemo(
    () => groups.flatMap((group) => group.meters.map((meter) => ({ group, meter }))),
    [groups],
  );
  const total = rows.length;
  // Keeps the view on a real page when a delete or a filter shrinks the list.
  const safePage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const columnCount = canManage ? 9 : 8;
  const hasFilters = !!term || !!meterType || !!zoneId || !!vendingSystem || !!status;

  const clearFilters = () => {
    setQ("");
    setMeterType("");
    setZoneId("");
    setVendingSystem("");
    setStatus("");
    setPage(1);
  };

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

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="h-4 w-4 mr-1" /> Add meter
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Meters Registry"
        description="Every water meter in the network, who or what it serves, and whether it is in use."
        actions={canManage ? addButton : undefined}
      />
      {!canManage && <ViewOnlyBanner area="the Water Project" />}
      <TermsHint terms={["main", "bulk", "household", "vending"]} />

      <div className="rounded-lg border bg-card p-3 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search meter no., name, location, plot or customer…"
            aria-label="Search meters"
            className="pl-7"
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={meterType || ALL}
            onValueChange={(v) => {
              setMeterType(v === ALL ? "" : (v as WaterMeterType));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9" aria-label="Filter by meter type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {Object.entries(WATER_METER_TYPE_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
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
              {zoneRows.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {`${"  ".repeat(z.depth)}${z.depth > 0 ? "↳ " : ""}${z.name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={status || ALL}
            onValueChange={(v) => {
              setStatus(v === ALL ? "" : (v as WaterMeterStatus));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="active">Active (in use)</SelectItem>
              <SelectItem value="inactive">Inactive (not in use)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={vendingSystem || ALL}
            onValueChange={(v) => {
              setVendingSystem(v === ALL ? "" : (v as WaterVendingSystem));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9" aria-label="Filter by vending system">
              <SelectValue placeholder="Vending system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All vending systems</SelectItem>
              {Object.entries(WATER_VENDING_SYSTEM_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {metersQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : metersQ.isError ? (
        <LoadError what="meters" error={metersQ.error} onRetry={() => metersQ.refetch()} />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card">
          {hasFilters ? (
            <ListNoMatches onClear={clearFilters} />
          ) : (
            <ListEmpty message="No meters yet" action={canManage ? addButton : undefined} />
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meter number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>
                    <WithTerm term="vending">Vending system</WithTerm>
                  </TableHead>
                  <TableHead>Customer / Name</TableHead>
                  <TableHead>Plot / Location</TableHead>
                  <TableHead>Installed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vending / Readings</TableHead>
                  {canManage && (
                    <TableHead className="w-20">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map(({ group, meter: m }, i) => {
                  const health = vendingHealth(m.last_vend_at);
                  const rowClass = !m.is_active
                    ? "opacity-70"
                    : m.meter_type === "household"
                      ? VENDING_HEALTH_ROW_STYLES[health]
                      : "";
                  const startsGroup = i === 0 || pageRows[i - 1].group.key !== group.key;
                  return (
                    <Fragment key={m.id}>
                      {startsGroup && (
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell
                            colSpan={columnCount}
                            style={{ paddingLeft: 12 + zoneIndent(group.depth) }}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              {group.zoneId ? (
                                <Link
                                  to="/water/zones/$zoneId"
                                  params={{ zoneId: group.zoneId }}
                                  className="text-sm font-semibold text-primary hover:underline"
                                >
                                  {group.depth > 0 && (
                                    <span className="text-muted-foreground mr-1" aria-hidden="true">
                                      ↳
                                    </span>
                                  )}
                                  {group.label}
                                </Link>
                              ) : (
                                <span className="text-sm font-semibold">{group.label}</span>
                              )}
                              {!group.hasBulkMeter && (
                                <Badge variant="secondary" className="text-warning">
                                  No bulk meter
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow className={rowClass}>
                        <TableCell
                          className="font-mono text-xs"
                          style={{ paddingLeft: 12 + zoneIndent(group.depth) + 12 }}
                        >
                          <Link
                            to="/water/meters/$meterId"
                            params={{ meterId: m.id }}
                            className="text-primary hover:underline"
                          >
                            {m.meter_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{WATER_METER_TYPE_LABELS[m.meter_type]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              m.vending_system === "mpaya"
                                ? "bg-accent/10 text-accent"
                                : "bg-primary/10 text-primary"
                            }
                            variant="secondary"
                          >
                            {WATER_VENDING_SYSTEM_LABELS[m.vending_system]}
                          </Badge>
                          {(m.replaces_meter || m.replaced_by_meter) && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {m.replaces_meter && `Replaces ${m.replaces_meter.meter_number}`}
                              {m.replaced_by_meter &&
                                `Replaced by ${m.replaced_by_meter.meter_number}`}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {m.customer_name ?? m.name ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {m.plot_no ?? m.location ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDate(m.installed_at)}
                        </TableCell>
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
                        <TableCell>
                          {!m.is_active ? (
                            <span className="text-xs text-muted-foreground">Not in use</span>
                          ) : m.meter_type === "household" ? (
                            <Badge className={VENDING_HEALTH_BADGE_STYLES[health]}>
                              {VENDING_HEALTH_LABELS[health]}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {m.last_reading_at
                                ? `Last reading ${formatDate(m.last_reading_at)}`
                                : "No readings yet"}
                            </span>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <RowActions
                              label={`meter ${m.meter_number}`}
                              onEdit={() => setEditing(m)}
                              onDelete={() => handleDelete(m)}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={safePage}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      <MeterFormDialog
        value={editing}
        defaultType={meterType || "household"}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
