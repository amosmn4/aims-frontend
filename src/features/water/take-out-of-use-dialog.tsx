import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  toLocalDateTimeInputValue,
  useTakeMeterOutOfUse,
  type WaterInactiveReason,
  type WaterMeterType,
} from "@/features/water/use-water";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Errors = Partial<Record<"date" | "finalReading" | "newMeterReading", string>>;

/** Retires a meter while keeping every reading and purchase it ever had. */
export function TakeOutOfUseDialog({
  meter,
  open,
  onClose,
}: {
  meter: { id: string; meter_number: string; meter_type: WaterMeterType };
  open: boolean;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && guardClose(close)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {open && (
          <TakeOutOfUseForm
            meter={meter}
            onDirty={setDirty}
            onCancel={() => guardClose(close)}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TakeOutOfUseForm({
  meter,
  onDirty,
  onCancel,
  onDone,
}: {
  meter: { id: string; meter_number: string; meter_type: WaterMeterType };
  onDirty: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const household = meter.meter_type === "household";
  const readingLabel = household ? "balance" : "reading";
  const navigate = useNavigate();
  const takeOut = useTakeMeterOutOfUse();
  const [reason, setReason] = useState<WaterInactiveReason>("replaced");
  const [date, setDate] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [finalReading, setFinalReading] = useState("");
  const [newMeterNumber, setNewMeterNumber] = useState("");
  const [newMeterReading, setNewMeterReading] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const markDirty =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      onDirty(true);
    };

  const parse = (raw: string) => (raw.trim() === "" ? undefined : Number(raw));

  const submit = () => {
    const found: Errors = {};
    if (!date) found.date = "Enter when the meter was taken out";
    const fin = parse(finalReading);
    if (fin !== undefined && (!Number.isFinite(fin) || fin < 0))
      found.finalReading = "Enter a number of 0 or more";
    const start = parse(newMeterReading);
    if (start !== undefined && (!Number.isFinite(start) || start < 0))
      found.newMeterReading = "Enter a number of 0 or more";
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    const replacing = reason === "replaced" && !!newMeterNumber.trim();
    takeOut.mutate(
      {
        meterId: meter.id,
        reason,
        date,
        finalReading: fin,
        note: note.trim() || undefined,
        newMeterNumber: replacing ? newMeterNumber.trim() : undefined,
        newMeterReading: replacing ? start : undefined,
      },
      {
        onSuccess: (res) => {
          onDone();
          if (res.newMeter) {
            toast.success(
              `Meter ${meter.meter_number} replaced by ${newMeterNumber.trim()}. Its history is kept.`,
            );
            navigate({ to: "/water/meters/$meterId", params: { meterId: res.newMeter.id } });
          } else {
            toast.success(`Meter ${meter.meter_number} taken out of use. Its history is kept.`);
          }
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't take the meter out of use"),
      },
    );
  };

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Take meter {meter.meter_number} out of use</DialogTitle>
        <DialogDescription>
          Its readings and purchases stay in reports. It will take no new readings.
        </DialogDescription>
      </DialogHeader>
      <RequiredNote />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Why</legend>
        <RadioGroup
          value={reason}
          onValueChange={(v) => markDirty(setReason)(v as WaterInactiveReason)}
          className="gap-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem id="retire-replaced" value="replaced" />
            <Label htmlFor="retire-replaced" className="font-normal">
              Replaced by a new meter
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="retire-removed" value="removed" />
            <Label htmlFor="retire-removed" className="font-normal">
              Removed, not replaced
            </Label>
          </div>
        </RadioGroup>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="retire-date" label="Date & time" required error={errors.date}>
          <Input
            id="retire-date"
            type="datetime-local"
            value={date}
            onChange={(e) => markDirty(setDate)(e.target.value)}
            aria-invalid={!!errors.date}
          />
        </FormField>
        <FormField
          id="retire-final"
          label={`Final ${readingLabel} on this meter`}
          error={errors.finalReading}
          hint="Completes this meter's last period of use."
        >
          <Input
            id="retire-final"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={finalReading}
            onChange={(e) => markDirty(setFinalReading)(e.target.value)}
            aria-invalid={!!errors.finalReading}
          />
        </FormField>
      </div>

      {reason === "replaced" && (
        <div className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-2">
          <FormField
            id="retire-new-number"
            label="New meter number"
            hint="Leave blank to register the new meter later."
          >
            <Input
              id="retire-new-number"
              value={newMeterNumber}
              onChange={(e) => markDirty(setNewMeterNumber)(e.target.value)}
            />
          </FormField>
          <FormField
            id="retire-new-reading"
            label={`Starting ${readingLabel} on new meter`}
            error={errors.newMeterReading}
          >
            <Input
              id="retire-new-reading"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={newMeterReading}
              disabled={!newMeterNumber.trim()}
              onChange={(e) => markDirty(setNewMeterReading)(e.target.value)}
              aria-invalid={!!errors.newMeterReading}
            />
          </FormField>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            The new meter takes over the customer, zone, plot and vending system.
          </p>
        </div>
      )}

      <FormField id="retire-note" label="Note (optional)">
        <Input
          id="retire-note"
          value={note}
          maxLength={191}
          onChange={(e) => markDirty(setNote)(e.target.value)}
          placeholder={reason === "replaced" ? "e.g. Screen failed" : "e.g. House demolished"}
        />
      </FormField>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={takeOut.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={takeOut.isPending}>
          {takeOut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Take meter out of use
        </Button>
      </DialogFooter>
    </form>
  );
}
