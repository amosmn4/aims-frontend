import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  useCanManageWater,
  useLogWaterReading,
  useUpdateWaterReading,
  useWaterMeters,
  toLocalDateTimeInputValue,
  WATER_METER_TYPE_LABELS,
  type WaterMeterType,
} from "@/features/water/use-water";
import { MeterFormDialog } from "@/features/water/meter-form-dialog";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export interface ReadingFormValue {
  id: string;
  meter_id: string;
  meter_number: string;
  meter_type?: WaterMeterType;
  reading_date: string;
  value: number;
  notes: string | null;
}

/** "network": main/bulk dial totals. "household": prepaid balance left on the meter. */
export type ReadingKind = "network" | "household";

type ReadingErrors = Partial<Record<"meter" | "readingDate" | "reading", string>>;

// Add ("new") or edit a reading. `meterId` locks the meter (e.g. on a meter's page).
export function ReadingFormDialog({
  value,
  meterId,
  kind = "network",
  onClose,
}: {
  value: ReadingFormValue | "new" | null;
  meterId?: string;
  kind?: ReadingKind;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };

  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && guardClose(close)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {value && (
          <ReadingForm
            value={value === "new" ? null : value}
            fixedMeterId={meterId}
            kind={value !== "new" && value.meter_type === "household" ? "household" : kind}
            onDirtyChange={setDirty}
            onCancel={() => guardClose(close)}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReadingForm({
  value,
  fixedMeterId,
  kind,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  value: ReadingFormValue | null;
  fixedMeterId?: string;
  kind: ReadingKind;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const household = kind === "household";
  const metersQ = useWaterMeters(household ? { meterType: "household" } : undefined);
  const canManage = useCanManageWater();
  const [addingMeter, setAddingMeter] = useState(false);
  const logReading = useLogWaterReading();
  const updateReading = useUpdateWaterReading();
  const initialMeterId = value?.meter_id ?? fixedMeterId ?? "";
  const [initialDate] = useState(() =>
    toLocalDateTimeInputValue(value?.reading_date ?? new Date()),
  );
  const [meterId, setMeterId] = useState(initialMeterId);
  const [meterNumber, setMeterNumber] = useState(value?.meter_number ?? "");
  const [readingDate, setReadingDate] = useState(initialDate);
  const [reading, setReading] = useState(value ? String(value.value) : "");
  const [notes, setNotes] = useState(value?.notes ?? "");
  const [errors, setErrors] = useState<ReadingErrors>({});
  const isPending = logReading.isPending || updateReading.isPending;

  const dirty =
    meterId !== initialMeterId ||
    readingDate !== initialDate ||
    reading !== (value ? String(value.value) : "") ||
    notes !== (value?.notes ?? "");
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const readingMeters = (metersQ.data ?? []).filter(
    (m) =>
      (household ? m.meter_type === "household" : m.meter_type !== "household") &&
      (m.is_active || m.id === value?.meter_id),
  );
  const selectedMissing = !!meterId && !readingMeters.some((m) => m.id === meterId);
  const typedMeter = household
    ? readingMeters.find((m) => m.meter_number.toLowerCase() === meterNumber.trim().toLowerCase())
    : undefined;
  const fixedMeter = fixedMeterId
    ? (metersQ.data ?? []).find((m) => m.id === fixedMeterId)
    : undefined;

  const clearError = (key: keyof ReadingErrors) =>
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const submit = (addAnother: boolean) => {
    const found: ReadingErrors = {};
    const chosenMeterId = household && !fixedMeterId && !value ? typedMeter?.id : meterId;
    if (!chosenMeterId) {
      found.meter =
        household && meterNumber.trim()
          ? `No active household meter numbered ${meterNumber.trim()}`
          : household
            ? "Type the meter number"
            : "Choose the meter this reading was taken from";
    }
    if (!readingDate) found.readingDate = "Enter when the reading was taken";
    const num = Number(reading);
    if (!reading.trim())
      found.reading = household
        ? "Enter the balance shown on the meter"
        : "Enter the number shown on the meter's dial";
    else if (!Number.isFinite(num) || num < 0) found.reading = "Enter a number of 0 or more";
    setErrors(found);
    if (Object.values(found).some(Boolean) || !chosenMeterId) return;

    const onError = (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Couldn't save reading");
    const noun = household ? "Balance" : "Reading";

    if (value) {
      updateReading.mutate(
        {
          id: value.id,
          meterId: chosenMeterId,
          readingDate,
          value: num,
          notes: notes.trim() || null,
        },
        {
          onSuccess: () => {
            toast.success(`${noun} updated`);
            onDone();
          },
          onError,
        },
      );
      return;
    }
    logReading.mutate(
      { meterId: chosenMeterId, readingDate, value: num, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`${noun} recorded`);
          if (!addAnother) return onDone();
          setReading("");
          setNotes("");
          if (!fixedMeterId) {
            setMeterId("");
            setMeterNumber("");
          }
        },
        onError,
      },
    );
  };

  const invalid = (key: keyof ReadingErrors, id: string) =>
    errors[key] ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};

  const title = value
    ? `Edit ${household ? "balance" : "reading"} on meter ${value.meter_number}`
    : household
      ? `Record balance${fixedMeter ? ` on meter ${fixedMeter.meter_number}` : ""}`
      : "Record reading";

  return (
    <>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          submit(false);
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {household
              ? "Enter the credit left on the prepaid meter's screen. Usage is worked out from this and the units bought since the last balance."
              : "Enter the number on the dial of a main or bulk meter."}
          </DialogDescription>
        </DialogHeader>
        <RequiredNote />
        <div className="space-y-3">
          {household && !fixedMeterId && !value ? (
            <FormField
              id="reading-meter"
              label="Meter number"
              required
              error={errors.meter}
              hint={
                typedMeter
                  ? [
                      typedMeter.customer_name ?? "No customer",
                      typedMeter.plot_no && `Plot ${typedMeter.plot_no}`,
                      typedMeter.zone_name,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : undefined
              }
            >
              <Input
                id="reading-meter"
                list="reading-meter-options"
                value={meterNumber}
                autoFocus
                autoComplete="off"
                onChange={(e) => {
                  setMeterNumber(e.target.value);
                  clearError("meter");
                }}
                placeholder={metersQ.isLoading ? "Loading meters…" : "e.g. 04512339"}
                {...invalid("meter", "reading-meter")}
              />
              <datalist id="reading-meter-options">
                {readingMeters.map((m) => (
                  <option key={m.id} value={m.meter_number}>
                    {m.customer_name ?? ""}
                  </option>
                ))}
              </datalist>
            </FormField>
          ) : (
            <FormField id="reading-meter" label="Meter" required error={errors.meter}>
              <Select
                value={meterId}
                onValueChange={(v) => {
                  setMeterId(v);
                  clearError("meter");
                }}
                disabled={!!fixedMeterId || (household && !!value)}
              >
                <SelectTrigger id="reading-meter" {...invalid("meter", "reading-meter")}>
                  <SelectValue
                    placeholder={metersQ.isLoading ? "Loading meters…" : "Select meter…"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {selectedMissing && (
                    <SelectItem value={meterId}>
                      {value?.meter_number ?? fixedMeter?.meter_number ?? "This meter"}
                    </SelectItem>
                  )}
                  {readingMeters.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.meter_number}
                      {household
                        ? m.customer_name
                          ? ` — ${m.customer_name}`
                          : ""
                        : `${m.name ? ` — ${m.name}` : ""} (${WATER_METER_TYPE_LABELS[m.meter_type]}${m.zone_name ? `, ${m.zone_name}` : ""})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
          {metersQ.isError && (
            <p className="text-xs text-destructive">
              Couldn't load the meter list.{" "}
              <button type="button" className="underline" onClick={() => metersQ.refetch()}>
                Try again
              </button>
            </p>
          )}
          {!household && !metersQ.isLoading && !metersQ.isError && readingMeters.length === 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">
                No active main or bulk meters yet. Add one first.
              </p>
              {canManage && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAddingMeter(true)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add main or bulk meter
                </Button>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              id="reading-date"
              label="Reading date & time"
              required
              error={errors.readingDate}
            >
              <Input
                id="reading-date"
                type="datetime-local"
                value={readingDate}
                onChange={(e) => {
                  setReadingDate(e.target.value);
                  clearError("readingDate");
                }}
                {...invalid("readingDate", "reading-date")}
              />
            </FormField>
            <FormField
              id="reading-value"
              label={household ? "Balance on meter (units)" : "Reading value (m³)"}
              required
              error={errors.reading}
              hint={
                household
                  ? "The credit left, as shown on the meter."
                  : "The full number on the dial. 1 m³ = 1,000 litres."
              }
            >
              <Input
                id="reading-value"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={reading}
                onChange={(e) => {
                  setReading(e.target.value);
                  clearError("reading");
                }}
                placeholder={household ? "e.g. 8.5" : "e.g. 1420"}
                {...invalid("reading", "reading-value")}
              />
            </FormField>
          </div>
          <FormField id="reading-notes" label="Notes (optional)">
            <Input
              id="reading-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                household ? "e.g. Meter screen faint, customer present" : "e.g. Dial was fogged"
              }
            />
          </FormField>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          {!value && (
            <Button
              type="button"
              variant="outline"
              onClick={() => submit(true)}
              disabled={isPending}
            >
              Save and record another
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {value
              ? `Save ${household ? "balance" : "reading"}`
              : household
                ? "Record balance"
                : "Record reading"}
          </Button>
        </DialogFooter>
      </form>
      <MeterFormDialog
        value={addingMeter ? "new" : null}
        defaultType="main"
        onClose={() => setAddingMeter(false)}
      />
    </>
  );
}
