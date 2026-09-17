import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  useSaveWaterCustomer,
  useWaterAllZones,
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

export interface CustomerFormValue {
  id: string;
  name: string;
  zone_id: string | null;
  phone: string | null;
  is_active: boolean;
}

// Add ("new") or edit a customer; shared by the Customers list and customer detail page.
export function CustomerFormDialog({
  value,
  onClose,
}: {
  value: CustomerFormValue | "new" | null;
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
            <CustomerForm
              value={value === "new" ? null : value}
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

function CustomerForm({
  value,
  allZones,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  value: CustomerFormValue | null;
  allZones: WaterZoneTreeNode[];
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const save = useSaveWaterCustomer();
  const [name, setName] = useState(value?.name ?? "");
  const [phone, setPhone] = useState(value?.phone ?? "");
  const [isActive, setIsActive] = useState(value?.is_active ?? true);
  const [nameError, setNameError] = useState<string>();

  const currentZoneNode = allZones.find((z) => z.id === value?.zone_id);
  const initialZoneId = currentZoneNode?.parent_zone_id
    ? currentZoneNode.parent_zone_id
    : (value?.zone_id ?? "");
  const initialSubzoneId = currentZoneNode?.parent_zone_id ? (value?.zone_id ?? "") : "";
  const [zoneId, setZoneId] = useState(initialZoneId);
  const [subzoneId, setSubzoneId] = useState(initialSubzoneId);

  const topLevelZones = allZones.filter((z) => !z.parent_zone_id);
  const subzoneOptions = allZones.filter((z) => z.parent_zone_id === zoneId);

  const dirty =
    name !== (value?.name ?? "") ||
    phone !== (value?.phone ?? "") ||
    isActive !== (value?.is_active ?? true) ||
    zoneId !== initialZoneId ||
    subzoneId !== initialSubzoneId;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const submit = () => {
    if (!name.trim()) {
      setNameError("Enter the customer's name");
      return;
    }
    save.mutate(
      {
        id: value?.id,
        name: name.trim(),
        zoneId: subzoneId || zoneId || undefined,
        phone: phone.trim() || undefined,
        isActive,
      },
      {
        onSuccess: () => {
          toast.success(value ? `${name.trim()} updated` : `${name.trim()} added as a customer`);
          onDone();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't save customer"),
      },
    );
  };

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
        <DialogTitle>{value ? `Edit customer ${value.name}` : "Add customer"}</DialogTitle>
        <DialogDescription>
          {value
            ? "Change the customer's details."
            : "You can also add a customer while registering their household meter."}
        </DialogDescription>
      </DialogHeader>
      <RequiredNote />
      <div className="space-y-3">
        <FormField id="customer-name" label="Full name" required error={nameError}>
          <Input
            id="customer-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(undefined);
            }}
            placeholder="e.g. Jane Wanjiku"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "customer-name-error" : undefined}
          />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="customer-zone" label="Zone (optional)">
            <Select
              value={zoneId || NONE}
              onValueChange={(v) => {
                setZoneId(v === NONE ? "" : v);
                setSubzoneId("");
              }}
            >
              <SelectTrigger id="customer-zone">
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
            id="customer-subzone"
            label="Sub-zone (optional)"
            hint={zoneId && subzoneOptions.length === 0 ? "This zone has no sub-zones." : undefined}
          >
            <Select
              value={subzoneId || NONE}
              onValueChange={(v) => setSubzoneId(v === NONE ? "" : v)}
              disabled={!zoneId || subzoneOptions.length === 0}
            >
              <SelectTrigger id="customer-subzone">
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
        <FormField id="customer-phone" label="Phone (optional)">
          <Input
            id="customer-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 0712 345 678"
            inputMode="tel"
          />
        </FormField>
        <div className="flex items-center gap-2 pt-1">
          <Switch id="customer-active" checked={isActive} onCheckedChange={setIsActive} />
          <Label htmlFor="customer-active">{isActive ? "Active" : "Inactive"}</Label>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {value ? "Save customer" : "Add customer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
