import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { confirmDialog } from "@/components/confirm-dialog";
import {
  useWaterMeters,
  useSaveWaterMeter,
  useDeleteWaterMeter,
  useWaterAllZones,
  useWaterCustomers,
  WATER_METER_TYPE_LABELS,
  WATER_VENDING_SYSTEM_LABELS,
  MAIN_METER_NAMES,
  vendingHealth,
  VENDING_HEALTH_LABELS,
  VENDING_HEALTH_ROW_STYLES,
  VENDING_HEALTH_BADGE_STYLES,
  type WaterMeterRow,
  type WaterMeterType,
  type WaterVendingSystem,
} from "@/features/water/use-water";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/water/meters")({
  head: () => ({ meta: [{ title: "Water Project — Meters — AIMS" }] }),
  component: WaterMetersPage,
});

const ALL = "__all__";
const NONE = "__none__";

function WaterMetersPage() {
  const [meterType, setMeterType] = useState<WaterMeterType | "">("");
  const [zoneId, setZoneId] = useState("");
  const [vendingSystem, setVendingSystem] = useState<WaterVendingSystem | "">("");
  const [q, setQ] = useState("");
  const { page, pageSize, setPage, setPageSize } = usePagination(25);

  const allZonesQ = useWaterAllZones();
  const metersQ = useWaterMeters(
    {
      meterType: meterType || undefined,
      zoneId: zoneId || undefined,
      vendingSystem: vendingSystem || undefined,
      q: q.trim() || undefined,
    },
    { page, pageSize },
  );
  const deleteMeter = useDeleteWaterMeter();
  const [editing, setEditing] = useState<WaterMeterRow | "new" | null>(null);

  const result = metersQ.data;
  const meters = result ? (Array.isArray(result) ? result : result.data) : [];
  const total = result && !Array.isArray(result) ? result.total : meters.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Meters Registry</h1>
          <p className="text-xs text-muted-foreground">
            Household meters capture who they&apos;re assigned to; main and bulk meters capture a
            name, location and the zone they reconcile instead — no customer. Row color shows
            vending activity; click a meter number to see its full history.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-1" /> Register meter
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-3 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search meter number…"
            className="pl-7"
          />
        </div>
        <div className="w-44">
          <Select
            value={meterType || ALL}
            onValueChange={(v) => {
              setMeterType(v === ALL ? "" : (v as WaterMeterType));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9">
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
        <div className="w-44">
          <Select
            value={zoneId || ALL}
            onValueChange={(v) => {
              setZoneId(v === ALL ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9">
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
        <div className="w-40">
          <Select
            value={vendingSystem || ALL}
            onValueChange={(v) => {
              setVendingSystem(v === ALL ? "" : (v as WaterVendingSystem));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="System" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All systems</SelectItem>
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
      ) : meters.length === 0 ? (
        <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
          No meters match these filters.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meter number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead>Customer / Name</TableHead>
                  <TableHead>Plot / Location</TableHead>
                  <TableHead>Installed</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vending / Readings</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {meters.map((m) => {
                  const health = vendingHealth(m.last_vend_at);
                  const rowClass =
                    m.meter_type === "household" ? VENDING_HEALTH_ROW_STYLES[health] : "";
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
                          <div className="text-[0.625rem] text-muted-foreground mt-0.5">
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
                      <TableCell className="text-xs">
                        {m.installed_at ? m.installed_at.slice(0, 10) : "—"}
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
                        {m.meter_type === "household" ? (
                          <Badge className={VENDING_HEALTH_BADGE_STYLES[health]}>
                            {VENDING_HEALTH_LABELS[health]}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {m.last_reading_at
                              ? `Last reading ${m.last_reading_at.slice(0, 10)}`
                              : "No readings yet"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(m)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={async () => {
                              const ok = await confirmDialog({
                                title: `Remove meter "${m.meter_number}"?`,
                                confirmLabel: "Remove",
                                destructive: true,
                                description: "This can't be undone.",
                              });
                              if (!ok) return;
                              deleteMeter.mutate(m.id, {
                                onError: (err) =>
                                  toast.error(
                                    err instanceof Error ? err.message : "Failed to delete",
                                  ),
                              });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
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

      <EditMeterDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditMeterDialog({
  value,
  onClose,
}: {
  value: WaterMeterRow | "new" | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {value && <EditMeterForm value={value === "new" ? null : value} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EditMeterForm({ value, onDone }: { value: WaterMeterRow | null; onDone: () => void }) {
  const save = useSaveWaterMeter();
  const allZonesQ = useWaterAllZones();
  const customersQ = useWaterCustomers();
  const allMetersQ = useWaterMeters();
  const [meterNumber, setMeterNumber] = useState(value?.meter_number ?? "");
  const [meterType, setMeterType] = useState<WaterMeterType>(value?.meter_type ?? "household");
  const isHousehold = meterType === "household";
  const [name, setName] = useState(value?.name ?? "");
  const [location, setLocation] = useState(value?.location ?? "");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    value?.customer_id ? "existing" : "new",
  );
  const [customerId, setCustomerId] = useState(value?.customer_id ?? "");
  const [customerName, setCustomerName] = useState(value?.customer_name ?? "");
  const [plotNo, setPlotNo] = useState(value?.plot_no ?? "");
  const [installedAt, setInstalledAt] = useState(value?.installed_at?.slice(0, 10) ?? "");
  const [vendingSystem, setVendingSystem] = useState<WaterVendingSystem>(
    value?.vending_system ?? "amsol",
  );
  const [replacesMeterId, setReplacesMeterId] = useState(value?.replaces_meter_id ?? "");
  const replaceableMeters = (allMetersQ.data ?? []).filter((m) => m.id !== value?.id);

  const allZones = allZonesQ.data ?? [];
  const currentZoneNode = allZones.find((z) => z.id === value?.zone_id);
  const [zoneId, setZoneId] = useState(
    currentZoneNode?.parent_zone_id ? currentZoneNode.parent_zone_id : (value?.zone_id ?? ""),
  );
  const [subzoneId, setSubzoneId] = useState(
    currentZoneNode?.parent_zone_id ? (value?.zone_id ?? "") : "",
  );
  const [isActive, setIsActive] = useState(value?.is_active ?? true);

  const topLevelZones = allZones.filter((z) => !z.parent_zone_id);
  const subzoneOptions = allZones.filter((z) => z.parent_zone_id === zoneId);

  const submit = () => {
    if (!meterNumber.trim()) {
      toast.error("Meter number is required");
      return;
    }
    if (isHousehold) {
      if (customerMode === "new" && !customerName.trim()) {
        toast.error("Enter the customer's name, or switch to picking an existing customer");
        return;
      }
      if (customerMode === "existing" && !customerId) {
        toast.error("Choose a customer, or switch to entering a new one");
        return;
      }
    } else if (!name.trim()) {
      toast.error('Give this meter a name, e.g. "Borehole Main Meter"');
      return;
    }
    save.mutate(
      {
        id: value?.id,
        meterNumber: meterNumber.trim(),
        meterType,
        name: isHousehold ? undefined : name.trim(),
        location: isHousehold ? undefined : location || undefined,
        customerId: isHousehold && customerMode === "existing" ? customerId : undefined,
        customerName: isHousehold && customerMode === "new" ? customerName.trim() : undefined,
        plotNo: isHousehold ? plotNo || undefined : undefined,
        installedAt: installedAt || undefined,
        zoneId: subzoneId || zoneId || undefined,
        isActive,
        vendingSystem,
        replacesMeterId: replacesMeterId || undefined,
      },
      {
        onSuccess: () => {
          toast.success(value ? "Meter updated" : "Meter registered");
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{value ? "Edit meter" : "Register meter"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Meter number</Label>
            <Input value={meterNumber} onChange={(e) => setMeterNumber(e.target.value)} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={meterType} onValueChange={(v) => setMeterType(v as WaterMeterType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(WATER_METER_TYPE_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isHousehold ? (
          <>
            <div>
              <div className="flex items-center justify-between">
                <Label>Customer assigned</Label>
                <button
                  type="button"
                  onClick={() => setCustomerMode(customerMode === "existing" ? "new" : "existing")}
                  className="text-[0.6875rem] text-primary hover:underline"
                >
                  {customerMode === "existing" ? "+ New customer" : "Pick existing customer"}
                </button>
              </div>
              {customerMode === "existing" ? (
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(customersQ.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer's full name"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plot number</Label>
                <Input value={plotNo} onChange={(e) => setPlotNo(e.target.value)} />
              </div>
              <div>
                <Label>Date of installation</Label>
                <Input
                  type="date"
                  value={installedAt}
                  onChange={(e) => setInstalledAt(e.target.value)}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground -mt-1">
              {meterType === "main"
                ? "One of the network's two main-stage meters — borehole into the tank, or tank into the distribution network. No customer; readings are taken directly off this meter's dial."
                : "A zone bulk meter — used only to take dial readings for reconciling that zone's usage. No customer; assigning it a zone below covers that zone and every sub-zone nested under it."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                {meterType === "main" ? (
                  <Select value={name} onValueChange={setName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage…" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAIN_METER_NAMES.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Zone A Bulk Meter"
                  />
                )}
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Borehole pump house"
                />
              </div>
            </div>
            <div>
              <Label>Date of installation</Label>
              <Input
                type="date"
                value={installedAt}
                onChange={(e) => setInstalledAt(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{isHousehold ? "Zone (optional)" : "Zone covered (optional)"}</Label>
            <Select
              value={zoneId || NONE}
              onValueChange={(v) => {
                setZoneId(v === NONE ? "" : v);
                setSubzoneId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {topLevelZones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sub-zone (optional)</Label>
            <Select
              value={subzoneId || NONE}
              onValueChange={(v) => setSubzoneId(v === NONE ? "" : v)}
              disabled={!zoneId || subzoneOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {subzoneOptions.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {!isHousehold && zoneId && (
          <p className="text-[0.6875rem] text-muted-foreground -mt-2">
            This meter's readings will be reconciled against{" "}
            {subzoneId
              ? (allZones.find((z) => z.id === subzoneId)?.name ?? "the selected sub-zone")
              : (allZones.find((z) => z.id === zoneId)?.name ?? "the selected zone")}{" "}
            and every sub-zone nested under it.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vending system</Label>
            <Select
              value={vendingSystem}
              onValueChange={(v) => setVendingSystem(v as WaterVendingSystem)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(WATER_VENDING_SYSTEM_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Replaces meter (optional)</Label>
            <Select
              value={replacesMeterId || NONE}
              onValueChange={(v) => setReplacesMeterId(v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {replaceableMeters.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.meter_number} ({WATER_VENDING_SYSTEM_LABELS[m.vending_system]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isHousehold && replacesMeterId && !customerId && customerMode === "existing" && (
          <p className="text-[0.6875rem] text-muted-foreground -mt-2">
            The replaced meter's customer will carry forward automatically unless you pick a
            different one above.
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label>Active</Label>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
