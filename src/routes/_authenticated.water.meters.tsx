import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import { ListEmpty, ListNoMatches, TermsHint, WithTerm } from "@/features/water/water-ui";
import { RowActions } from "@/components/row-actions";
import { confirmDeleteMeter, deleteErrorToast } from "@/features/water/water-delete";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { usePagination } from "@/hooks/use-pagination";
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

export const Route = createFileRoute("/_authenticated/water/meters")({
  head: () => ({ meta: [{ title: "Water Project — Meters — AIMS" }] }),
  component: WaterMetersPage,
});

const ALL = "__all__";

function WaterMetersPage() {
  const canManage = useCanManageWater();
  const [meterType, setMeterType] = useState<WaterMeterType | "">("");
  const [zoneId, setZoneId] = useState("");
  const [vendingSystem, setVendingSystem] = useState<WaterVendingSystem | "">("");
  const [status, setStatus] = useState<WaterMeterStatus | "">("");
  const [q, setQ] = useState("");
  const { page, pageSize, setPage, setPageSize } = usePagination(25);

  const allZonesQ = useWaterAllZones();
  const metersQ = useWaterMeters(
    {
      meterType: meterType || undefined,
      zoneId: zoneId || undefined,
      vendingSystem: vendingSystem || undefined,
      status: status || undefined,
      q: q.trim() || undefined,
    },
    { page, pageSize },
  );
  const deleteMeter = useDeleteWaterMeter();
  const [editing, setEditing] = useState<WaterMeterRow | "new" | null>(null);

  const result = metersQ.data;
  const meters = result ? (Array.isArray(result) ? result : result.data) : [];
  const total = result && !Array.isArray(result) ? result.total : meters.length;
  const hasFilters = !!q.trim() || !!meterType || !!zoneId || !!vendingSystem || !!status;

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
        description="Every water meter in the network, who or what it serves, and whether it is in use. Click a meter number to see its history."
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
              {(allZonesQ.data ?? []).map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.parent_zone_id ? `↳ ${z.name}` : z.name}
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
      ) : meters.length === 0 ? (
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
                  <TableHead>Zone</TableHead>
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
                {meters.map((m) => {
                  const health = vendingHealth(m.last_vend_at);
                  const rowClass = !m.is_active
                    ? "opacity-70"
                    : m.meter_type === "household"
                      ? VENDING_HEALTH_ROW_STYLES[health]
                      : "";
                  return (
                    <TableRow key={m.id} className={rowClass}>
                      <TableCell className="font-mono text-xs">
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
                      <TableCell className="text-sm">{m.customer_name ?? m.name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {m.plot_no ?? m.location ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDate(m.installed_at)}
                      </TableCell>
                      <TableCell className="text-sm">{m.zone_name ?? "—"}</TableCell>
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
                  );
                })}
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
