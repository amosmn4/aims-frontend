import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  mainStageFromName,
  useSaveWaterMeter,
  useWaterAllZones,
  useWaterCustomers,
  useWaterMeters,
  WATER_MAIN_STAGE_LABELS,
  WATER_METER_TYPE_LABELS,
  WATER_VENDING_SYSTEM_LABELS,
  type WaterMainStage,
  type WaterMeterRow,
  type WaterMeterType,
  type WaterVendingSystem,
  type WaterZoneTreeNode,
} from "@/features/water/use-water";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NONE = "__none__";

export type MeterFormValue = Pick<
  WaterMeterRow,
  | "id"
  | "meter_number"
  | "meter_type"
  | "name"
  | "location"
  | "customer_id"
  | "customer_name"
  | "plot_no"
  | "installed_at"
  | "zone_id"
  | "is_active"
  | "vending_system"
  | "replaces_meter_id"
> &
  // Optional so callers built from the meter detail endpoint still type-check.
  Partial<Pick<WaterMeterRow, "main_stage">>;

type MeterErrors = Partial<
  Record<"meterNumber" | "customer" | "name" | "mainStage" | "zone", string>
>;

interface ZoneOption {
  id: string;
  name: string;
  depth: number;
}

/** The zone tree flattened depth-first, so the picker can indent any depth. */
function zoneTreeOptions(zones: WaterZoneTreeNode[]): ZoneOption[] {
  const ids = new Set(zones.map((z) => z.id));
  const byParent = new Map<string, WaterZoneTreeNode[]>();
  for (const z of zones) {
    const key = z.parent_zone_id && ids.has(z.parent_zone_id) ? z.parent_zone_id : "";
    byParent.set(key, [...(byParent.get(key) ?? []), z]);
  }
  const out: ZoneOption[] = [];
  const seen = new Set<string>();
  const walk = (parent: string, depth: number) => {
    const children = [...(byParent.get(parent) ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    for (const z of children) {
      // Guards a cycle in the stored parents.
      if (seen.has(z.id)) continue;
      seen.add(z.id);
      out.push({ id: z.id, name: z.name, depth });
      walk(z.id, depth + 1);
    }
  };
  walk("", 0);
  return out;
}

/** One picker for the whole zone tree; indentation carries the nesting. */
function ZoneTreeSelect({
  id,
  value,
  onChange,
  options,
  emptyLabel,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (zoneId: string) => void;
  options: ZoneOption[];
  /** Given when no zone is a valid answer — the label for that choice. */
  emptyLabel?: string;
  invalid?: Record<string, unknown>;
}) {
  return (
    <Select
      value={value || (emptyLabel ? NONE : undefined)}
      onValueChange={(v) => onChange(v === NONE ? "" : v)}
    >
      <SelectTrigger id={id} {...invalid}>
        <SelectValue placeholder={emptyLabel ?? "Select zone…"} />
      </SelectTrigger>
      <SelectContent>
        {emptyLabel && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
        {options.map((z) => (
          <SelectItem key={z.id} value={z.id} style={{ paddingLeft: 8 + z.depth * 16 }}>
            {z.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Add ("new") or edit a meter of any type; shared by the Meters Registry and meter detail page.
export function MeterFormDialog({
  value,
  defaultType = "household",
  onClose,
}: {
  value: MeterFormValue | "new" | null;
  defaultType?: WaterMeterType;
  onClose: () => void;
}) {
  const allZonesQ = useWaterAllZones();
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };

  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && guardClose(close)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {value &&
          (allZonesQ.isLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : allZonesQ.isError ? (
            <LoadError what="zones" error={allZonesQ.error} onRetry={() => allZonesQ.refetch()} />
          ) : (
            <MeterForm
              value={value === "new" ? null : value}
              defaultType={defaultType}
              allZones={allZonesQ.data ?? []}
              onDirtyChange={setDirty}
              onCancel={() => guardClose(close)}
              onDone={close}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}

function MeterForm({
  value,
  defaultType,
  allZones,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  value: MeterFormValue | null;
  defaultType: WaterMeterType;
  allZones: WaterZoneTreeNode[];
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const save = useSaveWaterMeter();
  const customersQ = useWaterCustomers();
  const allMetersQ = useWaterMeters();

  const initial = {
    meterNumber: value?.meter_number ?? "",
    meterType: value?.meter_type ?? defaultType,
    mainStage: value?.main_stage ?? mainStageFromName(value?.name) ?? ("" as WaterMainStage | ""),
    name: value?.name ?? "",
    location: value?.location ?? "",
    customerId: value?.customer_id ?? "",
    customerName: value?.customer_name ?? "",
    plotNo: value?.plot_no ?? "",
    installedAt: value?.installed_at?.slice(0, 10) ?? "",
    vendingSystem: value?.vending_system ?? ("amsol" as WaterVendingSystem),
    replacesMeterId: value?.replaces_meter_id ?? "",
    zoneId: value?.zone_id ?? "",
    isActive: value?.is_active ?? true,
  };

  const [meterNumber, setMeterNumber] = useState(initial.meterNumber);
  const [meterType, setMeterType] = useState<WaterMeterType>(initial.meterType);
  const isHousehold = meterType === "household";
  const isMain = meterType === "main";
  const [mainStage, setMainStage] = useState<WaterMainStage | "">(initial.mainStage);
  const [name, setName] = useState(initial.name);
  const [location, setLocation] = useState(initial.location);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    value?.customer_id ? "existing" : "new",
  );
  const [customerId, setCustomerId] = useState(initial.customerId);
  const [customerName, setCustomerName] = useState(initial.customerName);
  const [plotNo, setPlotNo] = useState(initial.plotNo);
  const [installedAt, setInstalledAt] = useState(initial.installedAt);
  const [vendingSystem, setVendingSystem] = useState<WaterVendingSystem>(initial.vendingSystem);
  const [replacesMeterId, setReplacesMeterId] = useState(initial.replacesMeterId);
  const [zoneId, setZoneId] = useState(initial.zoneId);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [errors, setErrors] = useState<MeterErrors>({});

  const allMeters = useMemo(() => allMetersQ.data ?? [], [allMetersQ.data]);
  const replaceableMeters = allMeters.filter((m) => m.id !== value?.id);
  const zoneOptions = useMemo(() => zoneTreeOptions(allZones), [allZones]);

  // Two bulk meters on one zone are added together, so flag it before a second is added.
  const zoneAlreadyMetered =
    !value &&
    meterType === "bulk" &&
    !!zoneId &&
    allMeters.some((m) => m.meter_type === "bulk" && m.zone_id === zoneId && m.is_active);
  const zoneName = zoneOptions.find((z) => z.id === zoneId)?.name ?? "This zone";

  const current = {
    meterNumber,
    meterType,
    mainStage,
    name,
    location,
    customerId,
    customerName,
    plotNo,
    installedAt,
    vendingSystem,
    replacesMeterId,
    zoneId,
    isActive,
  };
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (k) => initial[k] !== current[k],
  );
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const clearError = (key: keyof MeterErrors) =>
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const submit = () => {
    const found: MeterErrors = {};
    if (!meterNumber.trim()) found.meterNumber = "Enter the number printed on the meter";
    if (isHousehold) {
      if (customerMode === "new" && !customerName.trim()) {
        found.customer = "Enter the customer's name, or pick an existing customer";
      }
      if (customerMode === "existing" && !customerId) {
        found.customer = "Choose a customer, or add a new one";
      }
    } else {
      if (!name.trim()) found.name = "Give this meter a name";
      if (isMain && !mainStage) found.mainStage = "Choose the stage this meter measures";
      if (!isMain && !zoneId) found.zone = "Choose the zone this meter feeds";
    }
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    save.mutate(
      {
        id: value?.id,
        meterNumber: meterNumber.trim(),
        meterType,
        mainStage: isMain ? (mainStage as WaterMainStage) : null,
        name: isHousehold ? undefined : name.trim(),
        location: isHousehold ? undefined : location.trim(),
        customerId: isHousehold && customerMode === "existing" ? customerId : undefined,
        customerName: isHousehold && customerMode === "new" ? customerName.trim() : undefined,
        plotNo: isHousehold ? plotNo.trim() : undefined,
        installedAt,
        // A main meter sits above every zone; keep whatever it already had.
        zoneId: isMain ? initial.zoneId : zoneId,
        isActive,
        vendingSystem,
        replacesMeterId,
      },
      {
        onSuccess: () => {
          toast.success(
            value ? `Meter ${meterNumber.trim()} updated` : `Meter ${meterNumber.trim()} added`,
          );
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save meter"),
      },
    );
  };

  const invalid = (key: keyof MeterErrors, id: string) =>
    errors[key] ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{value ? `Edit meter ${value.meter_number}` : "Add meter"}</DialogTitle>
        <DialogDescription>Meter details and where it sits in the network.</DialogDescription>
      </DialogHeader>
      <RequiredNote />
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="meter-number" label="Meter number" required error={errors.meterNumber}>
            <Input
              id="meter-number"
              value={meterNumber}
              placeholder="e.g. 58000185700"
              onChange={(e) => {
                setMeterNumber(e.target.value);
                clearError("meterNumber");
              }}
              {...invalid("meterNumber", "meter-number")}
            />
          </FormField>
          <FormField id="meter-type" label="Meter type" required>
            <Select
              value={meterType}
              onValueChange={(v) => {
                setMeterType(v as WaterMeterType);
                setErrors({});
              }}
            >
              <SelectTrigger id="meter-type">
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
          </FormField>
        </div>

        {isHousehold ? (
          <>
            <div className="space-y-1">
              <FormField
                id="meter-customer"
                label="Customer assigned"
                required
                error={errors.customer}
              >
                {customerMode === "existing" ? (
                  <Select
                    value={customerId}
                    onValueChange={(v) => {
                      setCustomerId(v);
                      clearError("customer");
                    }}
                  >
                    <SelectTrigger id="meter-customer" {...invalid("customer", "meter-customer")}>
                      <SelectValue
                        placeholder={
                          customersQ.isLoading ? "Loading customers…" : "Select customer…"
                        }
                      />
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
                    id="meter-customer"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      clearError("customer");
                    }}
                    placeholder="New customer's full name"
                    {...invalid("customer", "meter-customer")}
                  />
                )}
              </FormField>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => {
                  setCustomerMode(customerMode === "existing" ? "new" : "existing");
                  clearError("customer");
                }}
              >
                {customerMode === "existing"
                  ? "Customer not listed? Add a new customer"
                  : "Pick an existing customer instead"}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField id="meter-plot" label="Plot number (optional)">
                <Input id="meter-plot" value={plotNo} onChange={(e) => setPlotNo(e.target.value)} />
              </FormField>
              <FormField id="meter-installed" label="Date of installation (optional)">
                <Input
                  id="meter-installed"
                  type="date"
                  value={installedAt}
                  onChange={(e) => setInstalledAt(e.target.value)}
                />
              </FormField>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isMain && (
              <FormField id="meter-stage" label="Stage measured" required error={errors.mainStage}>
                <Select
                  value={mainStage || undefined}
                  onValueChange={(v) => {
                    setMainStage(v as WaterMainStage);
                    clearError("mainStage");
                  }}
                >
                  <SelectTrigger id="meter-stage" {...invalid("mainStage", "meter-stage")}>
                    <SelectValue placeholder="Select stage…" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(WATER_MAIN_STAGE_LABELS).map(([stage, label]) => (
                      <SelectItem key={stage} value={stage}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <FormField id="meter-name" label="Meter name" required error={errors.name}>
              <Input
                id="meter-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                placeholder={isMain ? "e.g. Main Zone Meter" : "e.g. Zone A Bulk Meter"}
                {...invalid("name", "meter-name")}
              />
            </FormField>
            <FormField id="meter-location" label="Location (optional)">
              <Input
                id="meter-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Borehole pump house"
              />
            </FormField>
            <FormField id="meter-installed" label="Date of installation (optional)">
              <Input
                id="meter-installed"
                type="date"
                value={installedAt}
                onChange={(e) => setInstalledAt(e.target.value)}
              />
            </FormField>
          </div>
        )}

        {!isMain && (
          <FormField
            id="meter-zone"
            label={isHousehold ? "Zone (optional)" : "Zone covered"}
            required={!isHousehold}
            error={errors.zone}
            hint={
              zoneAlreadyMetered ? (
                <span className="text-warning">{zoneName} already has a bulk meter</span>
              ) : undefined
            }
          >
            <ZoneTreeSelect
              id="meter-zone"
              value={zoneId}
              onChange={(v) => {
                setZoneId(v);
                clearError("zone");
              }}
              options={zoneOptions}
              emptyLabel={isHousehold ? "On the main line" : undefined}
              invalid={invalid("zone", "meter-zone")}
            />
          </FormField>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="meter-vending" label="Vending system" required>
            <Select
              value={vendingSystem}
              onValueChange={(v) => setVendingSystem(v as WaterVendingSystem)}
            >
              <SelectTrigger id="meter-vending">
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
          </FormField>
          <FormField
            id="meter-replaces"
            label="Replaces meter (optional)"
            hint={
              replacesMeterId && replacesMeterId !== value?.replaces_meter_id
                ? "The replaced meter will be set to Inactive."
                : undefined
            }
          >
            <Select
              value={replacesMeterId || NONE}
              onValueChange={(v) => setReplacesMeterId(v === NONE ? "" : v)}
            >
              <SelectTrigger id="meter-replaces">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {replaceableMeters.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.meter_number} ({WATER_VENDING_SYSTEM_LABELS[m.vending_system]})
                    {!m.is_active && " · Inactive"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Switch id="meter-active" checked={isActive} onCheckedChange={setIsActive} />
          <Label htmlFor="meter-active">
            {isActive ? "Active (in use)" : "Inactive (not in use)"}
          </Label>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {value ? "Save meter" : "Add meter"}
        </Button>
      </DialogFooter>
    </form>
  );
}
