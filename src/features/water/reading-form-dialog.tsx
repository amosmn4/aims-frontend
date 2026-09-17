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
  reading_date: string;
  value: number;
  notes: string | null;
}

type ReadingErrors = Partial<Record<"meter" | "readingDate" | "reading", string>>;

// Add ("new") or edit a main/bulk dial reading. `meterId` locks the meter (e.g. on a meter's page).
export function ReadingFormDialog({
  value,
  meterId,
  onClose,
}: {
  value: ReadingFormValue | "new" | null;
  meterId?: string;
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
  onDirtyChange,
  onCancel,
  onDone,
}: {
  value: ReadingFormValue | null;
  fixedMeterId?: string;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const metersQ = useWaterMeters();
  const canManage = useCanManageWater();
  const [addingMeter, setAddingMeter] = useState(false);
  const logReading = useLogWaterReading();
  const updateReading = useUpdateWaterReading();
  const initialMeterId = value?.meter_id ?? fixedMeterId ?? "";
  const [initialDate] = useState(() =>
    toLocalDateTimeInputValue(value?.reading_date ?? new Date()),
  );
  const [meterId, setMeterId] = useState(initialMeterId);
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
    (m) => m.meter_type !== "household" && (m.is_active || m.id === value?.meter_id),
  );
  const selectedMissing = !!meterId && !readingMeters.some((m) => m.id === meterId);

  const clearError = (key: keyof ReadingErrors) =>
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const submit = (addAnother: boolean) => {
    const found: ReadingErrors = {};
    if (!meterId) found.meter = "Choose the meter this reading was taken from";
    if (!readingDate) found.readingDate = "Enter when the reading was taken";
    const num = Number(reading);
    if (!reading.trim()) found.reading = "Enter the number shown on the meter's dial";
    else if (!Number.isFinite(num) || num < 0) found.reading = "Enter a number of 0 or more";
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    const onError = (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Couldn't save reading");

    if (value) {
      updateReading.mutate(
        { id: value.id, meterId, readingDate, value: num, notes: notes.trim() || null },
        {
          onSuccess: () => {
            toast.success("Reading updated");
            onDone();
          },
          onError,
        },
      );
      return;
    }
    logReading.mutate(
      { meterId, readingDate, value: num, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Reading recorded");
          if (!addAnother) return onDone();
          setReading("");
          setNotes("");
          if (!fixedMeterId) setMeterId("");
        },
        onError,
      },
    );
  };

  const invalid = (key: keyof ReadingErrors, id: string) =>
    errors[key] ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};

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
          <DialogTitle>
            {value ? `Edit reading on meter ${value.meter_number}` : "Record reading"}
          </DialogTitle>
          <DialogDescription>
            Enter the number on the dial of a main or bulk meter. Household meters get their usage
            from uploaded payment files instead.
          </DialogDescription>
        </DialogHeader>
        <RequiredNote />
        <div className="space-y-3">
          <FormField id="reading-meter" label="Meter" required error={errors.meter}>
            <Select
              value={meterId}
              onValueChange={(v) => {
                setMeterId(v);
                clearError("meter");
              }}
              disabled={!!fixedMeterId}
            >
              <SelectTrigger id="reading-meter" {...invalid("meter", "reading-meter")}>
                <SelectValue
                  placeholder={metersQ.isLoading ? "Loading meters…" : "Select meter…"}
                />
              </SelectTrigger>
              <SelectContent>
                {selectedMissing && value && (
                  <SelectItem value={meterId}>{value.meter_number}</SelectItem>
                )}
                {readingMeters.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.meter_number}
                    {m.name ? ` — ${m.name}` : ""} ({WATER_METER_TYPE_LABELS[m.meter_type]}
                    {m.zone_name ? `, ${m.zone_name}` : ""})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {metersQ.isError && (
            <p className="text-xs text-destructive">
              Couldn't load the meter list.{" "}
              <button type="button" className="underline" onClick={() => metersQ.refetch()}>
                Try again
              </button>
            </p>
          )}
          {!metersQ.isLoading && !metersQ.isError && readingMeters.length === 0 && (
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
              label="Reading value (m³)"
              required
              error={errors.reading}
              hint="The full number on the dial. 1 m³ = 1,000 litres."
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
                placeholder="e.g. 1420"
                {...invalid("reading", "reading-value")}
              />
            </FormField>
          </div>
          <FormField id="reading-notes" label="Notes (optional)">
            <Input
              id="reading-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dial was fogged"
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
            {value ? "Save reading" : "Record reading"}
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
