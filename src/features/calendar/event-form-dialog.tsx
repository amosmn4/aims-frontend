import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { FormField, RequiredNote } from "@/components/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, type AppRole } from "@/lib/auth";
import { useDepartments } from "@/features/clients/use-clients-contracts";
import {
  EVENT_VISIBILITY_LABELS,
  allDayIso,
  localIso,
  toDateStr,
  toTimeStr,
  useSaveCalendarEvent,
  type CalendarEvent,
  type EventVisibility,
} from "./use-calendar";

type EventForm = {
  title: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  endDate: string;
  location: string;
  description: string;
  visibility: EventVisibility;
  departmentId: string;
};

type FieldKey = keyof EventForm | "form";
type Errors = Partial<Record<FieldKey, string>>;

export type EventFormTarget =
  { mode: "create"; date?: string } | { mode: "edit"; event: CalendarEvent };

const VISIBILITY_ORDER: EventVisibility[] = ["everyone", "department", "private"];

/** Create or edit a calendar event. */
export function EventFormDialog({
  target,
  departmentId,
  onClose,
}: {
  target: EventFormTarget | null;
  departmentId?: string;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const { guardClose } = useUnsavedChanges(!!target && dirty);
  const close = () => {
    setDirty(false);
    onClose();
  };
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && guardClose(close)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {target && (
          <EventFormBody
            key={target.mode === "edit" ? target.event.id : `new-${target.date ?? ""}`}
            target={target}
            pageDepartmentId={departmentId}
            onDirtyChange={setDirty}
            onCancel={() => guardClose(close)}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function initialForm(
  target: EventFormTarget,
  defaultDepartmentId: string,
  canUseEveryone: boolean,
): EventForm {
  if (target.mode === "edit") {
    const e = target.event;
    const start = new Date(e.startsAt);
    const end = e.endsAt ? new Date(e.endsAt) : null;
    const date = e.allDay ? e.startsAt.slice(0, 10) : toDateStr(start);
    const endDate = end ? (e.allDay ? e.endsAt!.slice(0, 10) : toDateStr(end)) : "";
    return {
      title: e.title,
      date,
      allDay: e.allDay,
      startTime: e.allDay ? "09:00" : toTimeStr(start),
      endTime: end && !e.allDay ? toTimeStr(end) : e.allDay ? "10:00" : "",
      endDate: endDate === date ? "" : endDate,
      location: e.location ?? "",
      description: e.description ?? "",
      visibility: e.visibility,
      departmentId: e.departmentId ?? defaultDepartmentId,
    };
  }
  return {
    title: "",
    date: target.date ?? toDateStr(new Date()),
    allDay: true,
    startTime: "09:00",
    endTime: "10:00",
    endDate: "",
    location: "",
    description: "",
    visibility: !defaultDepartmentId && canUseEveryone ? "everyone" : "department",
    departmentId: defaultDepartmentId,
  };
}

// Sends each server rule message to the field it is about.
function fieldForServerMessage(message: string, allDay: boolean): FieldKey {
  const m = message.toLowerCase();
  if (m.includes("end after it starts")) return allDay ? "endDate" : "endTime";
  if (m.includes("whole company")) return "visibility";
  if (m.includes("department")) return "departmentId";
  if (m.includes("title")) return "title";
  if (m.includes("location")) return "location";
  if (m.includes("description")) return "description";
  return "form";
}

function EventFormBody({
  target,
  pageDepartmentId,
  onDirtyChange,
  onCancel,
  onDone,
}: {
  target: EventFormTarget;
  pageDepartmentId?: string;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { profile, hasRole, isAdminOrCeo } = useAuth();
  const departmentsQ = useDepartments();
  const save = useSaveCalendarEvent();
  const defaultDepartmentId = pageDepartmentId ?? profile?.departmentId ?? "";
  const [initial] = useState<EventForm>(() =>
    initialForm(target, defaultDepartmentId, isAdminOrCeo),
  );
  const [form, setForm] = useState<EventForm>(initial);
  const [errors, setErrors] = useState<Errors>({});

  const dirty = (Object.keys(initial) as (keyof EventForm)[]).some((k) => form[k] !== initial[k]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const allDepartments = departmentsQ.data ?? [];
  const ownDepartments = allDepartments.filter(
    (d) =>
      hasRole(d.code as AppRole) || d.id === profile?.departmentId || d.id === form.departmentId,
  );
  const departmentOptions =
    isAdminOrCeo || ownDepartments.length === 0 ? allDepartments : ownDepartments;

  const update = (patch: Partial<EventForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e, form: undefined };
      for (const k of Object.keys(patch)) delete next[k as keyof EventForm];
      if ("allDay" in patch || "date" in patch) {
        delete next.endDate;
        delete next.endTime;
      }
      return next;
    });
  };

  const submit = () => {
    const found: Errors = {};
    const title = form.title.trim();
    if (title.length < 2) found.title = "Enter a title of at least 2 characters";
    else if (title.length > 160) found.title = "Keep the title to 160 characters or fewer";
    if (!form.date) found.date = "Choose the date";
    if (!form.allDay) {
      if (!form.startTime) found.startTime = "Choose a start time";
      if (!form.endTime) found.endTime = "Choose an end time";
    }
    if (form.endDate && form.date && form.endDate < form.date) {
      found.endDate = "The end date can't be before the start date";
    }
    if (form.location.trim().length > 160) {
      found.location = "Keep the location to 160 characters or fewer";
    }
    if (form.description.trim().length > 2000) {
      found.description = "Keep the details to 2,000 characters or fewer";
    }
    if (form.visibility === "department" && !form.departmentId) {
      found.departmentId = "Choose which department should see this";
    }

    let startsAt = "";
    let endsAt: string | null = null;
    if (Object.keys(found).length === 0) {
      if (form.allDay) {
        startsAt = allDayIso(form.date);
        endsAt = form.endDate ? allDayIso(form.endDate) : null;
      } else {
        startsAt = localIso(form.date, form.startTime);
        endsAt = localIso(form.endDate || form.date, form.endTime);
        if (new Date(endsAt) <= new Date(startsAt)) {
          found.endTime = "The event must end after it starts";
        }
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    save.mutate(
      {
        id: target.mode === "edit" ? target.event.id : undefined,
        title,
        description: form.description.trim(),
        location: form.location.trim(),
        startsAt,
        endsAt,
        allDay: form.allDay,
        visibility: form.visibility,
        departmentId: form.visibility === "department" ? form.departmentId : null,
      },
      {
        onSuccess: () => {
          toast.success(target.mode === "edit" ? "Event updated" : "Event added");
          onDone();
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : "Couldn't save the event";
          setErrors({ [fieldForServerMessage(message, form.allDay)]: message });
          toast.error(message);
        },
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{target.mode === "edit" ? "Edit event" : "New event"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <RequiredNote />
        <FormField id="event-title" label="Title" required error={errors.title}>
          <Input
            id="event-title"
            value={form.title}
            maxLength={160}
            aria-invalid={!!errors.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="e.g. Quarterly staff meeting"
            autoFocus
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField id="event-date" label="Date" required error={errors.date}>
            <Input
              id="event-date"
              type="date"
              value={form.date}
              aria-invalid={!!errors.date}
              onChange={(e) => update({ date: e.target.value })}
            />
          </FormField>
          <FormField id="event-end-date" label="End date" error={errors.endDate}>
            <Input
              id="event-end-date"
              type="date"
              value={form.endDate}
              min={form.date || undefined}
              aria-invalid={!!errors.endDate}
              onChange={(e) => update({ endDate: e.target.value })}
            />
          </FormField>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
          <Label htmlFor="event-all-day">All day</Label>
          <Switch
            id="event-all-day"
            checked={form.allDay}
            onCheckedChange={(v) => update({ allDay: v })}
          />
        </div>

        {!form.allDay && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="event-start-time" label="Start time" required error={errors.startTime}>
              <Input
                id="event-start-time"
                type="time"
                value={form.startTime}
                aria-invalid={!!errors.startTime}
                onChange={(e) => update({ startTime: e.target.value })}
              />
            </FormField>
            <FormField id="event-end-time" label="End time" required error={errors.endTime}>
              <Input
                id="event-end-time"
                type="time"
                value={form.endTime}
                aria-invalid={!!errors.endTime}
                onChange={(e) => update({ endTime: e.target.value })}
              />
            </FormField>
          </div>
        )}

        <FormField id="event-location" label="Location" error={errors.location}>
          <Input
            id="event-location"
            value={form.location}
            maxLength={160}
            aria-invalid={!!errors.location}
            onChange={(e) => update({ location: e.target.value })}
            placeholder="e.g. Boardroom, Nairobi office"
          />
        </FormField>

        <FormField id="event-details" label="Details" error={errors.description}>
          <Textarea
            id="event-details"
            rows={3}
            value={form.description}
            maxLength={2000}
            aria-invalid={!!errors.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </FormField>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium leading-none">Who can see this</legend>
          <RadioGroup
            value={form.visibility}
            onValueChange={(v) => update({ visibility: v as EventVisibility })}
            aria-invalid={!!errors.visibility}
            className="pt-1"
          >
            {VISIBILITY_ORDER.map((v) => (
              <div key={v} className="flex items-center gap-2">
                <RadioGroupItem value={v} id={`event-visibility-${v}`} />
                <Label htmlFor={`event-visibility-${v}`} className="font-normal">
                  {EVENT_VISIBILITY_LABELS[v]}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {errors.visibility && (
            <p role="alert" className="text-xs text-destructive">
              {errors.visibility}
            </p>
          )}
        </fieldset>

        {form.visibility === "department" && (
          <FormField id="event-department" label="Department" required error={errors.departmentId}>
            <Select value={form.departmentId} onValueChange={(v) => update({ departmentId: v })}>
              <SelectTrigger id="event-department" aria-invalid={!!errors.departmentId}>
                <SelectValue placeholder="Choose a department" />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        {errors.form && (
          <p role="alert" className="text-sm text-destructive">
            {errors.form}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {target.mode === "edit" ? "Save event" : "Add event"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
