import { useId, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Eye,
  Loader2,
  Mail,
  Phone,
  Plus,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Thread, type ThreadItem, type ThreadTone } from "@/components/thread/thread";
import { FormField } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_RECORD_NOUN,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPES,
  useDeleteRecordActivity,
  useLogRecordActivity,
  useRecordActivities,
  type ActivityRecordRef,
  type ActivityType,
} from "./use-activity";

const TYPE_ICON: Record<ActivityType, LucideIcon> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: StickyNote,
};

const TYPE_TONE: Record<ActivityType, ThreadTone> = {
  call: "primary",
  email: "neutral",
  meeting: "success",
  note: "neutral",
};

const isActivityType = (t: string): t is ActivityType => t in ACTIVITY_TYPE_LABELS;

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// Today keeps the current time so same-day entries stay in order.
const occurredIso = (day: Date) => {
  if (sameDay(day, new Date())) return new Date().toISOString();
  const noon = new Date(day);
  noon.setHours(12, 0, 0, 0);
  return noon.toISOString();
};

const errText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

type Draft = { type: ActivityType; when: Date; summary: string };

/** The Activity thread for a client request, tender or project: log entries, reply, delete. */
export function ActivityThread({
  record,
  canLog,
  readOnlyReason,
  headingLevel = "h2",
  flat = false,
  className,
}: {
  record: ActivityRecordRef;
  canLog: boolean;
  /** Shown when the viewer can read but not log, e.g. "Only the Tender team can add activity." */
  readOnlyReason?: string;
  headingLevel?: "h2" | "h3";
  /** Drops the card border when already inside a panel. */
  flat?: boolean;
  className?: string;
}) {
  const uid = useId();
  const { user, isAdminOrCeo } = useAuth();
  const activitiesQ = useRecordActivities(record);
  const log = useLogRecordActivity(record);
  const remove = useDeleteRecordActivity(record);
  const [draft, setDraft] = useState<Draft>({ type: "note", when: new Date(), summary: "" });
  const [whenOpen, setWhenOpen] = useState(false);
  const [error, setError] = useState("");
  const noun = ACTIVITY_RECORD_NOUN[record.kind];

  if (activitiesQ.isError) {
    return (
      <LoadError
        what="activity"
        error={activitiesQ.error}
        onRetry={() => activitiesQ.refetch()}
        className={className}
      />
    );
  }
  if (activitiesQ.isLoading) {
    return (
      <div
        className={cn("flex justify-center py-6", className)}
        role="status"
        aria-label="Loading activity"
      >
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const items: ThreadItem[] = (activitiesQ.data ?? []).map((a) => {
    const type = isActivityType(a.type) ? a.type : "note";
    const Icon = TYPE_ICON[type];
    return {
      id: a.id,
      parentId: a.parent_id,
      authorName: a.created_by_name ?? "AIMS",
      createdAt: a.parent_id ? a.created_at : a.occurred_at,
      body: a.summary,
      badge: a.parent_id
        ? undefined
        : {
            label: ACTIVITY_TYPE_LABELS[type],
            tone: TYPE_TONE[type],
            icon: <Icon className="h-3 w-3" aria-hidden="true" />,
          },
      canDelete: isAdminOrCeo || (!!user && a.created_by_id === user.id),
    };
  });

  const submit = () => {
    if (!draft.summary.trim()) {
      setError("Say what happened, e.g. what was agreed");
      return;
    }
    log.mutate(
      { type: draft.type, summary: draft.summary.trim(), occurredAt: occurredIso(draft.when) },
      {
        onSuccess: () => {
          toast.success(`${ACTIVITY_TYPE_LABELS[draft.type]} logged`);
          setDraft({ type: draft.type, when: new Date(), summary: "" });
        },
        onError: (err) => toast.error(errText(err, "Couldn't log the activity")),
      },
    );
  };

  const composer = (
    <form
      className="space-y-3 rounded-md border bg-secondary/30 p-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id={`${uid}-type`} label="What happened">
          <Select
            value={draft.type}
            onValueChange={(v) => setDraft({ ...draft, type: v as ActivityType })}
          >
            <SelectTrigger id={`${uid}-type`} className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {ACTIVITY_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id={`${uid}-when`} label="When">
          <Popover open={whenOpen} onOpenChange={setWhenOpen}>
            <PopoverTrigger asChild>
              <Button
                id={`${uid}-when`}
                type="button"
                variant="outline"
                className="h-9 w-full justify-start font-normal"
              >
                <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
                {sameDay(draft.when, new Date())
                  ? `Today, ${formatDate(draft.when)}`
                  : formatDate(draft.when)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={draft.when}
                defaultMonth={draft.when}
                disabled={{ after: new Date() }}
                onSelect={(d) => {
                  if (d) setDraft({ ...draft, when: d });
                  setWhenOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </FormField>
      </div>
      <FormField id={`${uid}-summary`} label="Summary" required error={error}>
        <Textarea
          id={`${uid}-summary`}
          rows={3}
          placeholder="e.g. Called Jane, she will send the signed proposal on Friday"
          value={draft.summary}
          aria-invalid={!!error}
          aria-describedby={error ? `${uid}-summary-error` : undefined}
          onChange={(e) => {
            setDraft({ ...draft, summary: e.target.value });
            setError("");
          }}
        />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={log.isPending}>
          {log.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1 h-4 w-4" />
          )}
          Log activity
        </Button>
      </div>
    </form>
  );

  return (
    <div className={cn("space-y-2", className)}>
      {!canLog && (
        <p className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
          {readOnlyReason ?? `Only the people working on this ${noun} can add activity.`}
        </p>
      )}
      <Thread
        title="Activity"
        headingLevel={headingLevel}
        className={flat ? "border-0 bg-transparent p-0" : undefined}
        items={items}
        newestFirst
        canPost={canLog}
        composer={composer}
        sending={log.isPending}
        emptyText={
          canLog
            ? "No activity yet. Log each call, email and meeting so the team knows where things stand."
            : "No activity yet."
        }
        onSend={(body, parentId) =>
          log
            .mutateAsync({ summary: body, parentId })
            .then(() => toast.success("Reply sent"))
            .catch((err) => toast.error(errText(err, "Couldn't send the reply")))
        }
        onDelete={(item) =>
          remove
            .mutateAsync(item.id)
            .then(() => toast.success(item.parentId ? "Reply deleted" : "Activity deleted"))
            .catch((err) => toast.error(errText(err, "Couldn't delete it")))
        }
      />
    </div>
  );
}
