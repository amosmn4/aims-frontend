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
import { useReadingReview, type ReadingReview } from "./use-reading-review";
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
  value: number | null;
  cumulative_usage?: number | null;
  notes: string | null;
}

/** Household captures keep lifetime usage and prepaid units remaining separate. */
export type ReadingKind = "network" | "household";

type ReadingErrors = Partial<
  Record<"meter" | "readingDate" | "reading" | "cumulativeUsage", string>
>;

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
  const reviewReading = useReadingReview();
  const [review, setReview] = useState<ReadingReview | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [confirmAnother, setConfirmAnother] = useState(false);
  const initialMeterId = value?.meter_id ?? fixedMeterId ?? "";
  const [initialDate] = useState(() =>
    toLocalDateTimeInputValue(value?.reading_date ?? new Date()),
  );
  const [meterId, setMeterId] = useState(initialMeterId);
  const [meterNumber, setMeterNumber] = useState(value?.meter_number ?? "");
  const [readingDate, setReadingDate] = useState(initialDate);
  const [reading, setReading] = useState(value?.value == null ? "" : String(value.value));
  const [cumulativeUsage, setCumulativeUsage] = useState(
    value?.cumulative_usage == null ? "" : String(value.cumulative_usage),
  );
  const [notes, setNotes] = useState(value?.notes ?? "");
  const [errors, setErrors] = useState<ReadingErrors>({});
  const isPending = logReading.isPending || updateReading.isPending || reviewReading.isPending;

  useEffect(() => {
    setReview(null);
    setReviewReason("");
  }, [meterId, meterNumber, readingDate, reading, cumulativeUsage]);

  const dirty =
    meterId !== initialMeterId ||
    readingDate !== initialDate ||
    reading !== (value?.value == null ? "" : String(value.value)) ||
    cumulativeUsage !== (value?.cumulative_usage == null ? "" : String(value.cumulative_usage)) ||
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

  const submit = async (addAnother: boolean, confirmed = false) => {
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
    const num = reading.trim() ? Number(reading) : null;
    if (!reading.trim() && (!household || !cumulativeUsage.trim()))
      found.reading = household
        ? "Enter the balance shown on the meter"
        : "Enter the number shown on the meter's dial";
    else if (num !== null && (!Number.isFinite(num) || num < 0))
      found.reading = "Enter a number of 0 or more";
    const cumulative = cumulativeUsage.trim() ? Number(cumulativeUsage) : null;
    if (
      household &&
      cumulative !== null &&
      (!Number.isFinite(cumulative) ||
        cumulative < 0 ||
        cumulative > 999999999999.99 ||
        Math.abs(cumulative * 100 - Math.round(cumulative * 100)) > 0.00001)
    )
      found.cumulativeUsage = "Enter a nonnegative reading with at most two decimal places";
    setErrors(found);
    if (Object.values(found).some(Boolean) || !chosenMeterId) return;

    let checked: ReadingReview;
    try {
      checked = await reviewReading.mutateAsync({
        meterId: chosenMeterId,
        readingDate,
        value: num,
        ...(household && { cumulativeUsage: cumulative }),
        ...(value && { excludeId: value.id }),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check meter history");
      return;
    }
    if (checked.warnings.length && (!confirmed || review?.reviewToken !== checked.reviewToken)) {
      setReview(checked);
      setConfirmAnother(addAnother);
      return;
    }
    if (checked.warnings.length && reviewReason.trim().length < 5) return;
    const confirmation = checked.warnings.length
      ? { reviewToken: checked.reviewToken, reviewReason: reviewReason.trim() }
      : {};

    const onError = (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Couldn't save reading");
    const noun = "Reading";

    if (value) {
      updateReading.mutate(
        {
          id: value.id,
          meterId: chosenMeterId,
          readingDate,
          value: num,
          ...(household && { cumulativeUsage: cumulative }),
          notes: notes.trim() || null,
          ...confirmation,
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
      {
        meterId: chosenMeterId,
        readingDate,
        value: num,
        ...(household && { cumulativeUsage: cumulative }),
        notes: notes.trim() || undefined,
        ...confirmation,
      },
      {
        onSuccess: () => {
          toast.success(`${noun} recorded`);
          if (!addAnother) return onDone();
          setReading("");
          setCumulativeUsage("");
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
    ? `Edit reading on meter ${value.meter_number}`
    : household
      ? `Record household reading${fixedMeter ? ` on meter ${fixedMeter.meter_number}` : ""}`
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
              ? "Capture the lifetime units used, the prepaid units remaining, or both. Missing figures stay uncaptured."
              : "Enter the number on the dial of a main or bulk meter."}
          </DialogDescription>
        </DialogHeader>
        <RequiredNote />
        <fieldset className="space-y-3" disabled={isPending}>
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
              label={household ? "Remaining prepaid units (m³)" : "Reading value (m³)"}
              required={!household}
              error={errors.reading}
              hint={
                household
                  ? "Purchased units still available on the meter, not its lifetime usage."
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
          {household && (
            <FormField
              id="reading-cumulative"
              label="Cumulative usage (m³)"
              error={errors.cumulativeUsage}
              hint={
                value && value.cumulative_usage == null
                  ? "This older capture has no usage counter. Add it only if you know the reading at that time."
                  : "Lifetime units used. A rise from 519 to 525 means 6 m³ used between captures."
              }
            >
              <Input
                id="reading-cumulative"
                type="number"
                min="0"
                max="999999999999.99"
                step="0.01"
                inputMode="decimal"
                value={cumulativeUsage}
                onChange={(e) => {
                  setCumulativeUsage(e.target.value);
                  clearError("cumulativeUsage");
                }}
                {...invalid("cumulativeUsage", "reading-cumulative")}
              />
            </FormField>
          )}
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
        </fieldset>
        {review && review.warnings.length > 0 && (
          <div
            role="alert"
            className="space-y-3 rounded-lg border border-destructive bg-destructive/5 p-4"
          >
            <p className="font-semibold text-destructive">Check this reading before recording</p>
            {review.warnings.map((warning) => (
              <p key={warning.code} className="text-sm text-destructive">
                {warning.message}
              </p>
            ))}
            <FormField id="reading-review-reason" label="Why is this reading correct?" required>
              <Input
                id="reading-review-reason"
                value={reviewReason}
                maxLength={300}
                disabled={isPending}
                onChange={(event) => setReviewReason(event.target.value)}
                placeholder="Explain what you checked, including any reset or rollover"
              />
            </FormField>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || reviewReason.trim().length < 5}
              onClick={() => submit(confirmAnother, true)}
            >
              I checked this reading, record anyway
            </Button>
          </div>
        )}
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
            {value ? "Save reading" : household ? "Record reading" : "Record reading"}
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
