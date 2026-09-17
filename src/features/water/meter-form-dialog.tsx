import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  useSaveWaterMeter,
  useWaterAllZones,
  useWaterCustomers,
  useWaterMeters,
  WATER_METER_TYPE_LABELS,
  WATER_VENDING_SYSTEM_LABELS,
  MAIN_METER_NAMES,
  type WaterMeterRow,
  type WaterMeterType,
  type WaterVendingSystem,
  type WaterZoneTreeNode,
} from "@/features/water/use-water";
import { WATER_TERMS } from "@/features/water/water-ui";
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
>;

type MeterErrors = Partial<Record<"meterNumber" | "customer" | "name", string>>;

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

  const currentZoneNode = allZones.find((z) => z.id === value?.zone_id);
  const initial = {
    meterNumber: value?.meter_number ?? "",
    meterType: value?.meter_type ?? defaultType,
    name: value?.name ?? "",
    location: value?.location ?? "",
    customerId: value?.customer_id ?? "",
    customerName: value?.customer_name ?? "",
    plotNo: value?.plot_no ?? "",
    installedAt: value?.installed_at?.slice(0, 10) ?? "",
    vendingSystem: value?.vending_system ?? ("amsol" as WaterVendingSystem),
    replacesMeterId: value?.replaces_meter_id ?? "",
    zoneId: currentZoneNode?.parent_zone_id
      ? currentZoneNode.parent_zone_id
      : (value?.zone_id ?? ""),
    subzoneId: currentZoneNode?.parent_zone_id ? (value?.zone_id ?? "") : "",
    isActive: value?.is_active ?? true,
  };

  const [meterNumber, setMeterNumber] = useState(initial.meterNumber);
  const [meterType, setMeterType] = useState<WaterMeterType>(initial.meterType);
  const isHousehold = meterType === "household";
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
  const [subzoneId, setSubzoneId] = useState(initial.subzoneId);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [errors, setErrors] = useState<MeterErrors>({});

  const replaceableMeters = (allMetersQ.data ?? []).filter((m) => m.id !== value?.id);
  const topLevelZones = allZones.filter((z) => !z.parent_zone_id);
  const subzoneOptions = allZones.filter((z) => z.parent_zone_id === zoneId);

  const current = {
    meterNumber,
    meterType,
    name,
    location,
    customerId,
    customerName,
    plotNo,
    installedAt,
    vendingSystem,
    replacesMeterId,
    zoneId,
    subzoneId,
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
    } else if (!name.trim()) {
      found.name =
        meterType === "main" ? "Choose which stage this meter measures" : "Give this meter a name";
    }
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    save.mutate(
      {
        id: value?.id,
        meterNumber: meterNumber.trim(),
        meterType,
        name: isHousehold ? undefined : name.trim(),
        location: isHousehold ? undefined : location.trim(),
        customerId: isHousehold && customerMode === "existing" ? customerId : undefined,
        customerName: isHousehold && customerMode === "new" ? customerName.trim() : undefined,
        plotNo: isHousehold ? plotNo.trim() : undefined,
        installedAt,
        zoneId: subzoneId || zoneId,
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
        <DialogDescription>
          Register a main, bulk or household meter and where it sits in the network.
        </DialogDescription>
      </DialogHeader>
      <RequiredNote />
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            id="meter-number"
            label="Meter number"
            required
            error={errors.meterNumber}
            hint="As printed on the meter, e.g. 58000185700"
          >
            <Input
              id="meter-number"
              value={meterNumber}
              onChange={(e) => {
                setMeterNumber(e.target.value);
                clearError("meterNumber");
              }}
              {...invalid("meterNumber", "meter-number")}
            />
          </FormField>
          <FormField id="meter-type" label="Type" required hint={WATER_TERMS[meterType].body}>
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                id="meter-name"
                label={meterType === "main" ? "Stage measured" : "Name"}
                required
                error={errors.name}
                hint={
                  meterType === "main"
                    ? "Borehole into the tank, or tank into the network"
                    : undefined
                }
              >
                {meterType === "main" ? (
                  <Select
                    value={name}
                    onValueChange={(v) => {
                      setName(v);
                      clearError("name");
                    }}
                  >
                    <SelectTrigger id="meter-name" {...invalid("name", "meter-name")}>
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
                    id="meter-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearError("name");
                    }}
                    placeholder="e.g. Zone A Bulk Meter"
                    {...invalid("name", "meter-name")}
                  />
                )}
              </FormField>
              <FormField id="meter-location" label="Location (optional)">
                <Input
                  id="meter-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Borehole pump house"
                />
              </FormField>
            </div>
            <FormField id="meter-installed" label="Date of installation (optional)">
              <Input
                id="meter-installed"
                type="date"
                value={installedAt}
                onChange={(e) => setInstalledAt(e.target.value)}
              />
            </FormField>
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            id="meter-zone"
            label={isHousehold ? "Zone (optional)" : "Zone covered (optional)"}
          >
            <Select
              value={zoneId || NONE}
              onValueChange={(v) => {
                setZoneId(v === NONE ? "" : v);
                setSubzoneId("");
              }}
            >
              <SelectTrigger id="meter-zone">
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
          </FormField>
          <FormField
            id="meter-subzone"
            label="Sub-zone (optional)"
            hint={zoneId && subzoneOptions.length === 0 ? "This zone has no sub-zones." : undefined}
          >
            <Select
              value={subzoneId || NONE}
              onValueChange={(v) => setSubzoneId(v === NONE ? "" : v)}
              disabled={!zoneId || subzoneOptions.length === 0}
            >
              <SelectTrigger id="meter-subzone">
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
          </FormField>
        </div>
        {!isHousehold && zoneId && (
          <p className="text-xs text-muted-foreground -mt-2">
            Readings from this meter are compared against{" "}
            {subzoneId
              ? (allZones.find((z) => z.id === subzoneId)?.name ?? "the selected sub-zone")
              : (allZones.find((z) => z.id === zoneId)?.name ?? "the selected zone")}{" "}
            and every sub-zone inside it.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            id="meter-vending"
            label="Vending system"
            required
            hint={WATER_TERMS.vending.body}
          >
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
                ? "The replaced meter will be set to Inactive when you save."
                : "Pick the old meter if this one was fitted in its place."
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
        {isHousehold && replacesMeterId && !customerId && customerMode === "existing" && (
          <p className="text-xs text-muted-foreground -mt-2">
            The replaced meter's customer carries forward unless you pick a different one above.
          </p>
        )}

        <div className="flex items-start gap-2 pt-1">
          <Switch
            id="meter-active"
            checked={isActive}
            onCheckedChange={setIsActive}
            className="mt-0.5"
          />
          <div>
            <Label htmlFor="meter-active">
              {isActive ? "Active (in use)" : "Inactive (not in use)"}
            </Label>
            <p className="text-xs text-muted-foreground">
              Switch off when the meter is no longer in use. Its history stays, but it's left out of
              new readings and active meter counts.
            </p>
          </div>
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
